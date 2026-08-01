import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { FREE_TEXT_QUESTIONS, QUESTION, QUESTION_COUNT, emptyHistory, isHistoryComplete, normalizeHistory } from "../lib/onboarding-questions.ts";

test("şema 15 sorudan oluşur ve indeksler benzersizdir", () => {
  assert.equal(QUESTION_COUNT, 15);
  const indexes = Object.values(QUESTION);
  assert.equal(new Set(indexes).size, indexes.length, "iki soru aynı indekste");
  assert.deepEqual(indexes.slice().sort((a, b) => a - b), [...Array(15).keys()], "indeksler 0-14 aralığını tam doldurmalı");
});

test("boş geçmiş doğru uzunlukta kurulur", () => {
  const history = emptyHistory();
  assert.equal(history.length, 15);
  assert.ok(history.every((value) => value === ""));
});

test("eski 10 cevaplı kayıt yeni sıraya doğru taşınır", () => {
  // Eski sıra: 0 deneyim, 1 sıklık, 2 seviye, 3 süre, 4 hedef,
  //            5 tür, 6 sakatlık, 7 hareket, 8 uyku, 9 not.
  const legacy = [
    "Düzenli", "3–4 gün", "Orta seviye", "45 dakika", "Kas geliştirmek",
    "Kuvvet", "Diz", "Orta", "İyi", "Sabahları antrenman yapıyorum",
  ];
  const migrated = normalizeHistory(legacy);

  assert.equal(migrated.length, 15);
  assert.equal(migrated[QUESTION.goal], "Kas geliştirmek", "hedef kaybolmamalı");
  assert.equal(migrated[QUESTION.experience], "Düzenli");
  assert.equal(migrated[QUESTION.level], "Orta seviye");
  assert.equal(migrated[QUESTION.recentFrequency], "3–4 gün");
  assert.equal(migrated[QUESTION.sessionMinutes], "45 dakika");
  assert.equal(migrated[QUESTION.trainingStyles], "Kuvvet");
  assert.equal(migrated[QUESTION.injuries], "Diz");
  assert.equal(migrated[QUESTION.dailyMovement], "Orta");
  assert.equal(migrated[QUESTION.sleep], "İyi");
  assert.equal(migrated[QUESTION.freeNote], "Sabahları antrenman yapıyorum");
});

test("eski kayıtta olmayan haftalık uygunluk sıklıktan türetilir", () => {
  // Boş bırakmak planı varsayılan güne düşürür; en yakın bilgi son 3 aydır.
  const legacy = ["Düzenli", "5+ gün", "İleri seviye", "60 dakika", "Güçlenmek", "", "", "", "", ""];
  assert.equal(normalizeHistory(legacy)[QUESTION.availableDays], "5+ gün");
});

test("yeni sorular eski kayıtta boş kalır", () => {
  const legacy = Array(10).fill("x");
  const migrated = normalizeHistory(legacy);
  assert.equal(migrated[QUESTION.motivation], "", "yeni soru uydurulmamalı");
  assert.equal(migrated[QUESTION.barrier], "");
});

test("güncel uzunluktaki kayıt olduğu gibi korunur", () => {
  const current = Array.from({ length: 15 }, (_, index) => `cevap-${index}`);
  assert.deepEqual(normalizeHistory(current), current);
});

test("bozuk veya eksik veri güvenli biçimde ele alınır", () => {
  assert.deepEqual(normalizeHistory(null), emptyHistory());
  assert.deepEqual(normalizeHistory("metin"), emptyHistory());
  assert.deepEqual(normalizeHistory([]), emptyHistory());
  assert.equal(normalizeHistory([1, 2, 3]).length, 15, "sayılar boş dizeye çevrilmeli");
  assert.equal(normalizeHistory(Array(30).fill("x")).length, 15, "fazlası kırpılmalı");
});

test("test yalnız zorunlu cevaplar dolunca tamamlanmış sayılır", () => {
  const history = emptyHistory();
  assert.equal(isHistoryComplete(history), false);
  history[QUESTION.goal] = "Kilo vermek";
  history[QUESTION.level] = "Yeni başlıyorum";
  history[QUESTION.availableDays] = "3–4 gün";
  assert.equal(isHistoryComplete(history), false, "süre hâlâ eksik");
  history[QUESTION.sessionMinutes] = "30 dakika";
  assert.equal(isHistoryComplete(history), true);
});

test("serbest metin soruları seçenek listesi taşımaz", async () => {
  const tr = await readFile(new URL("../lib/i18n/dictionaries/tr.ts", import.meta.url), "utf8");
  const block = tr.slice(tr.indexOf("answerOptions:"), tr.indexOf("] as string[][]"));
  const lists = [...block.matchAll(/\[([^\]]*)\]/g)].map((match) => match[1].trim());
  assert.equal(lists.length, QUESTION_COUNT, `answerOptions ${QUESTION_COUNT} girdi içermeli, gelen ${lists.length}`);
  for (const index of FREE_TEXT_QUESTIONS) {
    assert.equal(lists[index], "", `serbest metin sorusunda seçenek var: ${index}`);
  }
});

test("her soru için metin ve seçenek girdisi vardır", async () => {
  for (const file of ["../lib/i18n/dictionaries/tr.ts", "../lib/i18n/dictionaries/en.ts"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const questions = source.slice(source.indexOf("historyQuestions:"), source.indexOf("] as string[],"));
    assert.equal([...questions.matchAll(/^\s*"/gm)].length, QUESTION_COUNT, `${file}: soru sayısı ${QUESTION_COUNT} olmalı`);
  }
});
