import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const argument = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = argument("source") || new URL("../data/turkish-cuisine/turkish-cuisine-1000.json", import.meta.url);
const dryRun = process.argv.includes("--dry-run");
const payload = JSON.parse(await readFile(source, "utf8"));

function validateRecipe(recipe, index) {
  const prefix = `recipes[${index}]`;
  if (!recipe?.id || !recipe.name || !recipe.slug) throw new Error(`${prefix}: kimlik, ad ve slug zorunludur.`);
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 2) {
    throw new Error(`${prefix}: en az iki malzeme zorunludur.`);
  }
  if (!["per_serving_source_reported", "pending_ingredient_calculation"].includes(recipe.nutritionBasis)) {
    throw new Error(`${prefix}: besin temeli geçersiz.`);
  }
  if (recipe.nutritionBasis === "per_serving_source_reported" && !recipe.nutritionPerServing) {
    throw new Error(`${prefix}: kaynak porsiyon makroları eksik.`);
  }
}

if (payload?.schemaVersion !== 1 || !Array.isArray(payload.recipes)) {
  throw new Error("Katalog schemaVersion=1 ve recipes dizisi içermelidir.");
}
payload.recipes.forEach(validateRecipe);
const slugs = new Set(payload.recipes.map((recipe) => recipe.slug));
if (slugs.size !== payload.recipes.length) throw new Error("Katalogda tekrar eden slug bulundu.");
if (payload.recipes.length < 1_000) throw new Error("İlk aşama kataloğu en az 1.000 tarif içermelidir.");

if (dryRun) {
  console.log(JSON.stringify({
    valid: true,
    records: payload.recipes.length,
    sourceMacros: payload.recipes.filter((recipe) => recipe.nutritionPerServing).length,
    pending: payload.recipes.filter((recipe) => !recipe.nutritionPerServing).length,
  }, null, 2));
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!supabaseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY ortam değişkenleri zorunludur.");
}
const client = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const chunk = (items, size) => Array.from(
  { length: Math.ceil(items.length / size) },
  (_, index) => items.slice(index * size, (index + 1) * size),
);

const recipeRows = payload.recipes.map((recipe) => ({
  slug: recipe.slug,
  name: recipe.name,
  alternative_names: recipe.aliases,
  category: recipe.category,
  canonical_family: recipe.canonicalFamily || recipe.name,
  variant_summary: recipe.variantSummary || null,
  region: recipe.region,
  province: recipe.province,
  description: recipe.description,
  servings: Number(recipe.servings) >= 0.1 && Number(recipe.servings) <= 1_000 ? Number(recipe.servings) : null,
  cooked_weight_grams: recipe.cookedWeightGrams,
  prep_time: recipe.prepTime,
  cook_time: recipe.cookTime,
  total_time: recipe.totalTime,
  recipe_version: recipe.recipeVersion,
  calculation_method: recipe.calculationMethod,
  confidence: recipe.confidence,
  needs_review: recipe.needsReview,
  catalog_status: "pending",
  allergens: recipe.allergens,
  source_dataset: recipe.source.dataset,
  source_url: recipe.source.url,
  source_license: recipe.source.license,
  source_record_split: recipe.source.recordSplit,
  source_record_index: recipe.source.recordIndex,
  source_attribution: recipe.source.attribution,
  updated_at: new Date().toISOString(),
}));

for (const rows of chunk(recipeRows, 100)) {
  const { error } = await client.from("cuisine_recipes").upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(`Tarif upsert başarısız: ${error.code} ${error.message} ${error.details || ""} ${error.hint || ""}`.trim());
}

const idBySlug = new Map();
for (const slugChunk of chunk([...slugs], 100)) {
  const { data, error } = await client.from("cuisine_recipes").select("id,slug").in("slug", slugChunk);
  if (error) throw new Error(`Tarif kimlikleri okunamadı: ${error.code}`);
  for (const row of data || []) idBySlug.set(row.slug, row.id);
}

for (const recipes of chunk(payload.recipes, 25)) {
  const recipeIds = recipes.map((recipe) => idBySlug.get(recipe.slug)).filter(Boolean);
  const { error: deleteError } = await client.from("cuisine_recipe_ingredients").delete().in("recipe_id", recipeIds);
  if (deleteError) throw new Error(`Eski malzeme satırları yenilenemedi: ${deleteError.code}`);
  const ingredients = recipes.flatMap((recipe) => recipe.ingredients.map((ingredient, position) => ({
    recipe_id: idBySlug.get(recipe.slug),
    position,
    amount_text: ingredient.amountText,
    grams: ingredient.grams,
    gram_status: ingredient.gramStatus,
  })));
  const { error: ingredientError } = await client.from("cuisine_recipe_ingredients").insert(ingredients);
  if (ingredientError) throw new Error(`Malzeme ekleme başarısız: ${ingredientError.code}`);
}

const calculations = payload.recipes
  .filter((recipe) => recipe.nutritionPerServing)
  .map((recipe) => ({
    recipe_id: idBySlug.get(recipe.slug),
    recipe_version: recipe.recipeVersion,
    method: "source_reported",
    input_snapshot: {
      basis: "per_serving_source_reported",
      sourceRecordSplit: recipe.source.recordSplit,
      sourceRecordIndex: recipe.source.recordIndex,
    },
    output_snapshot: {
      perServing: recipe.nutritionPerServing,
      per100g: null,
      warning: "Pişmiş ağırlık bilinmediği için 100 gram değerine çevrilmedi.",
    },
    confidence: recipe.confidence,
  }));
for (const rows of chunk(calculations, 100)) {
  const { error } = await client.from("cuisine_recipe_calculations")
    .upsert(rows, { onConflict: "recipe_id,recipe_version,method" });
  if (error) throw new Error(`Hesap geçmişi yazılamadı: ${error.code}`);
}

console.log(JSON.stringify({
  imported: payload.recipes.length,
  sourceMacroSnapshots: calculations.length,
  published: 0,
  pendingReview: payload.recipes.length,
}, null, 2));
