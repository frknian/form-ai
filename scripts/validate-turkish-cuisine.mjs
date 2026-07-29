import { readFile } from "node:fs/promises";

const source = new URL("../data/turkish-cuisine/turkish-cuisine-1000.json", import.meta.url);
const payload = JSON.parse(await readFile(source, "utf8"));
const errors = [];
const normalized = (value) => String(value || "").toLocaleLowerCase("tr-TR")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("ı", "i")
  .replace(/[^a-z0-9]+/g, " ").trim();
const names = new Map();

if (payload?.schemaVersion !== 1 || !Array.isArray(payload.recipes)) errors.push("Katalog şeması geçersiz.");
for (const [index, recipe] of (payload.recipes || []).entries()) {
  if (!recipe.id || !recipe.name || !recipe.slug) errors.push(`${index}: kimlik/ad/slug eksik.`);
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 2) errors.push(`${recipe.slug}: malzeme eksik.`);
  const key = normalized(recipe.name);
  if (names.has(key)) errors.push(`${recipe.slug}: aynı ad tekrar ediyor (${names.get(key)}).`);
  names.set(key, recipe.slug);
  const nutrition = recipe.nutritionPerServing;
  if (nutrition) {
    const values = [nutrition.calories, nutrition.protein, nutrition.carbohydrates, nutrition.fat, nutrition.fiber];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) errors.push(`${recipe.slug}: makro geçersiz.`);
    const estimate = nutrition.protein * 4 + nutrition.carbohydrates * 4 + nutrition.fat * 9;
    if (Math.abs(nutrition.calories - estimate) > Math.max(50, nutrition.calories * 0.35)) {
      errors.push(`${recipe.slug}: enerji-makro tutarlılığı geçersiz.`);
    }
  } else if (recipe.nutritionBasis !== "pending_ingredient_calculation") {
    errors.push(`${recipe.slug}: eksik makro kaydı pending değil.`);
  }
}
if ((payload.recipes || []).length < 1_000) errors.push("Katalog 1.000 kaydın altında.");
if (errors.length) {
  console.error(errors.slice(0, 100).join("\n"));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    valid: true,
    records: payload.recipes.length,
    uniqueNames: names.size,
    completeSourceMacros: payload.recipes.filter((recipe) => recipe.nutritionPerServing).length,
    pendingIngredientCalculation: payload.recipes.filter((recipe) => !recipe.nutritionPerServing).length,
  }, null, 2));
}
