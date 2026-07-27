export const MEAL_UNITS = ["gram", "adet", "dilim", "porsiyon", "bardak", "kaşık", "kase", "avuç", "bilinmiyor"] as const;
export type MealUnit = (typeof MEAL_UNITS)[number];

export type ParsedMealItem = {
  query: string;
  originalText: string;
  quantity: number;
  unit: MealUnit;
  estimatedGrams: number;
  preparation: string | null;
  brand: string | null;
  confidence: number;
  needsConfirmation: boolean;
};

export type ParsedMeal = { items: ParsedMealItem[]; warnings: string[] };

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function validateParsedMeal(value: unknown): ParsedMeal | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { items?: unknown; warnings?: unknown };
  if (!Array.isArray(candidate.items) || candidate.items.length < 1 || candidate.items.length > 12) return null;
  const items: ParsedMealItem[] = [];
  for (const raw of candidate.items) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    const query = cleanText(item.query, 100);
    const originalText = cleanText(item.originalText, 160);
    const quantity = Number(item.quantity);
    const estimatedGrams = Number(item.estimatedGrams);
    const confidence = Number(item.confidence);
    const unit = item.unit;
    if (!query || !originalText || !MEAL_UNITS.includes(unit as MealUnit)) return null;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100) return null;
    if (!Number.isFinite(estimatedGrams) || estimatedGrams <= 0 || estimatedGrams > 5_000) return null;
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
    if (typeof item.needsConfirmation !== "boolean") return null;
    const preparation = item.preparation === null ? null : cleanText(item.preparation, 80);
    const brand = item.brand === null ? null : cleanText(item.brand, 80);
    if (item.preparation !== null && !preparation) return null;
    if (item.brand !== null && !brand) return null;
    items.push({
      query,
      originalText,
      quantity,
      unit: unit as MealUnit,
      estimatedGrams,
      preparation,
      brand,
      confidence,
      needsConfirmation: item.needsConfirmation,
    });
  }
  const warnings = Array.isArray(candidate.warnings)
    ? candidate.warnings.map((warning) => cleanText(warning, 180)).filter(Boolean).slice(0, 8)
    : [];
  return { items, warnings };
}

export function containsPromptInjection(text: string) {
  return /ignore (all|the|previous)|system prompt|developer message|önceki talimat|sistem talimat|talimatları unut/i.test(text);
}

export function applyAmbiguityRules(meal: ParsedMeal): ParsedMeal {
  const ambiguous = /\b(biraz|bir avuç|bir tabak|az|bolca)\b/i;
  return {
    ...meal,
    items: meal.items.map((item) => ambiguous.test(item.originalText)
      ? { ...item, needsConfirmation: true, confidence: Math.min(item.confidence, 0.55) }
      : item),
  };
}
