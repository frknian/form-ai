import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { calculateRecipeNutrition } from "../lib/recipe-nutrition.ts";

const defaultSeed = fileURLToPath(new URL("../data/turkish-recipes.seed.json", import.meta.url));
const sourceArgument = process.argv.find((argument) => argument.startsWith("--source="))?.slice(9);
const seedPath = sourceArgument || defaultSeed;
const dryRun = process.argv.includes("--dry-run");

function slugify(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ç", "c")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function searchText(dish) {
  return [dish.name, ...(dish.alternativeNames || []), dish.region, dish.category]
    .filter(Boolean)
    .map(slugify)
    .join(" ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requiredString(value, label) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} zorunludur.`);
  return text;
}

function optionalPositive(value, label) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} pozitif olmalıdır.`);
  return number;
}

function validateDish(raw, index) {
  const name = requiredString(raw?.name, `dishes[${index}].name`);
  const slug = raw.slug ? slugify(raw.slug) : slugify(name);
  const version = requiredString(raw?.version || "1.0.0-review", `dishes[${index}].version`);
  const ingredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const cookedWeightGrams = optionalPositive(raw.cookedWeightGrams, `${slug}.cookedWeightGrams`);
  const defaultPortionGrams = optionalPositive(raw.defaultPortionGrams, `${slug}.defaultPortionGrams`);
  if (ingredients.length && (!cookedWeightGrams || !defaultPortionGrams)) {
    throw new Error(`${slug}: malzemeli tariflerde pişmiş ağırlık ve porsiyon gramı zorunludur.`);
  }
  const normalizedIngredients = ingredients.map((ingredient, ingredientIndex) => ({
    key: slugify(requiredString(ingredient.key || ingredient.name, `${slug}.ingredients[${ingredientIndex}].key`)),
    name: requiredString(ingredient.name, `${slug}.ingredients[${ingredientIndex}].name`),
    rawWeightGrams: optionalPositive(ingredient.rawWeightGrams, `${slug}.ingredients[${ingredientIndex}].rawWeightGrams`),
    edibleYieldFactor: ingredient.edibleYieldFactor ?? 1,
    nutrientRetentionFactor: ingredient.nutrientRetentionFactor ?? 1,
    nutrition: ingredient.nutrition || null,
    allergens: Array.isArray(ingredient.allergens) ? ingredient.allergens.map(String) : [],
  }));
  if (normalizedIngredients.some((ingredient) => !ingredient.rawWeightGrams)) {
    throw new Error(`${slug}: her malzemenin gramajı zorunludur.`);
  }
  return {
    slug,
    name,
    alternativeNames: Array.isArray(raw.alternativeNames) ? [...new Set(raw.alternativeNames.map(String).filter(Boolean))] : [],
    category: requiredString(raw.category || "Diğer", `${slug}.category`),
    region: typeof raw.region === "string" ? raw.region.trim() || null : null,
    description: typeof raw.description === "string" ? raw.description.trim() || null : null,
    allergens: Array.isArray(raw.allergens) ? [...new Set(raw.allergens.map(String).filter(Boolean))] : [],
    version,
    variantName: typeof raw.variantName === "string" ? raw.variantName.trim() || null : null,
    defaultPortionGrams,
    cookedWeightGrams,
    sourceCode: requiredString(raw.sourceCode || "form_ai_seed", `${slug}.sourceCode`),
    sourceReference: typeof raw.sourceReference === "string" ? raw.sourceReference.trim() || null : null,
    sourceLicense: raw.sourceLicense && typeof raw.sourceLicense === "object" ? raw.sourceLicense : {},
    requestedReviewStatus: raw.reviewStatus === "published" ? "published" : "needs_review",
    confidenceLevel: ["high", "medium", "low"].includes(raw.confidenceLevel) ? raw.confidenceLevel : "low",
    ingredients: normalizedIngredients,
  };
}

const seed = JSON.parse(await readFile(seedPath, "utf8"));
if (seed?.schemaVersion !== 1 || !Array.isArray(seed.dishes)) throw new Error("Seed dosyası schemaVersion=1 ve dishes dizisi içermelidir.");
const dishes = seed.dishes.map(validateDish);
const duplicateSlugs = dishes.map((dish) => dish.slug).filter((slug, index, all) => all.indexOf(slug) !== index);
if (duplicateSlugs.length) throw new Error(`Tekrarlanan slug: ${[...new Set(duplicateSlugs)].join(", ")}`);
if (dishes.length < 190) throw new Error(`Başlangıç kataloğu en az 190 yemek içermelidir; bulunan: ${dishes.length}`);

if (dryRun) {
  const reviewCount = dishes.filter((dish) => !dish.ingredients.length).length;
  console.log(`Validated ${dishes.length} Turkish dishes (${reviewCount} needs ingredient review).`);
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!supabaseUrl || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY gereklidir.");
const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

let published = 0;
let needsReview = 0;
for (const dish of dishes) {
  const calculation = dish.ingredients.length
    ? calculateRecipeNutrition({
        recipeSlug: dish.slug,
        recipeVersion: dish.version,
        cookedWeightGrams: dish.cookedWeightGrams,
        defaultPortionGrams: dish.defaultPortionGrams,
        ingredients: dish.ingredients,
      })
    : null;
  const reviewStatus = dish.requestedReviewStatus === "published" && calculation && !calculation.needsReview
    ? "published"
    : "needs_review";
  const dataFingerprint = fingerprint({ ...dish, calculation });

  const { data: dishRow, error: dishError } = await client.from("recipe_dishes").upsert({
    slug: dish.slug,
    name: dish.name,
    alternative_names: dish.alternativeNames,
    category: dish.category,
    region: dish.region,
    description: dish.description,
    allergens: dish.allergens,
    search_text: searchText(dish),
    updated_at: new Date().toISOString(),
  }, { onConflict: "slug" }).select("id").single();
  if (dishError || !dishRow) throw new Error(`${dish.slug}: yemek upsert başarısız (${dishError?.code || "unknown"}).`);

  const { data: versionRow, error: versionError } = await client.from("recipe_versions").upsert({
    dish_id: dishRow.id,
    version: dish.version,
    variant_name: dish.variantName,
    default_portion_grams: dish.defaultPortionGrams,
    cooked_weight_grams: dish.cookedWeightGrams,
    calories_per_100g: calculation?.per100g.calories ?? null,
    protein_per_100g: calculation?.per100g.protein ?? null,
    carbs_per_100g: calculation?.per100g.carbohydrates ?? null,
    fat_per_100g: calculation?.per100g.fat ?? null,
    fiber_per_100g: calculation?.per100g.fiber ?? null,
    source_code: dish.sourceCode,
    source_reference: dish.sourceReference,
    source_license_snapshot: dish.sourceLicense,
    calculation_method: calculation?.calculationMethod === "incomplete" ? "not_calculated" : calculation?.calculationMethod || "not_calculated",
    confidence_level: calculation?.confidence || dish.confidenceLevel,
    review_status: reviewStatus,
    data_fingerprint: dataFingerprint,
    calculation_metadata: { seedSchemaVersion: seed.schemaVersion, warnings: calculation?.warnings || [] },
    updated_at: new Date().toISOString(),
  }, { onConflict: "dish_id,version" }).select("id").single();
  if (versionError || !versionRow) throw new Error(`${dish.slug}: sürüm upsert başarısız (${versionError?.code || "unknown"}).`);

  const { error: deleteIngredientsError } = await client.from("recipe_ingredients").delete().eq("recipe_version_id", versionRow.id);
  if (deleteIngredientsError) throw new Error(`${dish.slug}: eski malzemeler temizlenemedi (${deleteIngredientsError.code}).`);
  if (dish.ingredients.length) {
    const { error: ingredientError } = await client.from("recipe_ingredients").insert(dish.ingredients.map((ingredient, index) => ({
      recipe_version_id: versionRow.id,
      position: index + 1,
      ingredient_key: ingredient.key,
      ingredient_name: ingredient.name,
      raw_weight_grams: ingredient.rawWeightGrams,
      edible_yield_factor: ingredient.edibleYieldFactor,
      nutrient_retention_factor: ingredient.nutrientRetentionFactor,
      source_code: ingredient.nutrition?.source || null,
      source_id: ingredient.nutrition?.sourceId || null,
      calories_per_100g: ingredient.nutrition?.caloriesPer100g ?? null,
      protein_per_100g: ingredient.nutrition?.proteinPer100g ?? null,
      carbs_per_100g: ingredient.nutrition?.carbohydratesPer100g ?? null,
      fat_per_100g: ingredient.nutrition?.fatPer100g ?? null,
      fiber_per_100g: ingredient.nutrition?.fiberPer100g ?? null,
      confidence_level: ingredient.nutrition?.confidence || "low",
      allergens: ingredient.allergens,
    })));
    if (ingredientError) throw new Error(`${dish.slug}: malzemeler eklenemedi (${ingredientError.code}).`);
  }

  if (calculation) {
    const { error: auditError } = await client.from("recipe_calculation_runs").upsert({
      recipe_version_id: versionRow.id,
      calculator_version: "recipe-nutrition/1.0.0",
      calculation_method: calculation.calculationMethod,
      data_fingerprint: dataFingerprint,
      input_snapshot: dish,
      output_snapshot: calculation,
      warnings: calculation.warnings,
    }, { onConflict: "recipe_version_id,data_fingerprint" });
    if (auditError) throw new Error(`${dish.slug}: hesaplama izi kaydedilemedi (${auditError.code}).`);
  }

  if (reviewStatus === "published") published += 1;
  else needsReview += 1;
}

console.log(`Imported ${dishes.length} Turkish dishes: ${published} published, ${needsReview} needs review.`);
