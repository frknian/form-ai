export type RecipeConfidence = "high" | "medium" | "low";
export type RecipeCalculationMethod = "provider_energy" | "atwater_estimate" | "mixed" | "incomplete";

export type NutrientValues = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
};

export type IngredientNutritionInput = {
  name: string;
  rawWeightGrams: number;
  edibleYieldFactor?: number;
  nutrientRetentionFactor?: number;
  nutrition: {
    caloriesPer100g: number | null;
    proteinPer100g: number | null;
    carbohydratesPer100g: number | null;
    fatPer100g: number | null;
    fiberPer100g: number | null;
    source: string;
    sourceId?: string | null;
    confidence: RecipeConfidence;
  } | null;
};

export type RecipeCalculationInput = {
  recipeSlug: string;
  recipeVersion: string;
  cookedWeightGrams: number;
  defaultPortionGrams: number;
  ingredients: IngredientNutritionInput[];
};

const round = (value: number, digits = 2) => {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
};

function validWeight(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 100_000;
}

function validNutrient(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function factor(value: number | undefined) {
  return Number.isFinite(value) && Number(value) >= 0 && Number(value) <= 1.5 ? Number(value) : 1;
}

function scale(values: NutrientValues, multiplier: number): NutrientValues {
  return {
    calories: round(values.calories * multiplier),
    protein: round(values.protein * multiplier),
    carbohydrates: round(values.carbohydrates * multiplier),
    fat: round(values.fat * multiplier),
    fiber: round(values.fiber * multiplier),
  };
}

function atwater(nutrition: NonNullable<IngredientNutritionInput["nutrition"]>) {
  if (!validNutrient(nutrition.proteinPer100g)
    || !validNutrient(nutrition.carbohydratesPer100g)
    || !validNutrient(nutrition.fatPer100g)) return null;
  return Number(nutrition.proteinPer100g) * 4
    + Number(nutrition.carbohydratesPer100g) * 4
    + Number(nutrition.fatPer100g) * 9;
}

export function calculateRecipeNutrition(input: RecipeCalculationInput) {
  if (!input.recipeSlug.trim() || !input.recipeVersion.trim()) throw new Error("Tarif kimliği ve sürümü zorunludur.");
  if (!validWeight(input.cookedWeightGrams)) throw new Error("Toplam pişmiş ağırlık geçersiz.");
  if (!validWeight(input.defaultPortionGrams) || input.defaultPortionGrams > input.cookedWeightGrams * 2) {
    throw new Error("Varsayılan porsiyon ağırlığı geçersiz.");
  }
  if (!input.ingredients.length) throw new Error("Tarif en az bir malzeme içermelidir.");

  const warnings: string[] = [];
  const trace: Array<Record<string, unknown>> = [];
  const contributions: NutrientValues[] = [];
  const confidences: RecipeConfidence[] = [];
  let incomplete = false;
  let providerEnergy = false;
  let estimatedEnergy = false;

  for (const ingredient of input.ingredients) {
    if (!ingredient.name.trim() || !validWeight(ingredient.rawWeightGrams)) {
      throw new Error(`Geçersiz tarif malzemesi: ${ingredient.name || "bilinmeyen"}`);
    }
    const retainedGrams = ingredient.rawWeightGrams
      * factor(ingredient.edibleYieldFactor)
      * factor(ingredient.nutrientRetentionFactor);
    const basis = ingredient.nutrition;
    if (!basis) {
      incomplete = true;
      warnings.push(`${ingredient.name}: besin kaynağı eşleştirilmedi.`);
      trace.push({ name: ingredient.name, retainedGrams: round(retainedGrams), contribution: null });
      continue;
    }
    confidences.push(basis.confidence);
    const macrosComplete = [
      basis.proteinPer100g,
      basis.carbohydratesPer100g,
      basis.fatPer100g,
      basis.fiberPer100g,
    ].every(validNutrient);
    let calories = validNutrient(basis.caloriesPer100g) ? Number(basis.caloriesPer100g) : null;
    let energyMethod = "provider_energy";
    if (calories === null) {
      calories = atwater(basis);
      energyMethod = "atwater_estimate";
      if (calories !== null) {
        estimatedEnergy = true;
        warnings.push(`${ingredient.name}: enerji 4/4/9 Atwater formülüyle tahmin edildi.`);
      }
    } else {
      providerEnergy = true;
    }
    if (calories === null || !macrosComplete) {
      incomplete = true;
      warnings.push(`${ingredient.name}: makro veya enerji verisi eksik.`);
      trace.push({ name: ingredient.name, retainedGrams: round(retainedGrams), contribution: null });
      continue;
    }
    const contribution = scale({
      calories,
      protein: Number(basis.proteinPer100g),
      carbohydrates: Number(basis.carbohydratesPer100g),
      fat: Number(basis.fatPer100g),
      fiber: Number(basis.fiberPer100g),
    }, retainedGrams / 100);
    contributions.push(contribution);
    trace.push({
      name: ingredient.name,
      rawWeightGrams: ingredient.rawWeightGrams,
      retainedGrams: round(retainedGrams),
      energyMethod,
      source: basis.source,
      sourceId: basis.sourceId || null,
      contribution,
    });
  }

  const total = contributions.reduce<NutrientValues>((sum, item) => ({
    calories: sum.calories + item.calories,
    protein: sum.protein + item.protein,
    carbohydrates: sum.carbohydrates + item.carbohydrates,
    fat: sum.fat + item.fat,
    fiber: sum.fiber + item.fiber,
  }), { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 });
  const per100g = scale(total, 100 / input.cookedWeightGrams);
  const perPortion = scale(per100g, input.defaultPortionGrams / 100);
  const confidence: RecipeConfidence = incomplete || estimatedEnergy || confidences.includes("low")
    ? "low"
    : confidences.includes("medium") ? "medium" : "high";
  const calculationMethod: RecipeCalculationMethod = incomplete
    ? "incomplete"
    : providerEnergy && estimatedEnergy ? "mixed"
      : estimatedEnergy ? "atwater_estimate" : "provider_energy";

  return {
    total,
    per100g,
    perPortion,
    cookedWeightGrams: input.cookedWeightGrams,
    defaultPortionGrams: input.defaultPortionGrams,
    calculationMethod,
    confidence,
    needsReview: incomplete || estimatedEnergy || confidence === "low",
    warnings: [...new Set(warnings)],
    trace,
  };
}

export function nutritionForRecipeAmount(
  per100g: NutrientValues,
  options: { grams?: number; portions?: number; defaultPortionGrams: number },
) {
  const grams = options.grams ?? (options.portions ?? 1) * options.defaultPortionGrams;
  if (!validWeight(grams) || grams > 5_000) throw new Error("Gram veya porsiyon miktarı geçersiz.");
  return { grams: round(grams), nutrition: scale(per100g, grams / 100) };
}
