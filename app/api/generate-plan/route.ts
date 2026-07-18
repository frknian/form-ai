const plannerRules = [
  "Kullanıcının hedefini, seviyesini, ortamını, ekipman metnini, süre bilgisini, sağlık kısıtlarını ve 10 test cevabını birlikte değerlendir.",
  "Programda ısınma, ana bölüm, dinlenme ve soğuma önerisi bulunmalı.",
  "Fotoğraf, BMI veya metinlerden tıbbi tanı ve kesin yağ oranı çıkarma.",
  "Ağrı veya sakatlık varsa riskli hareketleri çıkar ve gerektiğinde sağlık uzmanına danışılmasını belirt.",
];
const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const responseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    rationale: { type: "string" },
    safetyNote: { type: "string" },
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
          restSeconds: { type: "integer", minimum: 30, maximum: 180 },
          instructions: { type: "string" },
        },
        required: ["name", "english", "area", "sets", "reps", "restSeconds", "instructions"],
      },
    },
  },
  required: ["title", "rationale", "safetyNote", "workouts"],
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "GEMINI_API_KEY tanımlı değil" }, { status: 503 });

  const payload = await request.json() as Record<string, unknown>;
  const photoDataUrl = typeof payload.photoDataUrl === "string" ? payload.photoDataUrl : null;
  const exerciseCatalog = Array.isArray(payload.exerciseCatalog) ? payload.exerciseCatalog : [];
  const profile = { ...payload };
  delete profile.photoDataUrl;
  delete profile.exerciseCatalog;
  const prompt = `Sen güvenli fitness programı hazırlayan bir asistansın. Aşağıdaki kullanıcı verilerine göre Türkçe, yapılandırılmış bir başlangıç programı oluştur.

KULLANICI VERİLERİ:
${JSON.stringify(profile)}

UYGULAMADA KULLANILABİLEN HAREKET KATALOĞU:
${JSON.stringify(exerciseCatalog)}

GÜVENLİK KURALLARI:
${plannerRules.join("\n")}

Yalnızca bu katalogda bulunan hareketleri seç. Kullanıcının ortamı ve ekipman metniyle uyuşmayan hareketleri seçme. Sakatlık veya ağrı alanı birden fazlaysa tüm alanları birlikte kısıt kabul et; riskli hareketleri çıkar. Fotoğraf veya BMI verisinden tıbbi tanı ya da kesin yağ oranı üretme. Programda 4-6 hareket olsun ve her harekete Türkçe açıklama ekle. Kullanıcının yaşını, boyunu, kilosunu, cinsiyetini, hedefini, ekipmanını, süre bilgisini, 10 test cevabını ve istediği hareketleri birlikte değerlendir; hiçbir alanı yok sayma. Kilo verme hedefinde uygun yoğunlukta kondisyon hareketlerine, kas geliştirme hedefinde direnç ve kas grubu dengesine, güç hedefinde temel kuvvet hareketlerine yer ver. Kullanıcı özellikle bir hareket adı girdiyse ve güvenli/uygunsa programda mutlaka göster. Her harekete uygulama içinde gösterilecek net bir hareket açıklaması ekle; dış site veya medya URL'si üretme.`;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (photoDataUrl?.startsWith("data:image/")) {
    const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
  }

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.2 },
      }),
    });
  } catch {
    return Response.json({ error: "Gemini ağına erişilemedi; yerel plan kullanılacak" }, { status: 503 });
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error("Gemini response error", response.status, detail.slice(0, 500));
    return Response.json({ error: "Gemini program üretimi başarısız", detail: process.env.NODE_ENV === "development" ? detail.slice(0, 500) : undefined }, { status: 502 });
  }
  const geminiPayload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = geminiPayload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return Response.json({ error: "Gemini boş yanıt döndürdü" }, { status: 502 });

  try {
    return Response.json(JSON.parse(text));
  } catch {
    return Response.json({ error: "Gemini yanıtı JSON formatında değil" }, { status: 502 });
  }
}
