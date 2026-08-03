import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { QUESTION, SINGLE_SELECT_QUESTIONS } from "../lib/onboarding-questions.ts";

const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
const tr = await readFile(new URL("../lib/i18n/dictionaries/tr.ts", import.meta.url), "utf8");

test("gün, süre, seviye gibi ölçek soruları tek seçimlidir", () => {
  // "1-2 gün" ile "5+ gün" aynı anda doğru olamaz; kullanıcı gün seçerken
  // birden fazla şıkka basmak zorunda kalmamalı, bir tanesi yeterli olmalı.
  const expected = [
    QUESTION.goal, QUESTION.experience, QUESTION.level, QUESTION.recentFrequency,
    QUESTION.availableDays, QUESTION.sessionMinutes, QUESTION.dailyMovement, QUESTION.sleep,
  ];
  assert.deepEqual([...SINGLE_SELECT_QUESTIONS].sort((a, b) => a - b), expected.sort((a, b) => a - b));
});

test("gerçekten birden fazla doğru cevabı olan sorular çoklu seçimde kalır", () => {
  // Engel, ilgi alanı, ekipman ve sakatlık bölgesi tek kutuya sığmaz
  // (ör. hem bel hem diz ağrısı olabilir).
  for (const index of [QUESTION.barrier, QUESTION.trainingStyles, QUESTION.location, QUESTION.equipment, QUESTION.injuries]) {
    assert.ok(!SINGLE_SELECT_QUESTIONS.includes(index), `soru ${index} tek seçime alınmamalı`);
  }
});

test("tek seçimli soruda yeni cevap otomatik olarak sonraki soruya geçer", () => {
  const fn = app.slice(app.indexOf("function toggleAnswer(answer: string)"), app.indexOf("function setFreeAnswer"));
  assert.match(fn, /const isSingleSelect = SINGLE_SELECT_QUESTIONS\.includes\(questionIndex\);/);
  assert.match(fn, /const wasSelected = \(history\[questionIndex\] \|\| ""\)\.split\(" · "\)\.includes\(answer\);/);
  // Tek seçim bir radyo düğmesi: yeni şık öncekinin yerini alır.
  assert.match(fn, /next = selected\.includes\(answer\) \? \[\] : \[answer\];/);
  // Yalnız YENİ seçimde ilerler; aynı şıkka tekrar basıp geri çekmek ilerletmez.
  assert.match(fn, /if \(isSingleSelect && !wasSelected && questionIndex < QUESTION_COUNT - 1\)/);
  assert.match(fn, /setTimeout\(\(\) => setQuestionIndex\(\(index\) => index \+ 1\), 350\)/);
});

test("bekleyen otomatik ilerleme, soru değişince iptal edilir", () => {
  // Kullanıcı zamanlayıcı dolmadan elle Geri/Sonraki'ye basarsa, eski
  // zamanlayıcı kullanıcıyı beklenmedik biçimde ileri fırlatmamalı.
  assert.match(app, /useEffect\(\(\) => \(\) => \{ if \(autoAdvanceTimer\.current\) clearTimeout\(autoAdvanceTimer\.current\); \}, \[questionIndex\]\);/);
});

test("her soruda geri dönüş her zaman mevcuttur", () => {
  // Otomatik ilerleme tek seçimde manuel 'Sonraki' tıklamasını kaldırıyor;
  // bu yüzden 'Geri' her zaman çalışır ve önceki soruya döner.
  const questionBlock = app.slice(app.indexOf('step === STEP.test &&'), app.indexOf('step === STEP.building'));
  assert.match(questionBlock, /onClick=\{\(\) => questionIndex \? setQuestionIndex\(questionIndex - 1\) : setStep\(STEP\.photo\)\}/);
});

test("çoklu seçim ipucu yalnız çoklu seçimli sorularda gösterilir", () => {
  assert.match(app, /!SINGLE_SELECT_QUESTIONS\.includes\(questionIndex\) && <p className="multi-select-note">/);
});

test("ekipman ve sakatlıktaki dışlayıcı 'yok' cevapları diğerleriyle birlikte işaretlenemez", () => {
  assert.match(app, /const EXCLUSIVE_ANSWERS = new Set\(\["Yok", "Hiçbiri"\]\);/);
  // Ekipmanın "hiçbiri" cevabı, sözlükte tam bu kanonik metinle yazılmalı.
  const equipmentOptions = tr.match(/answerOptions: \[([\s\S]*?)\] as string\[\]\[\]/)?.[1] ?? "";
  const rows = [...equipmentOptions.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
  assert.match(rows[QUESTION.equipment], /"Hiçbiri"/);
  assert.match(rows[QUESTION.injuries], /"Yok"/);
});
