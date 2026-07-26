import assert from "node:assert/strict";
import test from "node:test";
import { localCoachReply } from "../lib/ai-coach.ts";
import { localNutritionAdvice } from "../lib/nutrition-advice.ts";

test("AI koç yerel yedek yanıtları güvenli ve somut öneriler üretir", () => {
  assert.match(localCoachReply("Dizimde keskin ağrı var"), /antrenmanı durdur/i);
  assert.match(localCoachReply("Hareketi nasıl kolaylaştırırım?"), /düşük ağırlık|destekli/i);
});

test("öğün tavsiyesi eksik makroya göre güvenli ve somut öneri üretir", () => {
  const advice = localNutritionAdvice({ calorieTarget: 2_100, proteinTarget: 140, carbsTarget: 240, fatTarget: 70, totals: { calories: 1_200, protein: 55, carbs: 150, fat: 42 }, meals: [{ name: "Makarna", meal: "Öğle yemeği", calories: 500, protein: 15, carbs: 80, fat: 12 }] });
  assert.match(advice, /protein/i);
  assert.match(advice, /yoğurt|yumurta|tavuk|balık|bakliyat/i);
});

test("AI coach and nutrition advice fall back in English when locale is en", () => {
  assert.match(localCoachReply("Sharp pain in my knee", "en"), /stop the workout/i);
  const advice = localNutritionAdvice({ calorieTarget: 2_100, proteinTarget: 140, carbsTarget: 240, fatTarget: 70, totals: { calories: 1_200, protein: 55, carbs: 150, fat: 42 }, meals: [{ name: "Pasta", meal: "Lunch", calories: 500, protein: 15, carbs: 80, fat: 12 }] }, "en");
  assert.match(advice, /protein/i);
  assert.match(advice, /yogurt|eggs|chicken|fish|legumes/i);
});
