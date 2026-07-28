import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { localFoodCatalog } from "../lib/food-search.ts";

const target = fileURLToPath(new URL("../data/turkish-recipes.seed.json", import.meta.url));

function slugify(value) {
  return String(value)
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

function categoryFor(name) {
  const normalized = slugify(name);
  if (/corbasi|corba/.test(normalized)) return "Çorba";
  if (/tatlisi|baklava|kunefe|sutlac|kazandibi|revani|sekerpare|tulumba|lokma|kadayif|helvasi|asure|lokum|pismaniye/.test(normalized)) return "Tatlı";
  if (/kahve|cay|ayran|kefir|salep|boza|su|gazoz|kola|sarap|raki|bira|viski|votka|icecek|smoothie|shake/.test(normalized)) return "İçecek";
  if (/yumurta|omlet|menemen|simit|pogaca|acma|peynir|zeytin|bal|kaymak|tahin/.test(normalized)) return "Kahvaltı";
  if (/salata|cacik|haydari|humus|piyaz|kisir|mucver|mercimek-koftesi/.test(normalized)) return "Meze ve salata";
  if (/borek|gozleme|pide|lahmacun|ekmek|bazlama|yufka|tost/.test(normalized)) return "Hamur işi";
  if (/kebap|kofte|doner|sis|kavurma|guvec|etli|tavuk|balik|hamsi|levrek|somon|alabalik|kokorec|tantuni/.test(normalized)) return "Ana yemek";
  if (/pilav|makarna|patates|bulgur|nohut|fasulye|mercimek|sebze|ispanak|pirasa|dolma|sarma|musakka|karniyarik/.test(normalized)) return "Ev yemeği";
  return "Diğer";
}

// Eski katalogdan yalnızca ad/porsiyon metadatası alınır. Eski makrolar
// doğrulanmış tarif verisi kabul edilmez ve seed'e taşınmaz.
const candidates = localFoodCatalog.filter((_food, index) => (
  (index >= 0 && index <= 43)
  || (index >= 58 && index <= 133)
  || (index >= 201 && index <= 249)
  || (index >= 252 && index <= 268)
  || (index >= 284 && index <= 318)
)).slice(0, 200);

const seed = {
  schemaVersion: 1,
  generatedAt: "2026-07-28",
  description: "Türk yemekleri için 200 kayıtlık inceleme kuyruğu. Kaynaksız makro ve tarif değerleri kasıtlı olarak boş bırakılmıştır.",
  policy: {
    publishRequiresCompleteIngredients: true,
    turkompAutomaticImport: false,
    openFoodFactsScope: "barcode_packaged_products_only",
    energyFallback: "protein*4 + carbohydrates*4 + fat*9; estimated and needs_review",
  },
  dishes: candidates.map((food) => ({
    name: food.name,
    alternativeNames: food.aliases || [],
    slug: slugify(food.name),
    category: categoryFor(food.name),
    region: "Türkiye",
    description: "Standart tarif, malzeme gramajı ve kaynak doğrulaması bekleyen başlangıç kaydı.",
    defaultPortionGrams: food.servingGrams || null,
    cookedWeightGrams: null,
    version: "1.0.0-review",
    variantName: null,
    sourceCode: "form_ai_seed",
    sourceReference: null,
    sourceLicense: {},
    calculationMethod: "not_calculated",
    confidenceLevel: "low",
    reviewStatus: "needs_review",
    allergens: [],
    ingredients: [],
    nutritionPer100g: null,
  })),
};

await writeFile(target, `${JSON.stringify(seed, null, 2)}\n`);
console.log(`Generated ${seed.dishes.length} review-safe Turkish dish records at ${target}.`);
