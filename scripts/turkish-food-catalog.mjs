import { createHash } from "node:crypto";

export const CATEGORY_QUOTAS = Object.freeze({
  "Çorbalar": 30,
  "Kahvaltılıklar": 20,
  "Yumurtalı yemekler": 10,
  "Etli tencere ve tava yemekleri": 35,
  "Tavuk ve kümes hayvanı yemekleri": 15,
  "Balık ve deniz ürünleri": 25,
  "Kebaplar": 30,
  "Köfteler": 30,
  "Sebze yemekleri": 35,
  "Zeytinyağlılar": 25,
  "Bakliyat yemekleri": 20,
  "Dolma ve sarmalar": 30,
  "Pilavlar": 20,
  "Mantı, erişte ve makarna türleri": 15,
  "Börekler ve hamur işleri": 25,
  "Ekmek, pide ve çörekler": 25,
  "Salatalar": 15,
  "Mezeler ve ezmeler": 25,
  "Tatlılar": 55,
  "Geleneksel içecekler": 15,
});

export const PROVINCES = Object.freeze({
  adana: "Adana", adiyaman: "Adıyaman", afyonkarahisar: "Afyonkarahisar", agri: "Ağrı",
  aksaray: "Aksaray", amasya: "Amasya", ankara: "Ankara", antalya: "Antalya",
  ardahan: "Ardahan", artvin: "Artvin", aydin: "Aydın", balikesir: "Balıkesir",
  bartin: "Bartın", batman: "Batman", bayburt: "Bayburt", bilecik: "Bilecik",
  bingol: "Bingöl", bitlis: "Bitlis", bolu: "Bolu", burdur: "Burdur", bursa: "Bursa",
  canakkale: "Çanakkale", cankiri: "Çankırı", corum: "Çorum", denizli: "Denizli",
  diyarbakir: "Diyarbakır", duzce: "Düzce", edirne: "Edirne", elazig: "Elazığ",
  erzincan: "Erzincan", erzurum: "Erzurum", eskisehir: "Eskişehir", gaziantep: "Gaziantep",
  giresun: "Giresun", gumushane: "Gümüşhane", hakkari: "Hakkâri", hatay: "Hatay",
  igdir: "Iğdır", isparta: "Isparta", istanbul: "İstanbul", izmir: "İzmir",
  kahramanmaras: "Kahramanmaraş", karabuk: "Karabük", karaman: "Karaman", kars: "Kars",
  kastamonu: "Kastamonu", kayseri: "Kayseri", kilis: "Kilis", kirikkale: "Kırıkkale",
  kirklareli: "Kırklareli", kirsehir: "Kırşehir", kocaeli: "Kocaeli", konya: "Konya",
  kutahya: "Kütahya", malatya: "Malatya", manisa: "Manisa", mardin: "Mardin",
  mersin: "Mersin", mugla: "Muğla", mus: "Muş", nevsehir: "Nevşehir", nigde: "Niğde",
  ordu: "Ordu", osmaniye: "Osmaniye", rize: "Rize", sakarya: "Sakarya", samsun: "Samsun",
  sanliurfa: "Şanlıurfa", siirt: "Siirt", sinop: "Sinop", sirnak: "Şırnak", sivas: "Sivas",
  tekirdag: "Tekirdağ", tokat: "Tokat", trabzon: "Trabzon", tunceli: "Tunceli",
  usak: "Uşak", van: "Van", yalova: "Yalova", yozgat: "Yozgat", zonguldak: "Zonguldak",
});

const REGION_GROUPS = {
  Marmara: ["edirne", "kirklareli", "tekirdag", "istanbul", "kocaeli", "sakarya", "yalova", "bilecik", "bursa", "balikesir", "canakkale"],
  Ege: ["izmir", "aydin", "mugla", "manisa", "denizli", "usak", "kutahya", "afyonkarahisar"],
  Akdeniz: ["antalya", "isparta", "burdur", "mersin", "adana", "hatay", "osmaniye", "kahramanmaras"],
  "İç Anadolu": ["ankara", "eskisehir", "cankiri", "kirikkale", "kirsehir", "nevsehir", "aksaray", "nigde", "kayseri", "sivas", "yozgat", "konya", "karaman"],
  Karadeniz: ["duzce", "bolu", "zonguldak", "bartin", "karabuk", "kastamonu", "sinop", "samsun", "amasya", "tokat", "corum", "ordu", "giresun", "trabzon", "rize", "artvin", "gumushane", "bayburt"],
  "Doğu Anadolu": ["erzurum", "erzincan", "agri", "kars", "igdir", "ardahan", "malatya", "elazig", "bingol", "tunceli", "van", "mus", "bitlis", "hakkari"],
  "Güneydoğu Anadolu": ["gaziantep", "kilis", "sanliurfa", "adiyaman", "diyarbakir", "mardin", "batman", "siirt", "sirnak"],
};

export const REGION_BY_PROVINCE = Object.freeze(Object.fromEntries(
  Object.entries(REGION_GROUPS).flatMap(([region, provinces]) => provinces.map((province) => [province, region])),
));

const COMMON_DISHES = new Set([
  "adana kebap", "ayran", "asure", "baklava", "beyti kebap", "borek", "boza",
  "cacik", "cig kofte", "cilbir", "doner", "etli ekmek", "ezogelin corbasi",
  "gozleme", "hamsi tava", "haydari", "humus", "iskender kebap", "karniyarik",
  "kebap", "kisir", "kofte", "kuru fasulye", "lahmacun", "lokma", "manti",
  "menemen", "mercimek corbasi", "mercimek koftesi", "midye dolma", "mucver",
  "nohut yemegi", "pide", "pirinc pilavi", "revani", "salep", "sarma",
  "simit", "su boregi", "sutlac", "tarhana corbasi", "tas kebabi", "tavuk sis",
  "tulumba tatlisi", "turk kahvesi", "urfa kebap", "yaprak sarma",
]);

const CATEGORY_FILES = Object.freeze({
  "Çorbalar": "soups.json",
  "Kahvaltılıklar": "breakfast.json",
  "Yumurtalı yemekler": "egg-dishes.json",
  "Etli tencere ve tava yemekleri": "meat-dishes.json",
  "Tavuk ve kümes hayvanı yemekleri": "poultry.json",
  "Balık ve deniz ürünleri": "seafood.json",
  "Kebaplar": "kebabs.json",
  "Köfteler": "koftes.json",
  "Sebze yemekleri": "vegetable-dishes.json",
  "Zeytinyağlılar": "olive-oil-dishes.json",
  "Bakliyat yemekleri": "legume-dishes.json",
  "Dolma ve sarmalar": "dolma-sarma.json",
  "Pilavlar": "pilafs.json",
  "Mantı, erişte ve makarna türleri": "noodles.json",
  "Börekler ve hamur işleri": "pastries.json",
  "Ekmek, pide ve çörekler": "breads.json",
  "Salatalar": "salads.json",
  "Mezeler ve ezmeler": "mezes.json",
  "Tatlılar": "desserts.json",
  "Geleneksel içecekler": "drinks.json",
});

export function normalizeTurkish(value) {
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
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugifyTurkish(value) {
  return normalizeTurkish(value).replaceAll(" ", "-");
}

function stableId(slug) {
  return `tr-${createHash("sha1").update(slug).digest("hex").slice(0, 20)}`;
}

function alternativeNames(name) {
  const names = [];
  for (const match of name.matchAll(/\(([^)]+)\)/g)) {
    for (const part of match[1].split(/\s*(?:\/|;|\s-\s)\s*/)) {
      const value = part.trim();
      if (value.length > 1 && normalizeTurkish(value) !== normalizeTurkish(name)) names.push(value);
    }
  }
  return [...new Set(names)];
}

function cookingMethods(name) {
  const normalized = normalizeTurkish(name);
  const methods = [];
  if (/tandir/.test(normalized)) methods.push("tandır");
  if (/firin/.test(normalized)) methods.push("fırınlama");
  if (/tava|kizart/.test(normalized)) methods.push("tavada pişirme");
  if (/izgara/.test(normalized)) methods.push("ızgara");
  if (/haslama|corba|yahni|hosaf|komposto/.test(normalized)) methods.push("haşlama");
  if (/guvec/.test(normalized)) methods.push("güveçte pişirme");
  if (/sac/.test(normalized)) methods.push("sacda pişirme");
  if (/buhar|bugulama/.test(normalized)) methods.push("buğulama");
  return [...new Set(methods)];
}

function titleIngredients(name) {
  const normalized = normalizeTurkish(name);
  const candidates = [
    ["hamsi", "hamsi"], ["balik", "balık"], ["tavuk", "tavuk"], ["hindi", "hindi"],
    ["kaz", "kaz"], ["ordek", "ördek"], ["kuzu", "kuzu eti"], ["ciger", "ciğer"],
    ["patlican", "patlıcan"], ["kabak", "kabak"], ["bamya", "bamya"], ["ispanak", "ıspanak"],
    ["pirasa", "pırasa"], ["lahana", "lahana"], ["mantar", "mantar"], ["fasulye", "fasulye"],
    ["nohut", "nohut"], ["mercimek", "mercimek"], ["bakla", "bakla"], ["borulce", "börülce"],
    ["bulgur", "bulgur"], ["pirinc", "pirinç"], ["yumurta", "yumurta"], ["peynir", "peynir"],
    ["yogurt", "yoğurt"], ["ceviz", "ceviz"], ["badem", "badem"], ["findik", "fındık"],
  ];
  return candidates.filter(([key]) => new RegExp(`\\b${key}\\b`).test(normalized)).map(([, label]) => label);
}

function allergensFromTitle(ingredients) {
  const allergens = [];
  if (ingredients.some((item) => ["peynir", "yoğurt"].includes(item))) allergens.push("süt");
  if (ingredients.includes("yumurta")) allergens.push("yumurta");
  if (ingredients.includes("balık") || ingredients.includes("hamsi")) allergens.push("balık");
  if (ingredients.some((item) => ["ceviz", "badem", "fındık"].includes(item))) allergens.push("sert kabuklu yemiş");
  return allergens;
}

function dietaryType(category) {
  if (category === "Etli tencere ve tava yemekleri" || category === "Kebaplar" || category === "Köfteler") return "meat";
  if (category === "Tavuk ve kümes hayvanı yemekleri") return "poultry";
  if (category === "Balık ve deniz ürünleri") return "fish";
  return null;
}

function servingTemperature(category) {
  if (["Salatalar", "Mezeler ve ezmeler", "Zeytinyağlılar"].includes(category)) return "cold";
  if (category === "Geleneksel içecekler") return "both";
  return "hot";
}

function mealTypes(category) {
  if (["Kahvaltılıklar", "Yumurtalı yemekler"].includes(category)) return ["breakfast"];
  if (category === "Tatlılar") return ["dessert"];
  if (category === "Geleneksel içecekler") return ["beverage"];
  return ["lunch", "dinner"];
}

export function buildCatalog(manifest) {
  if (!manifest || !Array.isArray(manifest.records)) throw new Error("Kaynak manifest records dizisi içermelidir.");
  return manifest.records.map((sourceRecord) => {
    const province = PROVINCES[sourceRecord.provinceSlug];
    const region = REGION_BY_PROVINCE[sourceRecord.provinceSlug];
    if (!province || !region) throw new Error(`${sourceRecord.name}: geçersiz il kodu (${sourceRecord.provinceSlug}).`);
    const normalizedName = normalizeTurkish(sourceRecord.name);
    const slug = slugifyTurkish(sourceRecord.name);
    const mainIngredients = titleIngredients(sourceRecord.name);
    const genericSource = Boolean(sourceRecord.genericSource);
    const sourceTitle = genericSource
      ? "Kültür Portalı — Yemek Çeşitleri"
      : `Kültür Portalı — ${province} / Ne Yenir?`;
    return {
      id: stableId(slug),
      sourceRecordId: sourceRecord.url.split("/").filter(Boolean).at(-1) || slug,
      name: sourceRecord.name,
      normalizedName,
      slug,
      alternativeNames: alternativeNames(sourceRecord.name),
      category: sourceRecord.category,
      subcategory: null,
      region: [region],
      province: [province],
      district: [],
      cuisineTraditions: [],
      description: `${province} yemek kültürü kaynağında ${sourceRecord.category.toLocaleLowerCase("tr-TR")} grubunda kayıtlı yöresel bir lezzettir. Tarif bileşimi ve besin değerleri ayrıca doğrulanmalıdır.`,
      historicalNote: null,
      mainIngredients,
      ingredients: [],
      cookingMethods: cookingMethods(sourceRecord.name),
      servingTemperature: servingTemperature(sourceRecord.category),
      mealTypes: mealTypes(sourceRecord.category),
      dietaryType: dietaryType(sourceRecord.category),
      allergens: allergensFromTitle(mainIngredients),
      defaultServingAmount: null,
      defaultServingUnit: null,
      defaultServingGrams: null,
      nutritionPer100g: null,
      nutritionPerServing: null,
      recipeYieldGrams: null,
      recipeVersion: "1.0.0-catalog",
      sourceType: "culture_portal_catalog",
      sources: [{
        title: sourceTitle,
        publisher: "T.C. Kültür ve Turizm Bakanlığı Kültür Portalı",
        url: sourceRecord.url,
        accessedAt: "2026-07-28",
        license: null,
        notes: genericSource
          ? "Genel katalog yalnızca ad ve sınıflandırma doğrulaması için kullanıldı; lisans ve tarif ayrıntıları manuel inceleme bekler."
          : "İl kataloğu yalnızca yemek adı ve yöresel kayıt doğrulaması için kullanıldı; kaynak metni kopyalanmadı.",
      }],
      confidence: genericSource ? "low" : "medium",
      needsReview: true,
      isRegional: true,
      isLesserKnown: !genericSource && !COMMON_DISHES.has(normalizedName.replace(/\s*\([^)]*\)\s*/g, " ").trim()),
      parentDishId: null,
      variantReason: null,
      tags: ["Türk mutfağı", region, province, sourceRecord.category, ...(genericSource ? ["genel katalog"] : ["il kataloğu"])],
      catalogStatus: "visible",
    };
  });
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest ? 1 - levenshtein(a, b) / longest : 1;
}

function canonicalTokens(value) {
  return normalizeTurkish(value)
    .split(" ")
    .filter((token) => !["yemegi", "yemek", "tarifi", "usulu"].includes(token))
    .sort()
    .join(" ");
}

function nutritionIssues(dish) {
  const issues = [];
  for (const [scope, nutrition] of [["100g", dish.nutritionPer100g], ["serving", dish.nutritionPerServing]]) {
    if (nutrition === null) continue;
    for (const [key, value] of Object.entries(nutrition)) {
      if (value !== null && (!Number.isFinite(value) || value < 0)) issues.push(`${dish.slug}: ${scope}.${key} geçersiz.`);
    }
    const kcal = nutrition.energyKcal;
    if ([kcal, nutrition.proteinG, nutrition.carbohydrateG, nutrition.fatG].every((value) => typeof value === "number")) {
      const atwater = nutrition.proteinG * 4 + nutrition.carbohydrateG * 4 + nutrition.fatG * 9;
      if (Math.abs(kcal - atwater) > Math.max(80, atwater * 0.35)) issues.push(`${dish.slug}: enerji ve makrolar belirgin biçimde tutarsız.`);
    }
  }
  return issues;
}

export function validateCatalog(dishes) {
  const errors = [];
  const warnings = [];
  const slugCounts = new Map();
  const nameCounts = new Map();
  const aliasOwners = new Map();
  const idSet = new Set(dishes.map((dish) => dish.id));

  for (const dish of dishes) {
    if (!dish.id || !dish.name || !dish.normalizedName || !dish.slug || !dish.category || !dish.description) {
      errors.push(`${dish.slug || dish.name || "bilinmeyen"}: zorunlu alan eksik.`);
    }
    slugCounts.set(dish.slug, (slugCounts.get(dish.slug) || 0) + 1);
    nameCounts.set(dish.normalizedName, (nameCounts.get(dish.normalizedName) || 0) + 1);
    for (const alias of dish.alternativeNames || []) {
      const normalized = normalizeTurkish(alias);
      const owner = aliasOwners.get(normalized);
      if (owner && owner !== dish.slug) warnings.push(`${dish.slug}: alternatif ad ${alias}, ${owner} ile çakışıyor.`);
      aliasOwners.set(normalized, dish.slug);
    }
    if (!Array.isArray(dish.sources) || !dish.sources.length) errors.push(`${dish.slug}: kaynak eksik.`);
    for (const source of dish.sources || []) {
      try {
        if (source.url && new URL(source.url).protocol !== "https:") errors.push(`${dish.slug}: kaynak URL HTTPS değil.`);
      } catch {
        errors.push(`${dish.slug}: geçersiz kaynak URL.`);
      }
    }
    if (dish.confidence === "high" && !(dish.sources || []).some((source) => source.url)) {
      errors.push(`${dish.slug}: kaynaksız kayıt yüksek güvenli olamaz.`);
    }
    if (dish.defaultServingGrams !== null && (!Number.isFinite(dish.defaultServingGrams) || dish.defaultServingGrams < 5 || dish.defaultServingGrams > 5000)) {
      errors.push(`${dish.slug}: porsiyon gramı mantıksız.`);
    }
    errors.push(...validateRecordConsistency(dish, idSet));
    errors.push(...nutritionIssues(dish));
  }

  for (const [slug, count] of slugCounts) if (count > 1) errors.push(`Tekrarlanan slug: ${slug}`);
  for (const [name, count] of nameCounts) if (count > 1) errors.push(`Tekrarlanan normalize ad: ${name}`);

  const categoryDistribution = Object.fromEntries(Object.keys(CATEGORY_QUOTAS).map((category) => [
    category,
    dishes.filter((dish) => dish.category === category).length,
  ]));
  for (const [category, minimum] of Object.entries(CATEGORY_QUOTAS)) {
    if ((categoryDistribution[category] || 0) < minimum) errors.push(`${category}: ${minimum} kota, ${categoryDistribution[category] || 0} kayıt.`);
  }

  const probableDuplicates = [];
  const compact = dishes.map((dish) => ({ slug: dish.slug, key: canonicalTokens(dish.name) }));
  for (let left = 0; left < compact.length; left += 1) {
    for (let right = left + 1; right < compact.length; right += 1) {
      const a = compact[left];
      const b = compact[right];
      if (a.key === b.key) {
        probableDuplicates.push({ a: a.slug, b: b.slug, similarity: 1, reason: "token-order" });
      } else if (Math.abs(a.key.length - b.key.length) <= 3 && Math.min(a.key.length, b.key.length) >= 8) {
        const score = similarity(a.key, b.key);
        if (score >= 0.92) probableDuplicates.push({ a: a.slug, b: b.slug, similarity: Number(score.toFixed(3)), reason: "edit-distance" });
      }
    }
  }

  const regionDistribution = Object.fromEntries(Object.keys(REGION_GROUPS).map((region) => [
    region,
    dishes.filter((dish) => dish.region.includes(region)).length,
  ]));
  const provinceDistribution = Object.fromEntries(Object.values(PROVINCES).map((province) => [
    province,
    dishes.filter((dish) => dish.province.includes(province)).length,
  ]));
  const representedProvinces = Object.entries(provinceDistribution).filter(([, count]) => count > 0).map(([province]) => province);
  const missingProvinces = Object.entries(provinceDistribution).filter(([, count]) => count === 0).map(([province]) => province);
  const confidenceDistribution = {
    high: dishes.filter((dish) => dish.confidence === "high").length,
    medium: dishes.filter((dish) => dish.confidence === "medium").length,
    low: dishes.filter((dish) => dish.confidence === "low").length,
  };
  const nutritionPresent = dishes.filter((dish) => dish.nutritionPer100g !== null).length;

  if (dishes.length < 500) errors.push(`Toplam yemek sayısı 500 altında: ${dishes.length}`);
  if (new Set(dishes.map((dish) => dish.normalizedName)).size < 500) errors.push("Benzersiz yemek sayısı 500 altında.");
  if (dishes.filter((dish) => dish.isLesserKnown).length < 200) errors.push("Az bilinen yemek sayısı 200 altında.");
  if (Object.values(regionDistribution).some((count) => count === 0)) errors.push("Yedi bölgenin tamamı temsil edilmiyor.");

  return {
    generatedAt: "2026-07-28T00:00:00.000Z",
    totalDishes: dishes.length,
    uniqueDishes: new Set(dishes.map((dish) => dish.normalizedName)).size,
    lesserKnownDishes: dishes.filter((dish) => dish.isLesserKnown).length,
    categoryDistribution,
    regionDistribution,
    provinceDistribution,
    representedProvinceCount: representedProvinces.length,
    representedProvinces,
    missingProvinces,
    nutritionPresent,
    nutritionMissing: dishes.length - nutritionPresent,
    confidenceDistribution,
    needsReview: dishes.filter((dish) => dish.needsReview).length,
    probableDuplicates,
    missingSources: dishes.filter((dish) => !dish.sources?.length).map((dish) => dish.slug),
    invalidRecords: errors,
    warnings: [...new Set(warnings)],
    seedRun: { inserted: 0, updated: 0, skipped: 0, failed: 0 },
    valid: errors.length === 0,
  };
}

export function splitCatalog(dishes) {
  return Object.fromEntries(Object.entries(CATEGORY_FILES).map(([category, filename]) => [
    filename,
    dishes.filter((dish) => dish.category === category),
  ]));
}

export function searchCatalogRecords(dishes, query) {
  const normalizedQuery = normalizeTurkish(query);
  const compactQuery = normalizedQuery.replaceAll(" ", "");
  if (compactQuery.length < 2) return [];
  return dishes.filter((dish) => {
    const values = [dish.name, ...(dish.alternativeNames || [])].map(normalizeTurkish);
    return values.some((value) => value.includes(normalizedQuery) || value.replaceAll(" ", "").includes(compactQuery));
  });
}

export function validateRecordConsistency(dish, knownIds = new Set()) {
  const errors = [];
  const searchable = normalizeTurkish([
    dish.name,
    ...(dish.mainIngredients || []),
    ...(dish.ingredients || []).map((ingredient) => ingredient.name || ""),
  ].join(" "));
  const animalPattern = /\b(et|kuzu|dana|tavuk|hindi|kaz|ordek|balik|hamsi|ciger|yumurta|sut|peynir|yogurt|tereyagi|bal)\b/;
  const meatOrFishPattern = /\b(et|kuzu|dana|tavuk|hindi|kaz|ordek|balik|hamsi|ciger)\b/;
  if (dish.dietaryType === "vegan" && animalPattern.test(searchable)) {
    errors.push(`${dish.slug}: vegan etiketi hayvansal içerikle çelişiyor.`);
  }
  if (dish.dietaryType === "vegetarian" && meatOrFishPattern.test(searchable)) {
    errors.push(`${dish.slug}: vejetaryen etiketi et/balık içeriğiyle çelişiyor.`);
  }
  const allergenRules = [
    { pattern: /\b(sut|peynir|yogurt|tereyagi)\b/, allergen: "süt" },
    { pattern: /\byumurta\b/, allergen: "yumurta" },
    { pattern: /\b(balik|hamsi)\b/, allergen: "balık" },
    { pattern: /\b(ceviz|badem|findik)\b/, allergen: "sert kabuklu yemiş" },
  ];
  for (const rule of allergenRules) {
    if (rule.pattern.test(searchable) && !(dish.allergens || []).includes(rule.allergen)) {
      errors.push(`${dish.slug}: başlık/malzeme ile uyumlu ${rule.allergen} alerjeni eksik.`);
    }
  }
  if (dish.parentDishId && !knownIds.has(dish.parentDishId)) errors.push(`${dish.slug}: ebeveyn yemek bulunamadı.`);
  if (dish.parentDishId && !dish.variantReason) errors.push(`${dish.slug}: çeşitleme nedeni eksik.`);
  return errors;
}
