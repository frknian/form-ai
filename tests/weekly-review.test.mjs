import assert from "node:assert/strict";
import test from "node:test";
import { enforceWeeklySafety, hasEnoughWeeklyData, localWeeklyReview, validateWeeklyReview, validateWeeklySummary, weeklyReviewWeekStart } from "../lib/weekly-review.ts";

const baseSummary = {
  weekStart: "2026-07-20", goalCategory: "Güçlenme", sessionCount: 2, completionRate: 90, totalMinutes: 70,
  easySessions: 1, suitableSessions: 1, hardSessions: 0, averageFatigue: 2.5, painAreas: [], nutritionEntryCount: 8,
  nutritionLoggedDays: 3, averageCalories: 2100, averageProteinGrams: 105, weightChangeKg: -0.3, waistChangeCm: null,
};

test("validates anonymous weekly summary and Istanbul cache week", () => {
  assert.ok(validateWeeklySummary(baseSummary));
  assert.equal(weeklyReviewWeekStart(new Date("2026-07-22T10:00:00Z")), "2026-07-20");
  assert.equal(hasEnoughWeeklyData(baseSummary), true);
  assert.equal(hasEnoughWeeklyData({ ...baseSummary, sessionCount: 0 }), false);
  assert.equal(hasEnoughWeeklyData({ ...baseSummary, sessionCount: 1, nutritionLoggedDays: 0, weightChangeKg: null }), false);
});

test("produces a complete local review when AI is unavailable", () => {
  const review = localWeeklyReview(baseSummary);
  assert.ok(validateWeeklyReview(review));
  assert.ok(review.recommendations.length >= 2 && review.recommendations.length <= 4);
  assert.match(review.safetyNote, /tıbbi teşhis değildir/i);
});

test("blocks load increases when pain or high fatigue is present", () => {
  const riskySummary = { ...baseSummary, averageFatigue: 4.5, painAreas: ["Diz"] };
  const unsafeReview = { headline: "İyi hafta", summary: "Özet", positives: ["Düzenliydin"], cautions: ["Takip et"], recommendations: ["Ağırlığı artır", "Set sayısını artır", "Programı sürdür"], safetyNote: "Tıbbi tanı değildir." };
  const safe = enforceWeeklySafety(unsafeReview, riskySummary);
  assert.match(safe.headline, /toparlanma/i);
  assert.doesNotMatch(safe.recommendations.join(" "), /ağırlığı artır|set sayısını artır/i);
  assert.match(safe.recommendations.join(" "), /artırma/i);
});

test("weekly API returns a validated local fallback without an AI key", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const { POST } = await import(`../app/api/weekly-review/route.ts?test=${Date.now()}`);
  const response = await POST(new Request("http://localhost/api/weekly-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: baseSummary, email: "gonderilmemeli@example.com" }) }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.source, "local");
  assert.ok(validateWeeklyReview(payload.review));
  if (previousKey) process.env.GEMINI_API_KEY = previousKey;
});
