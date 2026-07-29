import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const DATASET = "mmkocak/turkish-recipes-175K";
const DATASET_URL = `https://huggingface.co/datasets/${DATASET}`;
const TARGET = Number(process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || 1_000);
const LOCAL_INPUT = process.argv.find((arg) => arg.startsWith("--input="))?.slice("--input=".length) || null;
const OUTPUT_DIR = new URL("../data/turkish-cuisine/", import.meta.url);
const LOCAL_ROWS = LOCAL_INPUT ? JSON.parse(await readFile(LOCAL_INPUT, "utf8")) : null;

const SEARCH_TERMS = [
  "çorba", "köfte", "kebap", "börek", "dolma", "sarma", "pilav", "helva", "baklava",
  "kadayıf", "künefe", "pide", "lahmacun", "mantı", "menemen", "cacık", "ayran",
  "gözleme", "poğaça", "açma", "simit", "bazlama", "tarhana", "keşkek", "aşure",
  "revani", "lokma", "tulumba", "sütlaç", "muhallebi", "hoşaf", "komposto", "yahni",
  "güveç", "kavurma", "tava", "zeytinyağlı", "dible", "kuymak", "mıhlama", "kısır",
  "mercimek", "fasulye", "nohut", "patlıcan", "kabak", "bulgur", "erişte", "çiğ köfte",
  "imam bayıldı", "karnıyarık", "musakka", "türlü", "oturtma", "kapuska", "ezogelin",
  "işkembe", "paça", "kavut", "pestil", "sucuk", "pastırma", "yoğurt", "şerbet",
];

const TURKISH_CUISINE_TERMS = [
  "corba", "kofte", "kebap", "kebabi", "borek", "dolma", "sarma", "pilav", "helva",
  "baklava", "kadayif", "kunefe", "pide", "lahmacun", "manti", "menemen", "cacik",
  "ayran", "gozleme", "pogaca", "acma", "simit", "bazlama", "tarhana", "keskek",
  "asure", "revani", "lokma", "tulumba", "sutlac", "muhallebi", "hosaf", "komposto",
  "yahni", "guvec", "kavurma", "zeytinyagli", "dible", "kuymak", "mihlama",
  "kisir", "eriste",
  "cig kofte", "imam bayildi", "karniyarik", "musakka", "turlu", "oturtma", "kapuska",
  "ezogelin", "iskembe", "paca", "kavut", "pestil", "sucuk", "pastirma", "serbet",
];

const FAMILY_NAMES = new Map([
  ["sucuk", "Sucuk yemekleri"], ["corba", "Çorbalar"], ["kofte", "Köfteler"],
  ["kebap", "Kebaplar"], ["borek", "Börekler"], ["dolma", "Dolmalar"],
  ["sarma", "Sarmalar"], ["pilav", "Pilavlar"], ["baklava", "Baklavalar"],
  ["kadayif", "Kadayıflar"], ["pide", "Pideler"], ["manti", "Mantılar"],
  ["pogaca", "Poğaçalar"], ["helva", "Helvalar"], ["kavurma", "Kavurmalar"],
]);

const EXCLUDED_TERMS = [
  "brownie", "cheesecake", "cookie", "cupcake", "muffin", "pancake", "waffle", "tiramisu",
  "risotto", "sushi", "ramen", "taco", "fajita", "nachos", "hamburger", "smoothie",
  "pizza", "ravioli", "kruvasan", "bruschetta", "lazanya", "pesto", "parmesan",
  "cin", "alman", "isvec", "meksika", "italyan", "fransiz", "amerikan", "hint",
  "kore", "japon", "rus", "yunan", "macar", "ispanyol", "portekiz", "mancurya",
  "tayland", "ozbek", "afgan", "pakistan", "iran", "irak", "suriye", "lubnan",
  "gurcu", "bosna", "arnavut", "fas", "cezayir", "tunus",
];

function normalize(value) {
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
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return normalize(value).replaceAll(" ", "-").slice(0, 140);
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/^[^!]{0,80}!\s*/u, "")
    .replace(/\s+nasıl yapılır\??\s*/giu, " ")
    .replace(/\s*\((?:videolu|video(?:lu)?|resimli|tam ölçülü|enfes|nefis|kolay)\)\s*$/iu, "")
    .replace(/\s+(?:tarifi|nasıl yapılır)\s*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numeric(value) {
  const match = String(value ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function servingsOf(value) {
  const parsed = numeric(value);
  return parsed !== null && parsed >= 0.1 && parsed <= 1_000 ? parsed : null;
}

function nutritionOf(row) {
  const source = row.nutrition || {};
  const calories = numeric(source.calories ?? source.kcal);
  const protein = numeric(source["Protein(g)"] ?? source.protein);
  const carbohydrates = numeric(source["Karbonhidrat(g)"] ?? source.carbohydrates);
  const fat = numeric(source["Yağ(g)"] ?? source["Yag(g)"] ?? source.fat);
  const fiber = numeric(source["Lif(g)"] ?? source.fiber) ?? 0;
  if ([calories, protein, carbohydrates, fat].some((value) => value === null)) return null;
  if (calories < 20 || calories > 1_500 || protein < 0 || protein > 100
    || carbohydrates < 0 || carbohydrates > 200 || fat < 0 || fat > 100 || fiber < 0 || fiber > 100) return null;
  const atwater = protein * 4 + carbohydrates * 4 + fat * 9;
  const delta = Math.abs(calories - atwater);
  if (delta > Math.max(50, calories * 0.35)) return null;
  return {
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbohydrates: Math.round(carbohydrates * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    atwaterCalories: Math.round(atwater),
    sourceReported: source,
  };
}

function isTurkishCuisine(row) {
  const haystack = ` ${normalize([row.title, row.category, ...(row.tags || [])].join(" "))} `;
  const words = haystack.trim().split(" ");
  const containsTerm = (term) => term.includes(" ")
    ? haystack.includes(` ${term} `)
    : words.some((word) => word === term || word.startsWith(term));
  return TURKISH_CUISINE_TERMS.some(containsTerm)
    && !EXCLUDED_TERMS.some(containsTerm);
}

function allergens(ingredients) {
  const text = normalize(ingredients.join(" "));
  const matches = [
    ["gluten", /\b(un|bulgur|irmik|eriste|makarna|ekmek|yufka)\b/],
    ["süt", /\b(sut|yogurt|peynir|tereyagi|krema|kaymak)\b/],
    ["yumurta", /\byumurta\b/],
    ["balık", /\b(balik|hamsi|levrek|cipura|alabalik|palamut|uskumru)\b/],
    ["kabuklu deniz ürünü", /\b(karides|midye|kalamar|ahtapot)\b/],
    ["sert kabuklu yemiş", /\b(ceviz|findik|badem|antep fistigi)\b/],
    ["susam", /\b(susam|tahin)\b/],
    ["soya", /\bsoya\b/],
  ];
  return matches.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function ingredientRecord(text) {
  const normalized = String(text || "").trim().slice(0, 300);
  const gramMatch = normalized.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gram)\b/i);
  return {
    amountText: normalized,
    grams: gramMatch ? Number(gramMatch[1]) : null,
    gramStatus: gramMatch ? "source_explicit" : "needs_review",
  };
}

function recipeScore(recipe) {
  return recipe.ingredients.filter((item) => item.grams !== null).length * 5
    + recipe.ingredients.length
    + (recipe.servings ? 5 : 0);
}

function annotateVariants(recipes) {
  const groups = new Map();
  for (const recipe of recipes) {
    const normalizedName = normalize(recipe.name);
    const familyKey = [...FAMILY_NAMES.keys()].find((term) => normalizedName.includes(term)) || normalizedName;
    recipe.canonicalFamily = FAMILY_NAMES.get(familyKey) || recipe.name;
    const group = groups.get(familyKey) || [];
    group.push(recipe);
    groups.set(familyKey, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const baseline = new Set(group[0].ingredients.map((item) => normalize(item.amountText)));
    group.forEach((recipe, index) => {
      const distinguishing = recipe.ingredients
        .filter((item) => index === 0 || !baseline.has(normalize(item.amountText)))
        .slice(0, 3)
        .map((item) => item.amountText);
      recipe.variantSummary = index === 0
        ? "Ailenin ana kaynak kaydıdır; diğer sürümler ad ve malzeme bileşimiyle ayrı tutulur."
        : `Bu sürümü ayıran kaynak bileşimi: ${distinguishing.join("; ") || "farklı malzeme ölçüleri"}.`;
    });
  }
  return recipes;
}

async function fetchSearchPage(split, query, offset) {
  if (LOCAL_ROWS) {
    if (split !== "train") return [];
    return LOCAL_ROWS.slice(offset, offset + 100);
  }
  const params = new URLSearchParams({
    dataset: DATASET,
    config: "default",
    split,
    query,
    offset: String(offset),
    length: "100",
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetch(`https://datasets-server.huggingface.co/search?${params}`, {
        headers: { "User-Agent": "form.ai catalog builder/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      if (attempt === 0) continue;
      return [];
    }
    if (response.ok) {
      const payload = await response.json();
      return payload.rows || [];
    }
    if (attempt === 0 && response.status >= 500) continue;
    if (response.status >= 500 || (offset >= 500 && response.status >= 400)) return [];
    throw new Error(`Dataset API ${response.status}: ${query}/${offset}`);
  }
  return [];
}

async function collectRows() {
  const uniqueRows = new Map();
  const maximumOffset = LOCAL_ROWS ? LOCAL_ROWS.length : 1_000;
  for (const term of SEARCH_TERMS) {
    for (const split of ["train", "validation", "test"]) {
      for (let offset = 0; offset < maximumOffset; offset += 100) {
        const rows = await fetchSearchPage(split, term, offset);
        for (const wrapped of rows) {
          const row = wrapped.row;
          const nutrition = nutritionOf(row);
          if (!isTurkishCuisine(row) || !Array.isArray(row.ingredients) || row.ingredients.length < 2) continue;
          const displayName = cleanTitle(row.title);
          const titleKey = normalize(displayName);
          if (!titleKey || titleKey.length < 3) continue;
          const ingredients = row.ingredients.map(ingredientRecord);
          const originalTitle = String(row.title).trim().slice(0, 160);
          const recipe = {
            id: `trc-${createHash("sha256").update(titleKey).digest("hex").slice(0, 24)}`,
            name: displayName.slice(0, 160),
            slug: slugify(displayName),
            aliases: originalTitle !== displayName ? [originalTitle] : [],
            category: String(row.category || "Türk mutfağı").trim().slice(0, 120),
            region: null,
            province: null,
            description: null,
            ingredients,
            allergens: allergens(row.ingredients),
            servings: servingsOf(row.servings),
            defaultServingGrams: null,
            cookedWeightGrams: null,
            prepTime: row.prep_time || null,
            cookTime: row.cook_time || null,
            totalTime: row.total_time || null,
            nutritionBasis: nutrition ? "per_serving_source_reported" : "pending_ingredient_calculation",
            nutritionPerServing: nutrition,
            nutritionPer100g: null,
            recipeVersion: "1.0.0-source",
            calculationMethod: nutrition ? "source_reported" : "ingredient_calculation_pending",
            confidence: "low",
            needsReview: true,
            source: {
              dataset: DATASET,
              url: DATASET_URL,
              license: "Apache-2.0",
              recordSplit: split,
              recordIndex: wrapped.row_idx,
              attribution: "Turkish Recipes 175K — mmkocak",
            },
          };
          const existing = uniqueRows.get(titleKey);
          if (!existing || recipeScore(recipe) > recipeScore(existing)) uniqueRows.set(titleKey, recipe);
        }
        if (rows.length < 100) break;
      }
    }
    console.log(`${term}: ${uniqueRows.size} benzersiz uygun aday`);
    if (uniqueRows.size >= TARGET * 1.25) break;
  }
  return [...uniqueRows.values()]
    .sort((left, right) => {
      const nutritionDifference = Number(Boolean(right.nutritionPerServing))
        - Number(Boolean(left.nutritionPerServing));
      if (nutritionDifference) return nutritionDifference;
      const scoreDifference = recipeScore(right) - recipeScore(left);
      return scoreDifference || left.slug.localeCompare(right.slug, "tr");
    })
    .slice(0, TARGET);
}

const recipes = annotateVariants(await collectRows());
if (recipes.length < TARGET) {
  throw new Error(`Hedef ${TARGET}, yalnız ${recipes.length} uygun benzersiz Türk yemeği bulundu.`);
}

const report = {
  generatedAt: new Date().toISOString(),
  target: TARGET,
  records: recipes.length,
  completeSourceMacros: recipes.filter((recipe) => recipe.nutritionPerServing).length,
  pendingIngredientCalculation: recipes.filter((recipe) => !recipe.nutritionPerServing).length,
  completePer100g: recipes.filter((recipe) => recipe.nutritionPer100g).length,
  needsReview: recipes.filter((recipe) => recipe.needsReview).length,
  explicitCookedWeight: recipes.filter((recipe) => recipe.cookedWeightGrams).length,
  explicitIngredientGramCoverage: Math.round(
    recipes.reduce((sum, recipe) => sum + recipe.ingredients.filter((item) => item.grams !== null).length, 0)
      / recipes.reduce((sum, recipe) => sum + recipe.ingredients.length, 0) * 10_000,
  ) / 100,
  source: DATASET_URL,
  license: "Apache-2.0",
  warnings: [
    "Kaynak besin değerleri porsiyon başınadır; pişmiş ağırlık doğrulanmadan 100 gram değerine çevrilmez.",
    "Kaynakta dört makrosu bulunmayan kayıtlar USDA malzeme hesabı tamamlanana kadar yayınlanmaz.",
    "Tarif talimatları ve kaynak açıklamaları telif riskini azaltmak için kataloğa kopyalanmaz.",
    "TürKomp verisi otomatik çekilmez.",
  ],
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(new URL("turkish-cuisine-1000.json", OUTPUT_DIR), `${JSON.stringify({ schemaVersion: 1, recipes }, null, 2)}\n`);
await writeFile(new URL("quality-report.json", OUTPUT_DIR), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
