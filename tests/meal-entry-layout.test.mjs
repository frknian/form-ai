import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const tracker = await readFile(new URL("../components/CalorieTracker.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
const training = await readFile(new URL("../components/TrainingPrograms.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("öğün ekleme alanı istenen sırada dizilir", () => {
  // Sıra: öğün seçimi → porsiyon → besin adı + analiz → ekle.
  const workspace = tracker.slice(tracker.indexOf('className="entry-workspace"'), tracker.indexOf('className="food-message"'));
  const at = (needle) => {
    const index = workspace.indexOf(needle);
    assert.ok(index > 0, `bulunamadı: ${needle}`);
    return index;
  };
  const meal = at("t.calorieTracker.mealLabel");
  const portion = at('className="portion-field"');
  const name = at('className="food-name-row"');
  const add = at('className="primary-btn add-food"');
  assert.ok(meal < portion, "porsiyon öğün seçiminin altında olmalı");
  assert.ok(portion < name, "besin adı porsiyonun altında olmalı");
  assert.ok(name < add, "ekle en sonda olmalı");
});

test("gram/ml ile ev ölçüleri porsiyon alanında birlikte durur", () => {
  const field = tracker.slice(tracker.indexOf('className="portion-field"'), tracker.indexOf('className="food-name-row"'));
  assert.match(field, /PRIMARY_PORTION_UNITS\.map/, "gram/ml anahtarı");
  assert.match(field, /HOUSEHOLD_PORTION_UNITS\.map/, "bardak, tabak, kase");
});

test("AI ile analiz et besin adının yanında durur", () => {
  const row = tracker.slice(tracker.indexOf('className="food-name-row"'), tracker.indexOf('className="ai-estimate-card"'));
  assert.match(row, /className="food-name"/);
  assert.match(row, /className="ai-estimate-btn"/);
  // Yalnız bir kez render edilmeli; eski konumu kaldırıldı.
  assert.equal(tracker.split('className="ai-estimate-btn"').length - 1, 1);
});

test("alan dikey akışa alınır ve kural en sonda tanımlanır", () => {
  // .manual-fields birden çok yerde tanımlı; sıralama hatası bu dosyada daha
  // önce sessiz bir hataya yol açmıştı (bkz. .ai-nutrition-values).
  const override = css.lastIndexOf(".manual-fields { grid-template-columns:minmax(0,1fr);");
  assert.ok(override > 0, "dikey akış kuralı bulunmalı");
  const others = [...css.matchAll(/\.manual-fields \{ grid-template-columns:/g)].map((match) => match.index);
  assert.ok(others.every((index) => index <= override), "kural diğer tanımlardan sonra gelmeli");
  assert.match(css, /\.food-name-row \{ display:flex;/);
});

test("sık yediklerin öğün ekleme panelinin altında", () => {
  // Kısayol, formun üstünde durunca asıl işi aşağı itiyordu.
  const panel = tracker.indexOf('className="food-entry-panel"');
  const frequent = tracker.indexOf('className="frequent-meals"');
  assert.ok(panel > 0 && frequent > 0);
  assert.ok(frequent > panel, "sık yenenler formdan sonra gelmeli");
});

test("spor ekle antrenman sekmesinde, program listesinin en üstünde", () => {
  // Buton program LİSTESİNDE durur: bir programın içine girildiğinde ekran o
  // antrenmana aittir, koşu/yürüyüş kaydı oraya kadar peşinden gelmemeli.
  const listStart = training.indexOf('return <section className="programs" id="ready-programs">\n    {/* Spor ekle');
  assert.ok(listStart > 0, "buton program listesi dalında olmalı");
  assert.equal(training.split('className="activity-open"').length - 1, 1, "tek kez render edilmeli");
  assert.doesNotMatch(app, /className="activity-open"/, "buton artık FitAiApp'te değil");
  assert.match(app, /onOpenActivityLog=\{\(\) => setActivityOpen\(true\)\}/);
  // Başlık şeridi kaldırıldı; "Spor ekle" ve açıklaması aynen kalır.
  const button = training.slice(training.indexOf('className="activity-open"'), training.indexOf("activity-open-cta"));
  assert.doesNotMatch(button, /activityEyebrow/);
  assert.match(button, /t\.dashboard\.activityTitle/);
  assert.match(button, /t\.dashboard\.activityBody/);
});

test("aktivite kaplaması görünüm dallarının dışında kalır", () => {
  // Antrenman sekmesinden açılıyor; ana ekran bölümünün içinde kalsaydı
  // koşullu dallarda beklenmedik biçimde kırpılabilirdi.
  const overlay = app.indexOf('className="activity-overlay"');
  const homeEnd = app.indexOf("</section>", app.indexOf('className="dashboard-head"'));
  assert.ok(overlay > homeEnd, "kaplama dashboard bölümünün dışında olmalı");
  assert.match(app, /\{activityOpen && authUser && <div className="activity-overlay"/, "kullanıcı yokken render edilmemeli");
});

test("ana ekran mini seri, kısayollar, hedef şeridi ve enerji satırını tek ekranda sıralar", () => {
  // Sayfalama kaldırıldı: her şey artık tek, sığan bir ekranda dikey sırayla
  // durur (mini seri selamlamanın yanında, hedef planı yalnız özet şeridiyle).
  const homeStart = app.indexOf('className="dashboard-head"');
  const home = app.slice(homeStart, app.indexOf("</section>", homeStart));
  const at = (needle) => {
    const index = home.indexOf(needle);
    assert.ok(index > 0, `bulunamadı: ${needle}`);
    return index;
  };
  const header = at("<ActivityStreak");
  const actions = at("<QuickActions");
  const goal = at("<GoalPlanCard compact");
  const energy = at('className="home-top-row"');
  assert.match(home.slice(0, actions), /<ActivityStreak userId=\{authUser\.id\} compact \/>/, "seri mini ve selamlamanın yanında olmalı");
  assert.ok(header < actions, "mini seri selamlamadan sonra, kısayollardan önce olmalı");
  assert.ok(energy < actions, "VKİ + kalori çemberi satırı kısayolların üstünde olmalı");
  assert.ok(actions < goal, "hedef planı kısayolların altında olmalı");
  assert.doesNotMatch(home, /<MobilePager/, "sayfalama kaldırılmalı");
});
