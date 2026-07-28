export type RecipeConfidence = "high" | "medium" | "low";
export type RecipeReviewStatus = "draft" | "needs_review" | "published" | "archived";
export type EnergyCalculationMethod = "provider_energy" | "atwater_estimate" | "mixed" | "incomplete";

export type NutrientValues = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodiumMg?: number;
};

export type IngredientNutritionBasis = {
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbohydratesPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  sugarPer100g?: number | null;
  sodiumMgPer100g?: number | null;
  source: string;
  sourceId?: string | null;
  confidence: RecipeConfidence;
};

export type RecipeIngredientInput = {
  key: string;
  name: string;
  rawWeightGrams: number;
  edibleYieldFactor?: number;
  nutrientRetentionFactor?: number;
  nutrition: IngredientNutritionBasis | null;
};

export type RecipeCalculationInput = {
  recipeSlug: string;
  recipeVersion: string;
  cookedWeightGrams: number;
  defaultPortionGrams: number;
  ingredients: RecipeIngredientInput[];
};

export type IngredientCalculationTrace = {
  key: string;
  name: string;
  rawWeightGrams: number;
  edibleWeightGrams: number;
  retainedWeightBasisGrams: number;
  energyMethod: "provider_energy" | "atwater_estimate" | "missing";
  source: string | null;
  sourceId: string | null;
  contribution: NutrientValues | null;
};

export type RecipeCalculationResult = {
  total: NutrientValues;
  per100g: NutrientValues;
  perPortion: NutrientValues;
  cookedWeightGrams: number;
  defaultPortionGrams: number;
  calculationMethod: EnergyCalculationMethod;
  confidence: RecipeConfidence;
  status: RecipeReviewStatus;
  needsReview: boolean;
  warnings: string[];
  trace: IngredientCalculationTrace[];
};

const round = (value: number, digits = 2) => {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
};

function boundedFactor(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && Number(value) >= 0 && Number(value) <= 1.5 ? Number(value) : fallback;
}

function validWeight(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 100_000;
}

function validNutrient(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function atwaterCalories(nutrition: IngredientNutritionBasis) {
  if (
    !validNutrient(nutrition.proteinPer100g)
    || !validNutrient(nutrition.carbohydratesPer100g)
    || !validNutrient(nutrition.fatPer100g)
  ) return null;
  return Number(nutrition.proteinPer100g) * 4
    + Number(nutrition.carbohydratesPer100g) * 4
    + Number(nutrition.fatPer100g) * 9;
}

function scale(values: NutrientValues, factor: number): NutrientValues {
  const scaled: NutrientValues = {
    calories: round(values.calories * factor),
    protein: round(values.protein * factor),
    carbohydrates: round(values.carbohydrates * factor),
    fat: round(values.fat * factor),
    fiber: round(values.fiber * factor),
  };
  if (values.sugar !== undefined) scaled.sugar = round(values.sugar * factor);
  if (values.sodiumMg !== undefined) scaled.sodiumMg = round(values.sodiumMg * factor);
  return scaled;
}

function sum(values: NutrientValues[]): NutrientValues {
  const total = values.reduce<NutrientValues>((accumulator, value) => ({
    calories: accumulator.calories + value.calories,
    protein: accumulator.protein + value.protein,
    carbohydrates: accumulator.carbohydrates + value.carbohydrates,
    fat: accumulator.fat + value.fat,
    fiber: accumulator.fiber + value.fiber,
  }), { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 });
  if (values.length && values.every((value) => value.sugar !== undefined)) {
    total.sugar = values.reduce((amount, value) => amount + Number(value.sugar), 0);
  }
  if (values.length && values.every((value) => value.sodiumMg !== undefined)) {
    total.sodiumMg = values.reduce((amount, value) => amount + Number(value.sodiumMg), 0);
  }
  return total;
}

function lowestConfidence(values: RecipeConfidence[]) {
  if (values.includes("low")) return "low";
  if (values.includes("medium")) return "medium";
  return "high";
}

export function calculateRecipeNutrition(input: RecipeCalculationInput): RecipeCalculationResult {
  if (!input.recipeSlug.trim() || !input.recipeVersion.trim()) throw new Error("Tarif kimliği ve sürümü zorunludur.");
  if (!validWeight(input.cookedWeightGrams)) throw new Error("Toplam pişmiş ağırlık geçersiz.");
  if (!validWeight(input.defaultPortionGrams) || input.defaultPortionGrams > input.cookedWeightGrams * 2) {
    throw new Error("Varsayılan porsiyon ağırlığı geçersiz.");
  }
  if (!input.ingredients.length) throw new Error("Tarif en az bir malzeme içermelidir.");

  const warnings: string[] = [];
  const trace: IngredientCalculationTrace[] = [];
  let usedProviderEnergy = false;
  let usedAtwaterEnergy = false;
  let incomplete = false;

  for (const ingredient of input.ingredients) {
    if (!ingredient.key.trim() || !ingredient.name.trim() || !validWeight(ingredient.rawWeightGrams)) {
      throw new Error(`Geçersiz tarif malzemesi: ${ingredient.name || ingredient.key || "bilinmeyen"}`);
    }
    const edibleWeightGrams = ingredient.rawWeightGrams * boundedFactor(ingredient.edibleYieldFactor, 1);
    const retainedWeightBasisGrams = edibleWeightGrams * boundedFactor(ingredient.nutrientRetentionFactor, 1);
    const basis = ingredient.nutrition;
    if (!basis) {
      incomplete = true;
      warnings.push(`${ingredient.name}: besin kaynağı eşleştirilmedi.`);
      trace.push({
        key: ingredient.key,
        name: ingredient.name,
        rawWeightGrams: ingredient.rawWeightGrams,
        edibleWeightGrams: round(edibleWeightGrams),
        retainedWeightBasisGrams: round(retainedWeightBasisGrams),
        energyMethod: "missing",
        source: null,
        sourceId: null,
        contribution: null,
      });
      continue;
    }

    const macrosComplete = [
      basis.proteinPer100g,
      basis.carbohydratesPer100g,
      basis.fatPer100g,
      basis.fiberPer100g,
    ].every(validNutrient);
    let caloriesPer100g = validNutrient(basis.caloriesPer100g) ? Number(basis.caloriesPer100g) : null;
    let energyMethod: IngredientCalculationTrace["energyMethod"] = "provider_energy";
    if (caloriesPer100g === null) {
      caloriesPer100g = atwaterCalories(basis);
      if (caloriesPer100g !== null) {
        usedAtwaterEnergy = true;
        energyMethod = "atwater_estimate";
        warnings.push(`${ingredient.name}: enerji değeri Atwater 4/4/9 formülüyle tahmin edildi.`);
      }
    } else {
      usedProviderEnergy = true;
    }

    if (caloriesPer100g === null || !macrosComplete) {
      incomplete = true;
      warnings.push(`${ingredient.name}: makro veya enerji verisi eksik.`);
      trace.push({
        key: ingredient.key,
        name: ingredient.name,
        rawWeightGrams: ingredient.rawWeightGrams,
        edibleWeightGrams: round(edibleWeightGrams),
        retainedWeightBasisGrams: round(retainedWeightBasisGrams),
        energyMethod: caloriesPer100g === null ? "missing" : energyMethod,
        source: basis.source,
        sourceId: basis.sourceId || null,
        contribution: null,
      });
      continue;
    }

    const basisValues: NutrientValues = {
      calories: caloriesPer100g,
      protein: Number(basis.proteinPer100g),
      carbohydrates: Number(basis.carbohydratesPer100g),
      fat: Number(basis.fatPer100g),
      fiber: Number(basis.fiberPer100g),
    };
    if (validNutrient(basis.sugarPer100g ?? null)) basisValues.sugar = Number(basis.sugarPer100g);
    if (validNutrient(basis.sodiumMgPer100g ?? null)) basisValues.sodiumMg = Number(basis.sodiumMgPer100g);
    const contribution = scale(basisValues, retainedWeightBasisGrams / 100);
    trace.push({
      key: ingredient.key,
      name: ingredient.name,
      rawWeightGrams: ingredient.rawWeightGrams,
      edibleWeightGrams: round(edibleWeightGrams),
      retainedWeightBasisGrams: round(retainedWeightBasisGrams),
      energyMethod,
      source: basis.source,
      sourceId: basis.sourceId || null,
      contribution,
    });
  }

  const total = sum(trace.flatMap((item) => item.contribution ? [item.contribution] : []));
  const per100g = scale(total, 100 / input.cookedWeightGrams);
  const perPortion = scale(per100g, input.defaultPortionGrams / 100);
  const sourceConfidences = input.ingredients.flatMap((ingredient) => ingredient.nutrition ? [ingredient.nutrition.confidence] : ["low" as const]);
  const confidence = incomplete || usedAtwaterEnergy ? "low" : lowestConfidence(sourceConfidences);
  const calculationMethod: EnergyCalculationMethod = incomplete
    ? "incomplete"
    : usedAtwaterEnergy && usedProviderEnergy
      ? "mixed"
      : usedAtwaterEnergy
        ? "atwater_estimate"
        : "provider_energy";

  return {
    total,
    per100g,
    perPortion,
    cookedWeightGrams: input.cookedWeightGrams,
    defaultPortionGrams: input.defaultPortionGrams,
    calculationMethod,
    confidence,
    status: incomplete || usedAtwaterEnergy || confidence === "low" ? "needs_review" : "published",
    needsReview: incomplete || usedAtwaterEnergy || confidence === "low",
    warnings: [...new Set(warnings)],
    trace,
  };
}

export function nutritionForRecipeAmount(per100g: NutrientValues, options: { grams?: number; portions?: number; defaultPortionGrams: number }) {
  const grams = options.grams ?? (options.portions ?? 1) * options.defaultPortionGrams;
  if (!validWeight(grams) || grams > 5_000) throw new Error("Gram veya porsiyon miktarı geçersiz.");
  return { grams: round(grams), nutrition: scale(per100g, grams / 100) };
}
