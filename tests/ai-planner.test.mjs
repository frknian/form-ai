import assert from "node:assert/strict";
import test from "node:test";

import { POST, profileSignals } from "../app/api/generate-plan/route.ts";
import { extractSessionMinutes } from "../lib/training-profile.ts";

const scenarios = [
  {
    name: "24 yaşında, 180 cm erkek — dambılla kas geliştirme",
    payload: { age: 24, gender: "Erkek", height: 180, weight: 80, environment: "Evde", equipment: "Ayarlanabilir dambıl", goal: "Kas geliştirmek", history: ["Düzenli", "3–4 gün", "Orta seviye", "45 dakika", "Kas geliştirmek", "Kuvvet", "Yok", "Orta", "İyi", ""] },
    expected: { primaryGoal: "Kas geliştirme", weeklyDays: 3, exerciseCount: 5 },
  },
  {
    name: "23 yaşında, 170 cm ve 90 kg kadın — diz hassasiyetiyle kilo verme",
    payload: { age: 23, gender: "Kadın", height: 170, weight: 90, environment: "Evde", equipment: "", goal: "Kilo vermek", history: ["Hayır", "0 gün", "Yeni başlıyorum", "15 dakika", "Kilo vermek", "Kardiyo", "Diz", "Düşük", "Düzensiz", "Düşük etkili hareketler istiyorum"] },
    expected: { primaryGoal: "Kilo verme", weeklyDays: 2, exerciseCount: 3 },
  },
  {
    name: "30 yaşında, 175 cm ve 75 kg kullanıcı — salonda kas geliştirme",
    payload: { age: 30, gender: "Erkek", height: 175, weight: 75, environment: "Salon", equipment: "Full ekipman", goal: "Kas geliştirmek", history: ["Düzenli", "5+ gün", "İleri seviye", "60+ dakika", "Kas geliştirmek", "Kuvvet", "Yok", "Yüksek", "İyi", "Serbest ağırlıklara öncelik"] },
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

test("Gemini ana modeli başarısız olunca yedek modele geçer", { concurrency: false }, async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  const previousFetch = globalThis.fetch;
  const calls = [];
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "gecersiz-test-modeli";
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return new Response("geçici model hatası", { status: 503 });
    const generated = {
      title: "Test planı", profileSummary: "Test", rationale: "Test", safetyNote: "Test",
      analysis: { experienceLevel: "Yeni", weeklyFrequency: "1–2 gün", sessionMinutes: 30, primaryGoal: "Güç", intensity: "Düşük", equipmentMode: "Ekipmansız", focusAreas: ["Tüm vücut"], adaptations: ["A", "B", "C"] },
      weeklySchedule: [{ day: "Pazartesi", focus: "Tüm vücut", durationMinutes: 30 }], progression: ["1", "2", "3", "4"],
      workouts: [1, 2, 3, 4].map((index) => ({ name: `Hareket ${index}`, english: `Exercise ${index}`, area: "Core", sets: 3, reps: "10 tekrar", restSeconds: 60, instructions: "Kontrollü uygula." })),
    };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] });
  };

  try {
    const response = await POST(new Request("http://localhost/api/generate-plan", { method: "POST", body: JSON.stringify(scenarios[0].payload) }));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.model, "gemini-3.5-flash");
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = previousModel;
  }
});

test("anahtar veya ağ yokken anlaşılır ve güvenli hata döndürür", { concurrency: false }, async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  delete process.env.GEMINI_API_KEY;
  try {
    const missingKey = await POST(new Request("http://localhost/api/generate-plan", { method: "POST", body: "{}" }));
    assert.equal(missingKey.status, 503);
    assert.match((await missingKey.json()).error, /GEMINI_API_KEY/);

    process.env.GEMINI_API_KEY = "test-key";
    globalThis.fetch = async () => { throw new TypeError("network unavailable"); };
    const networkFailure = await POST(new Request("http://localhost/api/generate-plan", { method: "POST", body: JSON.stringify(scenarios[1].payload) }));
    assert.equal(networkFailure.status, 502);
    assert.match((await networkFailure.json()).error, /erişilemedi/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  }
});
