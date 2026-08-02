import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

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
  assert.match(home, /className="home-energy-row"/);
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
  // Kompakt şeritte grafik ve AI analizi render edilmemeli.
  assert.doesNotMatch(compactBlock, /goal-plan-chart/);
  assert.doesNotMatch(compactBlock, /goal-plan-analysis/);
});

test("enerji satırında çember, BMR ve TDEE aynı satırda durur", () => {
  const rule = css.match(/\.home-energy-row \{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /display:grid/);
  assert.match(rule, /grid-template-columns:auto 1fr 1fr/, "çember + iki istatistik yan yana olmalı");
});

test("program oluşturma kartları hazır programlardan önce gelir", () => {
  // Kullanıcı kendi hareketlerini seçtiği kartı en başta görmek istedi.
  const customRow = training.indexOf('className="program-cards program-custom-row"');
  const readyRow = training.indexOf('className="program-cards"');
  assert.ok(customRow > 0 && readyRow > 0);
  assert.ok(customRow < readyRow, "program oluştur en başta olmalı");
  // Salon/ev, akıllı program, full body ve bölgesel hâlâ aynı ızgarada yan yana.
  const readyBlock = training.slice(readyRow, training.indexOf("</section>", readyRow));
  assert.match(readyBlock, /t\.programs\.smartTitle/);
  assert.match(readyBlock, /t\.programs\.fullBodyTitle/);
  assert.match(readyBlock, /t\.programs\.splitTitle/);
});
