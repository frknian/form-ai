import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildCatalog, splitCatalog, validateCatalog } from "./turkish-food-catalog.mjs";

const dataDirectory = fileURLToPath(new URL("../data/turkish-foods/", import.meta.url));
const manifestPath = fileURLToPath(new URL("../data/turkish-foods/source-manifest.json", import.meta.url));
const aggregatePath = fileURLToPath(new URL("../data/turkish-recipes.seed.json", import.meta.url));
const reportPath = fileURLToPath(new URL("../data/turkish-foods/quality-report.json", import.meta.url));

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const dishes = buildCatalog(manifest);
const report = validateCatalog(dishes);
if (!report.valid) {
  console.error(report.invalidRecords.join("\n"));
  process.exitCode = 1;
  throw new Error(`Türk yemek kataloğu doğrulanamadı (${report.invalidRecords.length} hata).`);
}

await mkdir(dataDirectory, { recursive: true });
for (const [filename, records] of Object.entries(splitCatalog(dishes))) {
  await writeFile(new URL(filename, new URL("../data/turkish-foods/", import.meta.url)), `${JSON.stringify({
    schemaVersion: 2,
    category: records[0]?.category || null,
    dishes: records,
  }, null, 2)}\n`);
}

const seed = {
  schemaVersion: 2,
  generatedAt: "2026-07-28",
  description: "81 ili ve 20 kategori kotasını kapsayan, kaynaklı 500 Türk yemeği kataloğu. Doğrulanmamış tarif ve besin değerleri kasıtlı olarak null bırakılmıştır.",
  policy: {
    minimumDishCount: 500,
    minimumLesserKnownCount: 200,
    publishRequiresCompleteIngredients: true,
    turkompAutomaticImport: false,
    openFoodFactsScope: "barcode_packaged_products_only",
    energyFallback: "protein*4 + carbohydrates*4 + fat*9; sourceType=macro_estimate and needsReview=true",
    nutritionMissingValue: null,
  },
  dishes,
};
await writeFile(aggregatePath, `${JSON.stringify(seed, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Generated ${dishes.length} Turkish dishes (${report.lesserKnownDishes} lesser-known, ${report.representedProvinceCount} provinces).`);
