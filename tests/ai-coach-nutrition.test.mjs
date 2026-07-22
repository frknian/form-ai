import assert from "node:assert/strict";
import test from "node:test";
import { coachModelCandidates, localCoachReply } from "../lib/ai-coach.ts";
import { localNutritionAdvice } from "../lib/nutrition-advice.ts";

test("AI koç erişilebilir yedek modelleri tekrar etmeden sıraya koyar", () => {
  assert.deepEqual(coachModelCandidates("gemini-3.5-flash").slice(0, 3), ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"]);
  assert.match(localCoachReply("Dizimde keskin ağrı var"), /antrenmanı durdur/i);
  assert.match(localCoachReply("Hareketi nasıl kolaylaştırırım?"), /düşük ağırlık|destekli/i);
});

test("öğün tavsiyesi eksik makroya göre güvenli ve somut öneri üretir", () => {
  const advice = localNutritionAdvice({ calorieTarget: 2_100, proteinTarget: 140, carbsTarget: 240, fatTarget: 70, totals: { calories: 1_200, protein: 55, carbs: 150, fat: 42 }, meals: [{ name: "Makarna", meal: "Öğle yemeği", calories: 500, protein: 15, carbs: 80, fat: 12 }] });
  assert.match(advice, /protein/i);
  assert.match(advice, /yoğurt|yumurta|tavuk|balık|bakliyat/i);
});
