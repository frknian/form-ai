import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
const pager = await readFile(new URL("../components/MobilePager.tsx", import.meta.url), "utf8");

// Mobil bölümü tek parça okunur: kurallar dosyanın sonundaki tek bir
// @media (max-width:700px) bloğunda toplanır.
const mobileBlock = css.slice(css.indexOf(".mobile-pager { display:block; }"));

test("ana ekran mobilde dört sayfaya bölünür", () => {
  // Ana ekran alt alta 7 blok uzunluğundaydı; sıfırdan gelen kullanıcı ekranın
  // altında içerik kaldığını fark etmiyordu.
  assert.match(app, /<MobilePager/, "ana ekran sayfalayıcıya bağlanmalı");
  const block = app.slice(app.indexOf("<MobilePager"), app.indexOf("activity-overlay"));
  const keys = [...block.matchAll(/\{ key: "([a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(keys, ["today", "actions", "goal", "energy"]);
  // Her blok tam olarak bir sayfaya taşınmış olmalı, kopyalanmamalı.
  const markers = [
    "className=\"dashboard-head\"", "className=\"stats-row\"", "className=\"activity-open\"",
    "<QuickActions", "<GoalPlanCard", "className=\"wellness-row\"", "className=\"energy-dashboard\"",
  ];
  for (const marker of markers) {
    const hits = block.split(marker).length - 1;
    assert.equal(hits, 1, `${marker} tam olarak bir sayfada olmalı`);
  }
});

test("sayfalayıcı masaüstü yerleşimini değiştirmez", () => {
  // display:contents ile sarmalayıcılar kutu üretmez; kardeş seçiciler ve
  // .energy-dashboard gibi eksi kenar boşlukları bugünkü gibi çalışır.
  assert.match(css, /\.mobile-pager,\.mobile-pager-track,\.mobile-pager-page \{ display:contents; \}/);
  assert.match(css, /\.mobile-pager-controls \{ display:none; \}/);
});

test("mobilde sayfa ekrana sığar, dikey kaydırma kalmaz", () => {
  // ÖLÇÜLDÜ: 375x812'de gövde taşması 0 px. Sayfa yüksekliği görünür alandan
  // topbar (112) ve kontrol çubuğu (63) düşülerek bulunur.
  assert.match(mobileBlock, /min-height:calc\(100dvh - 175px\); max-height:calc\(100dvh - 175px\)/);
  assert.match(mobileBlock, /main:has\(\.mobile-pager\) > \.dashboard \{ margin-top:0; \}/);
  assert.match(mobileBlock, /main:has\(\.mobile-pager\) > footer \{ display:none; \}/);
  // İçerik yine de taşarsa sayfa dışarı büyümek yerine kendi içinde kayar.
  assert.match(mobileBlock, /\.mobile-pager-page \{[^}]*overflow-y:auto/s);
});

test("yumuşak kaydırma snap ile çakıştığı için kullanılmaz", () => {
  // ÖLÇÜLDÜ: scroll-snap-type:x mandatory ile birlikte hem CSS
  // scroll-behavior:smooth hem de scrollTo({behavior:"smooth"}) kaydırmayı
  // iptal edip sayfayı başa geri atıyordu; geçiş anlık yapılır.
  const track = mobileBlock.match(/\.mobile-pager-track \{([^}]*)\}/s)?.[1] ?? "";
  assert.match(track, /scroll-snap-type:x mandatory/);
  assert.doesNotMatch(track, /scroll-behavior:smooth/, "smooth geri gelmiş");
  assert.doesNotMatch(pager, /behavior: *"smooth"/, "smooth geri gelmiş");
  assert.match(pager, /behavior: *"auto"/);
});

test("sayfa geçişi için üç ayrı yol sunulur", () => {
  // Jesti bilmeyen kullanıcı takılmasın: kaydırma, noktalar ve sonraki
  // sayfanın adını yazan bir düğme birlikte bulunur.
  assert.match(mobileBlock, /\.mobile-pager-track \{[^}]*overflow-x:auto/s, "parmakla kaydırma");
  assert.match(pager, /className="mobile-pager-dots"/, "noktalı gösterge");
  assert.match(pager, /nextLabel\(nextPage\.label\)/, "düğme sonraki sayfanın adını yazmalı");
  assert.match(pager, /aria-current=\{position === index\}/, "seçili nokta duyurulmalı");
});

test("sayfalayıcı metinleri iki dilde de tanımlı", async () => {
  const [tr, en] = await Promise.all([
    readFile(new URL("../lib/i18n/dictionaries/tr.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n/dictionaries/en.ts", import.meta.url), "utf8"),
  ]);
  for (const key of ["homeLabel", "next", "last", "goTo", "position", "homeToday", "homeActions", "homeGoal", "homeEnergy"]) {
    assert.match(tr, new RegExp(`\\b${key}:`), `tr.${key} eksik`);
    assert.match(en, new RegExp(`\\b${key}:`), `en.${key} eksik`);
  }
});
