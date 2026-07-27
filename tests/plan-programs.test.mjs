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

test("plan her gün yenilenir ama sunucu render'ıyla uyumlu kalır", () => {
  // dayIndex skora karışmazsa plan hep aynı kalır; doğrudan Date.now() okunursa
  // sunucu ile istemci farklı plan üretip hydration uyuşmazlığı çıkarır.
  assert.match(appSource, /seed \+ dayIndex \* 131/);
  // Sunucu anlık görüntüsü sabit 0 olmalı; aksi halde sunucu ile istemci farklı
  // plan üretir. useSyncExternalStore'un üçüncü argümanı tam olarak bunun içindir.
  assert.match(appSource, /useSyncExternalStore\(subscribeToNothing, planDayIndex, \(\) => 0\)/);
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
