import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { normalizeTurkish, slugifyTurkish, validateCatalog } from "./turkish-food-catalog.mjs";

const defaultSeed = fileURLToPath(new URL("../data/turkish-recipes.seed.json", import.meta.url));
const argumentValue = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const seedPath = argumentValue("source") || defaultSeed;
const categoryFilter = argumentValue("category");
const regionFilter = argumentValue("region");
const dryRun = process.argv.includes("--dry-run") || process.argv.includes("--report");
const printReport = process.argv.includes("--report");

const fingerprint = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const isoNow = () => new Date().toISOString();

function requiredString(value, label) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} zorunludur.`);
  return text;
}

function normalizeDish(raw, index) {
  const name = requiredString(raw?.name, `dishes[${index}].name`);
  const slug = slugifyTurkish(raw.slug || name);
  return {
    ...raw,
    id: requiredString(raw.id, `${slug}.id`),
    name,
    normalizedName: normalizeTurkish(raw.normalizedName || name),
    slug,
    alternativeNames: Array.isArray(raw.alternativeNames) ? [...new Set(raw.alternativeNames.map(String).filter(Boolean))] : [],
    category: requiredString(raw.category, `${slug}.category`),
    subcategory: typeof raw.subcategory === "string" ? raw.subcategory.trim() || null : null,
    region: Array.isArray(raw.region) ? [...new Set(raw.region.map(String).filter(Boolean))] : [],
    province: Array.isArray(raw.province) ? [...new Set(raw.province.map(String).filter(Boolean))] : [],
    district: Array.isArray(raw.district) ? [...new Set(raw.district.map(String).filter(Boolean))] : [],
    cuisineTraditions: Array.isArray(raw.cuisineTraditions) ? [...new Set(raw.cuisineTraditions.map(String).filter(Boolean))] : [],
    description: requiredString(raw.description, `${slug}.description`),
    mainIngredients: Array.isArray(raw.mainIngredients) ? [...new Set(raw.mainIngredients.map(String).filter(Boolean))] : [],
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients : [],
    cookingMethods: Array.isArray(raw.cookingMethods) ? [...new Set(raw.cookingMethods.map(String).filter(Boolean))] : [],
    mealTypes: Array.isArray(raw.mealTypes) ? [...new Set(raw.mealTypes.map(String).filter(Boolean))] : [],
    allergens: Array.isArray(raw.allergens) ? [...new Set(raw.allergens.map(String).filter(Boolean))] : [],
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    tags: Array.isArray(raw.tags) ? [...new Set(raw.tags.map(String).filter(Boolean))] : [],
  };
}

function searchText(dish) {
  const values = [
    dish.name,
    ...dish.alternativeNames,
    dish.category,
    dish.subcategory,
    ...dish.region,
    ...dish.province,
    ...dish.district,
    ...dish.mainIngredients,
    ...dish.cookingMethods,
    ...dish.tags,
  ].filter(Boolean).map(normalizeTurkish);
  return values.flatMap((value) => [value, value.replaceAll(" ", "")]).join(" ").replace(/\s+/g, " ").trim();
}

const seed = JSON.parse(await readFile(seedPath, "utf8"));
if (seed?.schemaVersion !== 2 || !Array.isArray(seed.dishes)) {
  throw new Error("Seed dosyası schemaVersion=2 ve dishes dizisi içermelidir.");
}
const allDishes = seed.dishes.map(normalizeDish);
const quality = validateCatalog(allDishes);
if (!quality.valid) throw new Error(`Seed doğrulaması başarısız:\n${quality.invalidRecords.join("\n")}`);

const dishes = allDishes.filter((dish) => (
  (!categoryFilter || normalizeTurkish(dish.category) === normalizeTurkish(categoryFilter))
  && (!regionFilter || dish.region.some((region) => normalizeTurkish(region) === normalizeTurkish(regionFilter)))
));
if (!dishes.length) throw new Error("Seçilen kategori/bölge için içe aktarılacak yemek bulunamadı.");

if (dryRun) {
  if (printReport) console.log(JSON.stringify(quality, null, 2));
  else console.log(`Validated ${allDishes.length} Turkish dishes; selected ${dishes.length} (${quality.lesserKnownDishes} lesser-known, ${quality.representedProvinceCount} provinces).`);
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!supabaseUrl || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY gereklidir.");
const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const counters = { inserted: 0, updated: 0, skipped: 0, failed: 0 };
const failures = [];
for (const dish of dishes) {
  try {
    const { data: existingDish } = await client.from("recipe_dishes").select("id").eq("slug", dish.slug).maybeSingle();
    const { data: dishRow, error: dishError } = await client.from("recipe_dishes").upsert({
      slug: dish.slug,
      name: dish.name,
      normalized_name: dish.normalizedName,
      alternative_names: dish.alternativeNames,
      category: dish.category,
      subcategory: dish.subcategory,
      region: dish.region[0] || null,
      regions: dish.region,
      provinces: dish.province,
      districts: dish.district,
      cuisine_traditions: dish.cuisineTraditions,
      description: dish.description,
      historical_note: dish.historicalNote,
      main_ingredients: dish.mainIngredients,
      cooking_methods: dish.cookingMethods,
      serving_temperature: dish.servingTemperature,
      meal_types: dish.mealTypes,
      dietary_type: dish.dietaryType,
      allergens: dish.allergens,
      source_type: dish.sourceType,
      sources: dish.sources,
      is_regional: dish.isRegional,
      is_lesser_known: dish.isLesserKnown,
      variant_reason: dish.variantReason,
      tags: dish.tags,
      catalog_status: dish.catalogStatus || "visible",
      search_text: searchText(dish),
      updated_at: isoNow(),
    }, { onConflict: "slug" }).select("id").single();
    if (dishError || !dishRow) throw new Error(`yemek upsert başarısız (${dishError?.code || "unknown"})`);

    const version = dish.recipeVersion || "1.0.0-catalog";
    const { data: existingVersion } = await client
      .from("recipe_versions")
      .select("id,source_code,review_status,calories_per_100g,calculation_method")
      .eq("dish_id", dishRow.id)
      .eq("version", version)
      .maybeSingle();
    const manuallyCurated = existingVersion && (
      existingVersion.source_code !== "culture_portal"
      || existingVersion.review_status === "published"
      || existingVersion.calculation_method !== "not_calculated"
      || existingVersion.calories_per_100g !== null
    );
    if (manuallyCurated) {
      counters.skipped += 1;
      continue;
    }

    const source = dish.sources[0] || null;
    const nutrition = dish.nutritionPer100g;
    const { error: versionError } = await client.from("recipe_versions").upsert({
      dish_id: dishRow.id,
      version,
      variant_name: null,
      default_portion_grams: dish.defaultServingGrams,
      cooked_weight_grams: dish.recipeYieldGrams,
      calories_per_100g: nutrition?.energyKcal ?? null,
      protein_per_100g: nutrition?.proteinG ?? null,
      carbs_per_100g: nutrition?.carbohydrateG ?? null,
      fat_per_100g: nutrition?.fatG ?? null,
      fiber_per_100g: nutrition?.fiberG ?? null,
      sugar_per_100g: nutrition?.sugarG ?? null,
      sodium_mg_per_100g: nutrition?.sodiumMg ?? null,
      source_code: "culture_portal",
      source_reference: source?.url || null,
      source_license_snapshot: { license: source?.license || null, publisher: source?.publisher || null, notes: source?.notes || null },
      calculation_method: nutrition ? "provider_energy" : "not_calculated",
      confidence_level: dish.confidence,
      review_status: dish.needsReview ? "needs_review" : "published",
      data_fingerprint: fingerprint(dish),
      calculation_metadata: { seedSchemaVersion: seed.schemaVersion, sourceRecordId: dish.sourceRecordId },
      updated_at: isoNow(),
    }, { onConflict: "dish_id,version" });
    if (versionError) throw new Error(`sürüm upsert başarısız (${versionError.code})`);
    if (existingDish) counters.updated += 1;
    else counters.inserted += 1;
  } catch (error) {
    counters.failed += 1;
    failures.push({ slug: dish.slug, error: error instanceof Error ? error.message : String(error) });
  }
}

console.log(JSON.stringify({ selected: dishes.length, ...counters, failures }, null, 2));
if (failures.length) process.exitCode = 1;
