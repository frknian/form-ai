const plannerRules = [
  "Yaş, cinsiyet, boy, kilo, hedef metni, ortam, ekipman, istenen hareketler ve 10 test cevabının her birini değerlendir.",
  "Programın hareket sayısını, setini, tekrarını ve dinlenmesini kullanıcının seviyesi ile ayırdığı süreye göre değiştir.",
  "Yalnızca kullanıcının ortamında ve ekipmanıyla uygulanabilen katalog hareketlerini seç.",
  "Ağrı veya sakatlık belirtilen tüm bölgeleri aynı anda kısıt kabul et; riskli hareketleri çıkar.",
  "Fotoğraf, BMI veya metinlerden tıbbi tanı ya da kesin yağ oranı çıkarma.",
  "Fotoğraf varsa yalnızca görünür duruş ve genel vücut dağılımına ilişkin yaklaşık, tanısal olmayan gözlem kullan.",
  "Isınma, ana bölüm, dinlenme, soğuma ve dört haftalık ilerleme önerisi üret.",
  "Önceki antrenmanların tamamlama oranı, algılanan zorluk, yorgunluk ve ağrı geri bildirimlerini birlikte değerlendir.",
  "Ağrı veya yüksek yorgunluk varsa yükü artırma; riskli hareketi daha güvenli bir katalog hareketiyle değiştir.",
  "En az iki kolay, düşük yorgunluklu ve yüzde 90 üzeri tamamlanan kayıt olmadan otomatik yük artışı yapma.",
];

const responseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    profileSummary: { type: "string" },
    rationale: { type: "string" },
    safetyNote: { type: "string" },
    analysis: {
      type: "object",
      properties: {
        experienceLevel: { type: "string" },
        weeklyFrequency: { type: "string" },
        sessionMinutes: { type: "integer" },
        primaryGoal: { type: "string" },
        intensity: { type: "string" },
        equipmentMode: { type: "string" },
        focusAreas: { type: "array", items: { type: "string" } },
        adaptations: { type: "array", items: { type: "string" } },
      },
      required: ["experienceLevel", "weeklyFrequency", "sessionMinutes", "primaryGoal", "intensity", "equipmentMode", "focusAreas", "adaptations"],
    },
    weeklySchedule: {
      type: "array",
      items: {
        type: "object",
        properties: { day: { type: "string" }, focus: { type: "string" }, durationMinutes: { type: "integer" } },
        required: ["day", "focus", "durationMinutes"],
      },
    },
    progression: { type: "array", items: { type: "string" } },
    workouts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          english: { type: "string" },
          area: { type: "string" },
          sets: { type: "integer", minimum: 1, maximum: 6 },
          reps: { type: "string" },
          restSeconds: { type: "integer", minimum: 20, maximum: 180 },
          instructions: { type: "string" },
        },
        required: ["name", "english", "area", "sets", "reps", "restSeconds", "instructions"],
      },
    },
  },
  required: ["title", "profileSummary", "rationale", "safetyNote", "analysis", "weeklySchedule", "progression", "workouts"],
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function profileSignals(payload: Record<string, unknown>) {
  const history = Array.isArray(payload.history) ? payload.history.map(text) : [];
  const durationMatch = history[3]?.match(/\d+/);
  const sessionMinutes = durationMatch ? Number(durationMatch[0]) : 30;
  const experience = history[2] || "Yeni başlıyorum";
  const goal = `${history[4] || ""} ${text(payload.goal)}`.toLocaleLowerCase("tr-TR");
  const primaryGoal = goal.includes("kilo") || goal.includes("yağ") ? "Kilo verme" : goal.includes("kas") ? "Kas geliştirme" : goal.includes("kondisyon") ? "Kondisyon" : "Güçlenme";
  const frequencyText = history[1] || "1–2 gün";
  const weeklyDays = frequencyText.includes("5+") ? 5 : frequencyText.includes("3–4") ? 3 : frequencyText.includes("0") ? 2 : 2;
  const beginner = /yeni|hayır|0 gün/i.test(`${experience} ${history[0] || ""}`);
  const intensity = beginner || history[7] === "Düşük" ? "Düşük-orta" : primaryGoal === "Kondisyon" ? "Orta-yüksek" : "Orta";
  const exerciseCount = sessionMinutes <= 15 ? 3 : sessionMinutes >= 60 ? 6 : sessionMinutes >= 45 ? 5 : 4;
  const setRange = beginner ? "2–3" : sessionMinutes >= 45 ? "3–4" : "3";
  const restRange = primaryGoal === "Kondisyon" || primaryGoal === "Kilo verme" ? "30–60 sn" : beginner ? "60–90 sn" : "75–120 sn";
  const raw = JSON.stringify({ age: payload.age, gender: payload.gender, height: payload.height, weight: payload.weight, environment: payload.environment, equipment: payload.equipment, goal: payload.goal, requestedExercises: payload.requestedExercises, history });
  const fingerprint = [...raw].reduce((hash, character) => (hash * 33 + character.charCodeAt(0)) % 1000003, 17).toString(36).toUpperCase();
  return { history, sessionMinutes, experience, primaryGoal, frequencyText, weeklyDays, intensity, exerciseCount, setRange, restRange, painAreas: history[6] || "Yok", movementLevel: history[7] || "Belirtilmedi", sleepQuality: history[8] || "Belirtilmedi", preferredStyle: history[5] || "Karışık", note: history[9] || "Yok", fingerprint };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "GEMINI_API_KEY tanımlı değil" }, { status: 503 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Profil verileri okunamadı" }, { status: 400 });
  }
  const photoDataUrl = typeof payload.photoDataUrl === "string" ? payload.photoDataUrl : null;
  const exerciseCatalog = Array.isArray(payload.exerciseCatalog) ? payload.exerciseCatalog : [];
  const profile = { ...payload };
  delete profile.photoDataUrl;
  delete profile.exerciseCatalog;
  const signals = profileSignals(payload);
  const trainingHistory = Array.isArray(payload.trainingHistory) ? payload.trainingHistory.slice(0, 8) : [];
  const adaptation = payload.adaptation && typeof payload.adaptation === "object" ? payload.adaptation : null;
  const prompt = `Sen güvenli ve kişiselleştirilmiş fitness programı hazırlayan bir asistansın. Aynı hazır programı herkese verme. Aşağıdaki ham verileri ve türetilmiş plan parametrelerini birlikte kullan.

HAM KULLANICI VERİLERİ:
${JSON.stringify(profile)}

10 TEST CEVABININ ANALİZİ:
${JSON.stringify(signals)}

ÖNCEKİ ANTRENMANLAR VE KULLANICI GERİ BİLDİRİMLERİ:
${JSON.stringify(trainingHistory)}

UYGULAMANIN GEÇMİŞTEN HESAPLADIĞI UYARLAMA KARARI:
${JSON.stringify(adaptation)}

BU PROFİL İÇİN ZORUNLU PLAN PARAMETRELERİ:
- Ana hedef: ${signals.primaryGoal}
- Deneyim: ${signals.experience}
- Haftalık sıklık: ${signals.weeklyDays} gün (${signals.frequencyText})
- Seans süresi: yaklaşık ${signals.sessionMinutes} dakika
- Hareket sayısı: ${signals.exerciseCount}
- Set aralığı: ${signals.setRange}
- Dinlenme aralığı: ${signals.restRange}
- Yoğunluk: ${signals.intensity}
- Ağrı/sakatlık kısıtları: ${signals.painAreas}
- Tercih: ${signals.preferredStyle}
- Günlük hareket: ${signals.movementLevel}
- Uyku: ${signals.sleepQuality}
- Serbest not: ${signals.note}
- Profil çeşitlilik anahtarı: ${signals.fingerprint}

UYGULAMADA KULLANILABİLEN HAREKET KATALOĞU:
${JSON.stringify(exerciseCatalog)}

GÜVENLİK VE KALİTE KURALLARI:
${plannerRules.join("\n")}

Tam olarak ${signals.exerciseCount} farklı hareket seç. Hareket adlarını katalogdaki Türkçe veya İngilizce adla birebir eşleştir. Kullanıcının özellikle istediği hareket güvenli ve ekipmanla uyumluysa programa al. Geçmiş kayıt varsa set, tekrar, dinlenme ve hareket değişimini bu kayıtlara dayandır. analysis.adaptations alanında bu profile ve geçmişe özel en az üç somut uyarlamayı; hangi geri bildirimin hangi değişime yol açtığını açıklayarak yaz. weeklySchedule alanında ${signals.weeklyDays} antrenman günü oluştur. progression alanında 1–4. haftalar için dört kısa ilerleme adımı yaz. Dış site, bağlantı veya medya URL'si üretme.`;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (photoDataUrl?.startsWith("data:image/")) {
    const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
  }

  const preferredModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const models = [...new Set([preferredModel, "gemini-3.5-flash", "gemini-3.1-flash-lite"])];
  let lastStatus = 0;
  let lastDetail = "";
  for (const model of models) {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.35 } }),
        signal: controller.signal,
      });
    } catch {
      lastDetail = controller.signal.aborted ? "Gemini yanıt süresi aşıldı" : "Gemini ağına erişilemedi";
      continue;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      lastStatus = response.status;
      lastDetail = (await response.text()).slice(0, 500);
      console.error("Gemini response error", model, response.status, lastDetail);
      if (![404, 429, 500, 503].includes(response.status)) break;
      continue;
    }
    const geminiPayload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const generatedText = geminiPayload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      lastDetail = "Gemini boş yanıt döndürdü";
      continue;
    }
    try {
      const result = JSON.parse(generatedText) as Record<string, unknown>;
      const workouts = Array.isArray(result.workouts) ? result.workouts : [];
      if (workouts.length < 3) {
        lastDetail = "Gemini yeterli hareket üretmedi";
        continue;
      }
      return Response.json({ ...result, profileFingerprint: signals.fingerprint, model });
    } catch {
      lastDetail = "Gemini yanıtı JSON formatında değil";
    }
  }

  return Response.json({ error: lastDetail || "Gemini program üretimi başarısız", detail: process.env.NODE_ENV === "development" ? `Durum: ${lastStatus} ${lastDetail}` : undefined }, { status: 502 });
}
