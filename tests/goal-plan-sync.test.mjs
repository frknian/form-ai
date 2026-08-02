import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { planGoal } from "../lib/goal-plan.ts";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
const card = await readFile(new URL("../components/GoalPlanCard.tsx", import.meta.url), "utf8");

test("hedef planı test cevabıyla her zaman eşitlenir", () => {
  // 101 kg'daki kullanıcı hedefini 90 yaptığı hâlde kart "hedef 69 kg, 32 kg
  // kaldı, 49 hafta" gösteriyordu: plan yalnız gerçek bir hedef varken
  // yazılıyor, aksi hâlde ÖNCEKİ plan olduğu yerde kalıyordu.
  const block = app.slice(app.indexOf("const targetKg = readMeasure"), app.indexOf("setAiStatus(\"scanning\")"));
  assert.match(block, /setStoredGoalPlan\(\{/, "gerçek hedefte plan yazılmalı");
  assert.match(block, /\} else \{\s*\n\s*setStoredGoalPlan\(null\);/, "hedef yoksa eski plan temizlenmeli");
});

test("hedef 90 kg iken kalan 11 kg ve süre makul çıkar", () => {
  // Ekran görüntüsündeki 32 kg / 49 hafta yalnız hedef 69 kg iken mümkündür.
  const answers = { targetWeightKg: 90, weeklyDays: 3, sessionMinutes: 45, intensity: "steady" };
  const result = planGoal(answers, { currentWeightKg: 101, bmr: 1800 });
  assert.equal(result.status, "ready");
  assert.equal(result.remainingKg, 11);
  assert.ok(result.weeks <= 20, `süre beklenenden uzun: ${result.weeks} hafta`);

  const stale = planGoal({ ...answers, targetWeightKg: 69 }, { currentWeightKg: 101, bmr: 1800 });
  assert.equal(stale.remainingKg, 32, "eski hedefin 32 kg ürettiği doğrulanır");
});

test("günlük kalori hedefi profilden hesaplanan BMR'ye de düşer", () => {
  // Kart yalnız nutrition_goals tablosuna bakıyordu; beslenme sekmesi hiç
  // açılmadıysa satır olmadığı için profil eksiksizken bile uyarı çıkıyordu.
  assert.match(card, /profileBmr/, "kart profilden gelen BMR'yi almalı");
  assert.match(card, /const bmr = storedBmr \?\? /, "tablo yoksa profile düşmeli");
  assert.match(app, /<GoalPlanCard[^/]*profileBmr=\{energyMetrics\?\.bmr \?\? null\}/, "panel BMR'yi geçmeli");
});

test("besin analizi ızgarası kabı taşırmaz", () => {
  // repeat(5,minmax(74px,1fr)) dar kartta 398 px'lik bir alt sınır dayatıp
  // kcal kutusunu kartın kenarından taşırıyordu.
  const base = css.match(/\.ai-nutrition-values \{([^}]*)\}/)?.[1] ?? "";
  assert.match(base, /repeat\(auto-fit,minmax\(74px,1fr\)\)/);
  assert.doesNotMatch(base, /repeat\(5,/, "sabit 5 sütun geri gelmiş");
});

test("mobil sütun düzeltmesi temel kuraldan sonra gelir", () => {
  // Asıl hata buydu: aynı özgüllükteki mobil kural dosyada DAHA ÖNCE yazılmış,
  // sonraki temel kural tarafından sessizce eziliyordu.
  const baseAt = css.indexOf(".ai-nutrition-values { display:grid;");
  const overrideAt = css.indexOf(".ai-nutrition-values { grid-template-columns:repeat(2,minmax(0,1fr)); }");
  assert.ok(baseAt > 0 && overrideAt > 0, "iki kural da bulunmalı");
  assert.ok(overrideAt > baseAt, "mobil kural temel kuraldan sonra gelmeli");
});

test("onboarding başlığı sabit dil/tema düğmelerinin altında kalır", () => {
  // ÖLÇÜLDÜ: düğmeler 14..50 px arasında duruyor ve sağa yaslı adım sayacının
  // üstüne biniyordu; sayaç düğmelerin arkasında kırpılıyordu.
  assert.match(css, /\.onboarding-toggle-row \{ top:14px; right:20px; \}/);
  const mobileFix = css.indexOf(".onboarding-wrap { margin-top:62px; }");
  assert.ok(mobileFix > css.indexOf(".onboarding-toggle-row { top:14px"), "düzeltme aynı mobil blokta olmalı");
});
