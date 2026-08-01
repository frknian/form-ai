import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("palet değişmedi", () => {
  // Tasarım yenilemesi açıkça "renklere dokunmadan" istendi. Yarıçap, boşluk
  // ve gölge değişir; marka renkleri değişmez.
  for (const token of ["--ink:#1d1d1b", "--line:#dfdfda", "--paper:#f5f5f0", "--surface:#fbfbf7", "--lime:#d9f76b", "--orange:#f07c45"]) {
    assert.ok(css.includes(token), `açık tema rengi değişmiş: ${token}`);
  }
  for (const token of ["--ink:#f2f2ec", "--line:#393a35", "--paper:#131410", "--surface:#1c1d19"]) {
    assert.ok(css.includes(token), `koyu tema rengi değişmiş: ${token}`);
  }
});

test("yeni bileşenler rengi değişkenden alır, sabit kodlamaz", () => {
  // Sabit bir açık gri, koyu temada okunmaz bir kart üretirdi. Değişken
  // kullanmak iki temayı da tek kuralla doğru tutar.
  const block = css.slice(css.indexOf("TASARIM KATMANI"));
  assert.ok(block.length > 2000, "tasarım katmanı bulunamadı");
  const surfaces = [...block.matchAll(/^\.(measure-field|bmi-readout|option-card|measure-visual)[^{]*\{([^}]*)\}/gm)];
  assert.ok(surfaces.length >= 4, `beklenen bileşen kuralları bulunamadı: ${surfaces.length}`);
  for (const [, name, body] of surfaces) {
    const background = body.match(/background:([^;]+);/)?.[1] ?? "";
    if (!background) continue;
    assert.ok(/var\(--|color-mix/.test(background), `${name} sabit renk kullanıyor: ${background.trim()}`);
  }
});

test("boy silueti yüzde yükseklikle ölçeklenebilir kalır", () => {
  // İki gerçek hata buradaydı:
  //  1) .measure-visual grid + place-items:end iken satır yüksekliği içeriğe
  //     göre belirlenip yüzde yükseklik kendine çözülüyordu — silüet sabit kaldı.
  //  2) Yüzde height üzerinde transition, Chrome'da hesaplanan değeri eski
  //     yükseklikte dondurdu.
  const visual = css.match(/\.measure-visual \{([^}]*)\}/)?.[1] ?? "";
  assert.match(visual, /display:flex/, ".measure-visual flex olmalı");
  assert.match(visual, /height:104px/, "kap kesin yüksekliğe sahip olmalı");
  assert.doesNotMatch(visual, /display:grid/);

  const figure = css.match(/\.measure-figure \{([^}]*)\}/)?.[1] ?? "";
  assert.match(figure, /display:flex/);
  assert.doesNotMatch(figure, /transition:\s*height/, "yüzde height'a transition verilmemeli");
});

test("dokunma hedefleri telefonda parmak boyutunda", () => {
  const block = css.slice(css.indexOf("TASARIM KATMANI"));
  const minHeight = (selector) => {
    const body = block.match(new RegExp(`${selector}[^{]*\\{([^}]*)\\}`))?.[1] ?? "";
    return Number(body.match(/min-height:(\d+)px/)?.[1] ?? 0);
  };
  assert.ok(minHeight("\\.primary-btn, \\.start-btn") >= 44, "ana düğme çok kısa");
  assert.ok(minHeight("\\.back-btn") >= 44, "geri düğmesi çok kısa");
  assert.ok(minHeight("\\.answer, \\.equipment") >= 44, "seçim çipleri çok kısa");
  assert.match(block, /\.measure-step \{[^}]*width:42px[^}]*height:42px/, "artır/azalt düğmeleri çok küçük");
});

test("odak halkası ve azaltılmış hareket desteklenir", () => {
  // Klavye kullanıcısı için görünür odak; hareket duyarlılığı olan kullanıcı
  // için animasyonsuz sürüm.
  assert.match(css, /:focus-visible[^{]*\{[^}]*outline:2px solid var\(--focus-ring\)/);
  // Dosyada birden çok reduced-motion bloğu var (soru ilerlemesi, bekleme
  // ekranı, tasarım katmanı); ilgilendiğimiz, kartların hareketini kapatan.
  const reducedBlocks = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([^]*?)\n\}/g)].map((match) => match[1]);
  assert.ok(reducedBlocks.some((block) => block.includes(".option-card") && block.includes("transform:none")), "kart animasyonları kapatılmıyor");
  assert.ok(reducedBlocks.some((block) => block.includes(".sport-loader-arc")), "bekleme ekranı animasyonu kapatılmıyor");
});

test("onboarding telefonda tek sütuna iner ve eylem çubuğu sabitlenir", () => {
  // Uzun formda "Devam"ı aramak en sık şikâyet edilen şeydi.
  // lastIndexOf: dosyada daha eski bir 420px bloğu da var (.stats-row), onu
  // yakalarsak dilim ters dönüp boş kalıyor.
  const narrow = css.slice(css.indexOf("@media (max-width:760px)"), css.lastIndexOf("@media (max-width:420px)"));
  assert.match(narrow, /\.measure-grid \{ grid-template-columns:1fr; \}/);
  assert.match(narrow, /\.step-content \.action-row \{[^}]*position:sticky/);
  assert.match(narrow, /env\(safe-area-inset-bottom\)/, "çentikli telefonlarda düğme ekran altına gömülmemeli");

  const tiny = css.slice(css.lastIndexOf("@media (max-width:420px)"));
  assert.match(tiny, /\.option-cards-3 \{ grid-template-columns:1fr; \}/, "375px'te üç sütun kart okunmuyordu");
});

test("koyu temada koyu zeminli düğmeler açık yazı alır", async () => {
  // "Detayları görüntüle" koyu temada okunmuyordu: zemin #303a23 (koyu),
  // yazı ise açık-lime grubundan #34410e (koyu) geliyordu.
  const darkText = css.match(/\.dark \.streak-card[^{]*\{([^}]*)\}/)?.[0] ?? "";
  for (const selector of [".detail-add", ".exercise-detail-button", ".load-exercises"]) {
    assert.ok(!darkText.includes(selector), `${selector} koyu yazı grubunda kalmış`);
  }
  const darkSurface = css.match(/\.dark \.detail-add,\.dark \.exercise-detail-button,\.dark \.load-exercises \{([^}]*)\}/)?.[1] ?? "";
  assert.match(darkSurface, /background:#303a23/);
  assert.match(darkSurface, /color:#dcefa4/, "koyu zeminli düğme kendi açık yazı rengini almalı");
});

test("bekleme ekranı sportif ve erişilebilir", async () => {
  const loader = await readFile(new URL("../components/SportyLoader.tsx", import.meta.url), "utf8");
  assert.match(loader, /role="status"/);
  assert.match(loader, /aria-live="polite"/);
  assert.match(loader, /sport-loader-bars/);
  // Eski jenerik "↗" kutusu iki ekranda da kalmamalı.
  for (const file of ["../components/AuthScreen.tsx", "../components/FitAiApp.tsx"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /<SportyLoader /, `${file}: sportif bekleme ekranı bağlanmamış`);
    assert.doesNotMatch(source, /auth-loading-mark/, `${file}: eski bekleme kutusu duruyor`);
  }
});
