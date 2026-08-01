import assert from "node:assert/strict";
import test from "node:test";

import { POST, profileSignals } from "../app/api/generate-plan/route.ts";
import { extractSessionMinutes, planProgressionBlock } from "../lib/training-profile.ts";
import { authorizedRequest, withAuthenticatedFetch, withSupabaseAuthEnv } from "./helpers/auth.mjs";
import { QUESTION, emptyHistory } from "../lib/onboarding-questions.ts";

// Cevaplar lib/onboarding-questions.ts'teki 15'lik sıraya göre kurulur.
// Sıra bilgisini teste elle gömmek yerine adlandırılmış indeksleri kullanıyoruz;
// şema değişirse test de sessizce yanlış alanı doldurmasın.
function history(answers) {
  const list = emptyHistory();
  for (const [key, value] of Object.entries(answers)) list[QUESTION[key]] = value;
  return list;
}

const scenarios = [
  {
    name: "24 yaşında, 180 cm erkek — dambılla kas geliştirme",
    payload: { age: 24, gender: "Erkek", height: 180, weight: 80, environment: "Evde", equipment: "Ayarlanabilir dambıl", goal: "Kas geliştirmek", history: history({
      goal: "Kas geliştirmek", experience: "Düzenli", level: "Orta seviye",
      recentFrequency: "3–4 gün", availableDays: "3–4 gün", sessionMinutes: "45 dakika",
      trainingStyles: "Kuvvet", injuries: "Yok", dailyMovement: "Orta", sleep: "İyi",
    }) },
    expected: { primaryGoal: "Kas geliştirme", weeklyDays: 3, exerciseCount: 5 },
  },
  {
    name: "23 yaşında, 170 cm ve 90 kg kadın — diz hassasiyetiyle kilo verme",
    payload: { age: 23, gender: "Kadın", height: 170, weight: 90, environment: "Evde", equipment: "", goal: "Kilo vermek", history: history({
      goal: "Kilo vermek", experience: "Hayır", level: "Yeni başlıyorum",
      recentFrequency: "0 gün", availableDays: "1–2 gün", sessionMinutes: "15 dakika",
      trainingStyles: "Kardiyo", injuries: "Diz", dailyMovement: "Düşük", sleep: "Düzensiz",
    }) },
    expected: { primaryGoal: "Kilo verme", weeklyDays: 2, exerciseCount: 3 },
  },
  {
    name: "30 yaşında, 175 cm ve 75 kg kullanıcı — salonda kas geliştirme",
    payload: { age: 30, gender: "Erkek", height: 175, weight: 75, environment: "Salon", equipment: "Full ekipman", goal: "Kas geliştirmek", history: history({
      goal: "Kas geliştirmek", experience: "Düzenli", level: "İleri seviye",
      recentFrequency: "5+ gün", availableDays: "5+ gün", sessionMinutes: "60+ dakika",
      trainingStyles: "Kuvvet", injuries: "Yok", dailyMovement: "Yüksek", sleep: "İyi",
    }) },
    expected: { primaryGoal: "Kas geliştirme", weeklyDays: 5, exerciseCount: 6 },
  },
];

test("üç farklı kullanıcı profilini farklı plan parametrelerine dönüştürür", () => {
  const fingerprints = new Set();
  for (const scenario of scenarios) {
    const signals = profileSignals(scenario.payload);
    assert.equal(signals.primaryGoal, scenario.expected.primaryGoal, scenario.name);
    assert.equal(signals.weeklyDays, scenario.expected.weeklyDays, scenario.name);
    assert.equal(signals.exerciseCount, scenario.expected.exerciseCount, scenario.name);
    fingerprints.add(signals.fingerprint);
  }
  assert.equal(fingerprints.size, scenarios.length, "her senaryo farklı analiz anahtarı üretmeli");
});

test("serbest metindeki gün sayısını antrenman süresi sanmaz", () => {
  assert.equal(extractSessionMinutes("Haftada 3 gün, 40 dakika ayırabilirim"), 40);
  assert.equal(extractSessionMinutes("Hafta sonu 1 saat"), 60);
  assert.equal(extractSessionMinutes("45"), 45);
});

// OpenAI-uyumlu sağlayıcının gerçek istek/yanıt şekli: POST {baseURL}/chat/completions,
// yanıt choices[0].message.content içinde JSON metni taşır. Hangi sağlayıcı/model
// seçilirse seçilsin (OpenRouter, Together, kendi vLLM sunucunuz) şekil aynıdır.
test("AI sağlayıcısı başarıyla plan üretir", { concurrency: false }, async () => {
  const previousKey = process.env.AI_API_KEY;
  const previousFetch = globalThis.fetch;
  const restoreAuthEnv = withSupabaseAuthEnv();
  const calls = [];
  process.env.AI_API_KEY = "test-key";
  globalThis.fetch = withAuthenticatedFetch(async (url) => {
    calls.push(String(url));
    const generated = {
      title: "Test planı", profileSummary: "Test", rationale: "Test", safetyNote: "Test",
      analysis: { experienceLevel: "Yeni", weeklyFrequency: "1–2 gün", sessionMinutes: 30, primaryGoal: "Güç", intensity: "Düşük", equipmentMode: "Ekipmansız", focusAreas: ["Tüm vücut"], adaptations: ["A", "B", "C"] },
      weeklySchedule: [{ day: "Pazartesi", focus: "Tüm vücut", durationMinutes: 30 }], progression: ["1", "2", "3", "4"],
      workouts: [1, 2, 3, 4].map((index) => ({ id: `ex-${index}`, name: `Hareket ${index}`, english: `Exercise ${index}`, area: "Core", sets: 3, reps: "10 tekrar", restSeconds: 60, instructions: "Kontrollü uygula." })),
    };
    return Response.json({ choices: [{ message: { role: "assistant", content: JSON.stringify(generated) } }] });
  });

  try {
    const response = await POST(authorizedRequest("http://localhost/api/generate-plan", { method: "POST", body: JSON.stringify(scenarios[0].payload) }));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.workouts.length, 4);
    assert.ok(calls.some((url) => url.includes("/chat/completions")));
  } finally {
    globalThis.fetch = previousFetch;
    restoreAuthEnv();
    if (previousKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previousKey;
  }
});

test("anahtar veya ağ yokken anlaşılır ve güvenli hata döndürür", { concurrency: false }, async () => {
  const previousKey = process.env.AI_API_KEY;
  const previousFetch = globalThis.fetch;
  const restoreAuthEnv = withSupabaseAuthEnv();
  globalThis.fetch = withAuthenticatedFetch(null);
  delete process.env.AI_API_KEY;
  try {
    const missingKey = await POST(authorizedRequest("http://localhost/api/generate-plan", { method: "POST", body: "{}" }));
    assert.equal(missingKey.status, 503);
    assert.match((await missingKey.json()).error, /AI_API_KEY/);

    process.env.AI_API_KEY = "test-key";
    globalThis.fetch = withAuthenticatedFetch(async () => { throw new TypeError("network unavailable"); });
    const networkFailure = await POST(authorizedRequest("http://localhost/api/generate-plan", { method: "POST", body: JSON.stringify(scenarios[1].payload) }));
    assert.equal(networkFailure.status, 502);
  } finally {
    globalThis.fetch = previousFetch;
    restoreAuthEnv();
    if (previousKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previousKey;
  }
});

test("kimliği doğrulanmamış plan isteği reddedilir", { concurrency: false }, async () => {
  const restoreAuthEnv = withSupabaseAuthEnv();
  try {
    const response = await POST(new Request("http://localhost/api/generate-plan", { method: "POST", body: "{}" }));
    assert.equal(response.status, 401);
  } finally {
    restoreAuthEnv();
  }
});

test("plan ilerleme blokları tamamlanan antrenmanla kademeli açılır", () => {
  // Yeni kullanıcı giriş bloğunda başlar.
  assert.equal(planProgressionBlock(0), 0);
  assert.equal(planProgressionBlock(2), 0);
  // Her eşik yalnızca tek bir kademe ilerletir ve sırayı atlamaz.
  assert.equal(planProgressionBlock(3), 1);
  assert.equal(planProgressionBlock(6), 1);
  assert.equal(planProgressionBlock(7), 2);
  assert.equal(planProgressionBlock(11), 2);
  assert.equal(planProgressionBlock(12), 3);
  // Son blok tavan; sınırsız büyümez.
  assert.equal(planProgressionBlock(500), 3);
  // Monotonik olmalı: geçmiş arttıkça kademe hiçbir zaman gerilemez.
  let previous = 0;
  for (let sessions = 0; sessions <= 40; sessions += 1) {
    const block = planProgressionBlock(sessions);
    assert.ok(block >= previous, `${sessions} antrenmanda kademe geriledi`);
    previous = block;
  }
});
