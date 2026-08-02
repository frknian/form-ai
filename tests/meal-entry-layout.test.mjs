import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const tracker = await readFile(new URL("../components/CalorieTracker.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
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

test("aktivite günlüğü antrenman sekmesine taşındı", () => {
  const workout = app.slice(app.indexOf("<TrainingPrograms"), app.indexOf('{ key: "today"'));
  assert.match(workout, /className="activity-open"/, "buton antrenman sekmesinde olmalı");
  // Ana ekran sayfalarında kalmamalı.
  const pagerStart = app.indexOf("<MobilePager");
  const pager = app.slice(pagerStart, app.indexOf("</section>", pagerStart));
  assert.doesNotMatch(pager, /className="activity-open"/, "ana ekrandan kaldırılmalı");
  assert.equal(app.split('className="activity-open"').length - 1, 1, "tek kez render edilmeli");
});

test("aktivite kaplaması görünüm dallarının dışında kalır", () => {
  // Antrenman sekmesinden açılıyor; sayfalayıcı izinin içinde kalsaydı
  // yatay kaydırmada kırpılabilirdi.
  const overlay = app.indexOf('className="activity-overlay"');
  const pagerEnd = app.indexOf("</section>", app.indexOf("<MobilePager"));
  assert.ok(overlay > pagerEnd, "kaplama dashboard bölümünün dışında olmalı");
  assert.match(app, /\{activityOpen && authUser && <div className="activity-overlay"/, "kullanıcı yokken render edilmemeli");
});
