import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { extractWeeklyDays } from "../lib/training-profile.ts";

const appSource = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");

function readyProgramNameLists() {
  const start = appSource.indexOf("const readyPrograms = [");
  const block = appSource.slice(start, appSource.indexOf("\n];", start));
  return [...block.matchAll(/names: \[([^\]]+)\]/g)].map((match) =>
    [...match[1].matchAll(/"([^"]+)"/g)].map((name) => name[1]),
  );
}

test("her hazır program tam olarak 5 hareket içerir", () => {
  const lists = readyProgramNameLists();
  assert.equal(lists.length, 3, "üç hazır program bekleniyor");
  for (const names of lists) {
    assert.equal(names.length, 5, `5 hareket bekleniyor, gelen: ${names.join(", ")}`);
    assert.equal(new Set(names).size, 5, `aynı hareket iki kez: ${names.join(", ")}`);
  }
});

test("hazır programlardaki hareketler uygulama kataloğunda gerçekten vardır", () => {
  // İsim tutmazsa "Kullan" boş bir program uygular ve kullanıcı hiçbir şey göremez.
  const catalog = new Set();
  for (const name of appSource.matchAll(/name: "([^"]+)", english: "/g)) catalog.add(name[1]);
  for (const entry of appSource.matchAll(/^\s*\["([^"]+)", "[^"]+", "/gm)) catalog.add(entry[1]);
  for (const names of readyProgramNameLists()) {
    for (const name of names) assert.ok(catalog.has(name), `katalogda yok: ${name}`);
  }
});

test("kişisel plan hazır program hareketlerini son sıraya iter", () => {
  // Aksi halde "hemen başla" şablonu ile kişisel plan neredeyse aynı listeyi gösterir.
  assert.match(appSource, /const READY_PROGRAM_NAMES = new Set\(readyPrograms\.flatMap/);
  assert.match(appSource, /READY_PROGRAM_NAMES\.has\(item\.name\) \? 3 : 2/);
});

test("plan hareket sayısı süreye ve haftalık sıklığa göre değişir", () => {
  assert.match(appSource, /const weeklyDays = extractWeeklyDays\(history\[1\]\)/);
  assert.match(appSource, /weeklyDays >= 5 \? -1 : weeklyDays <= 2 \? 1 : 0/);
});

test("hareket seçimi sabittir, değişen yüktür", () => {
  // Plan bir dönem her gün döndürülüyordu; aynı hareketteki ilerlemeyi izlemek
  // imkânsızlaştığı için "stabil değil" hissi veriyordu. Seçim profile göre
  // sabit kalmalı, zamanla yalnız set/tekrar/dinlenme ilerlemeli.
  assert.doesNotMatch(appSource, /dayIndex/);
  assert.doesNotMatch(appSource, /planDayIndex/);
  assert.match(appSource, /const score = \(name: string\) => \[\.\.\.name\][^\n]*seed\) % 997/);
  assert.match(appSource, /planProgressionBlock\(completedSessions\)/);
});

test("haftalık sıklık cevabı gün sayısına çevrilir", () => {
  assert.equal(extractWeeklyDays("5+ gün"), 5);
  assert.equal(extractWeeklyDays("3–4 gün"), 3);
  assert.equal(extractWeeklyDays("3-4 gün"), 3);
  assert.equal(extractWeeklyDays("0 gün"), 2);
  assert.equal(extractWeeklyDays("1–2 gün"), 2);
  assert.equal(extractWeeklyDays(undefined), 2);
});

test("hareket kütüphanesi kartı harekete girilmeden animasyon oynatmaz", async () => {
  const card = await readFile(new URL("../components/exercises/ExerciseCard.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../components/exercises/ExerciseDetail.tsx", import.meta.url), "utf8");
  assert.match(card, /<ExerciseAnimation[^/]*autoplay=\{false\}/);
  // Detayda ise oynamalı; orada autoplay kapatılmamış olmalı.
  assert.doesNotMatch(detail, /<ExerciseAnimation[^/]*autoplay=\{false\}/);
});

test("profil testinde tüm seçenekli sorular çoklu seçimdir", () => {
  // Tek seçim, otomatik ilerleme ve sakatlığa özel dal kaldırıldı.
  assert.match(appSource, /function toggleAnswer\(answer: string\)/);
  assert.doesNotMatch(appSource, /function setAnswer\(/);
  assert.doesNotMatch(appSource, /toggleInjury/);
  // Seçili durum birleşik değerden okunmalı, tam eşitlikle değil.
  assert.match(appSource, /\(history\[questionIndex\] \|\| ""\)\.split\(" · "\)\.includes\(answer\)/);
  // "Yok" gibi dışlayıcı cevaplar diğerleriyle birlikte işaretlenemez.
  assert.match(appSource, /EXCLUSIVE_ANSWERS = new Set\(\["Yok", "Hayır", "0 gün"\]\)/);
});

test("birleşik cevaplar aşağı akışta tam eşitlikle okunmaz", () => {
  // "Yeni başlıyorum · Orta seviye" gibi değerler tam eşitliği kaçırırdı.
  assert.doesNotMatch(appSource, /history\[2\] === "Yeni başlıyorum"/);
  assert.match(appSource, /history\[2\]\.includes\("Yeni başlıyorum"\)/);
});

test("profil testi soruları telefon genişliğine uyarlanmıştır", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  // Sabit 650px, 375px ekranda yatay taşma yapıyordu.
  assert.doesNotMatch(css, /\.history-step \{ width:650px; \}/);
  assert.match(css, /\.history-step \{ width:100%; max-width:650px; \}/);
  assert.match(css, /@media \(max-width:600px\)[^]*?\.answer-grid \{ display:grid/);
});

test("kalori halkasındaki metin diskin ortasında toplanır", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  // place-items yalnız satır içinde ortalar; align-content olmadan satır izleri
  // gerilip metni diskin kenarlarına, yani halkanın yayına yapıştırıyordu.
  assert.match(css, /\.calorie-progress > div \{ display:grid; place-items:center; align-content:center;/);
  // İç disk kart arka planıyla (#22221f) aynı renkte olmamalı, yoksa görünmez.
  assert.doesNotMatch(css, /\.calorie-progress > div \{[^}]*background:#22221f/);
});
