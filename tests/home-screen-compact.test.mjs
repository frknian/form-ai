import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
const goalCard = await readFile(new URL("../components/GoalPlanCard.tsx", import.meta.url), "utf8");
const streak = await readFile(new URL("../components/ActivityStreak.tsx", import.meta.url), "utf8");
const training = await readFile(new URL("../components/TrainingPrograms.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("ana ekran mobil sayfalayıcı olmadan tek akışta durur", () => {
  // Ana ekran 4 ayrı kaydırmalı sayfaydı; içerik mini seri + kompakt hedef
  // planı + tek satırlık enerji özetiyle artık tek ekrana sığdığı için
  // sayfalama kaldırıldı.
  assert.doesNotMatch(app, /MobilePager/, "sayfalayıcı bileşeni kalmamalı");
  const homeStart = app.indexOf('className="dashboard-head"');
  assert.ok(homeStart > 0);
  const home = app.slice(homeStart, app.indexOf("</section>", homeStart));
  assert.match(home, /<ActivityStreak userId=\{authUser\.id\} compact \/>/, "mini seri selamlamanın yanında olmalı");
  assert.match(home, /<QuickActions onNavigate=\{navigateFromQuickAction\} \/>/);
  assert.match(home, /<GoalPlanCard compact onOpen=\{\(\) => setGoalPlanOpen\(true\)\}/);
  assert.match(home, /className="home-top-row"/);
  assert.match(home, /<DailyEnergyRing userId=/, "kalori çemberi VKİ'nin yanında olmalı");
});

test("hedef planının tam hâli yalnız kaplamada, dokununca açılır", () => {
  assert.match(app, /const \[goalPlanOpen, setGoalPlanOpen\] = useState\(false\);/);
  assert.match(app, /\{goalPlanOpen && authUser && <div className="goal-plan-overlay"/);
  // Kaplamadaki kart compact DEĞİL: grafik, AI analizi ve sihirbaz orada tam görünür.
  const overlayStart = app.indexOf('className="goal-plan-overlay"');
  const overlay = app.slice(overlayStart, overlayStart + 600);
  assert.doesNotMatch(overlay, /<GoalPlanCard compact/, "kaplamadaki kart tam olmalı");
  assert.match(overlay, /<GoalPlanCard userId=\{authUser\.id\}/);
});

test("mini seri rozeti sadece alev ve sayı gösterir", () => {
  assert.match(streak, /compact = false/);
  assert.match(streak, /if \(compact\) return <span className="activity-streak-mini"/);
  assert.match(css, /\.activity-streak-mini \{/);
});

test("hedef planı kompakt şeridi hafta, kalan ve günlük hedefi yan yana gösterir", () => {
  assert.match(goalCard, /compact = false, onOpen/);
  assert.match(goalCard, /if \(compact\) \{/);
  const compactBlock = goalCard.slice(goalCard.indexOf("if (compact) {"), goalCard.indexOf("// --- Soru sihirbazı"));
  assert.match(compactBlock, /goal-plan-compact-stats/);
  assert.match(compactBlock, /t\.goalPlan\.compactDurationLabel/, "süre");
  assert.match(compactBlock, /t\.goalPlan\.compactRemainingLabel/, "kalan");
  assert.match(compactBlock, /t\.goalPlan\.compactIntakeLabel/, "günlük hedef");
  // Küçük eğri kompakt şeritte de var (kullanıcı planı ana ekranda grafikle
  // görmek istedi); AI analizi hâlâ yalnız kaplamada.
  assert.match(compactBlock, /goal-plan-chart goal-plan-chart-mini/);
  assert.doesNotMatch(compactBlock, /goal-plan-analysis/);
});

test("VKİ ve kalori çemberi yan yana, kısayollar tek sırada dört sütun", () => {
  const topRow = css.match(/\.home-top-row \{([^}]*)\}/)?.[1] ?? "";
  assert.match(topRow, /display:grid/);
  assert.match(topRow, /grid-template-columns:minmax\(0,0\.8fr\) minmax\(0,1\.2fr\)/, "iki sütun, alt alta değil");
  assert.match(css, /\.quick-actions-list \{ grid-template-columns:repeat\(4,minmax\(0,1fr\)\); \}/);
  // Hedef ve ortam sütunları ana ekrandan kalktı.
  assert.doesNotMatch(app.slice(app.indexOf('className="dashboard-head"')), /t\.dashboard\.environmentLabel/);
});

test("kalori çemberi hedeften düşer: alınan eksi, antrenman yakımı artı", () => {
  const ring = readFileSync(new URL("../components/DailyEnergyRing.tsx", import.meta.url), "utf8");
  assert.match(ring, /const budget = target === null \? null : target \+ burned;/);
  assert.match(ring, /const remaining = budget === null \? null : budget - consumed;/);
});

test("hazır programlar anahtarla değişir, kendi programların en altta", () => {
  // Üç kart alt alta durunca sayfa uzuyordu; artık tek panel + anahtar.
  const switchRow = training.indexOf('className="program-switch"');
  const panel = training.indexOf('className="program-panel"');
  const customRow = training.indexOf('className="program-cards program-custom-row"');
  assert.ok(switchRow > 0 && panel > switchRow, "anahtar panelin üstünde olmalı");
  assert.ok(customRow > panel, "kendi programların en altta olmalı");
  // Anahtarın üç sekmesi: akıllı, full body, bölgesel.
  const switchBlock = training.slice(switchRow, panel);
  assert.match(switchBlock, /t\.programs\.smartTitle/);
  assert.match(switchBlock, /t\.programs\.fullBodyTitle/);
  assert.match(switchBlock, /t\.programs\.splitTitle/);
  // Üç özel program yan yana durur.
  assert.match(css, /\.program-cards\.program-custom-row \{ grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/);
});
