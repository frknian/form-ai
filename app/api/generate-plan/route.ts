import { fitnessPlannerRules, fitnessSources } from "@/lib/knowledge-sources";

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

  const profile = await request.json() as Record<string, unknown>;
  const sourceNotes = fitnessSources.map((source) => `${source.title}: ${source.notes.join("; ")}`).join("\n");
  const prompt = `Sen güvenli fitness programı hazırlayan bir asistansın. Aşağıdaki kullanıcı verilerine göre Türkçe, yapılandırılmış bir başlangıç programı oluştur.

KULLANICI VERİLERİ:
${JSON.stringify(profile)}

KAYNAK PRENSİPLERİ:
${sourceNotes}

GÜVENLİK KURALLARI:
${fitnessPlannerRules.join("\n")}

Yalnızca kullanıcının ortamında ve ekipmanında yapılabilecek hareketleri seç. Sakatlık veya ağrı belirtilmişse riskli hareketleri çıkar. Fotoğraf veya BMI verisinden tıbbi tanı ya da kesin yağ oranı üretme. Programda 4-6 hareket olsun ve her harekete Türkçe açıklama ekle.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.2 },
    }),
  });

  if (!response.ok) return Response.json({ error: "Gemini program üretimi başarısız" }, { status: 502 });
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return Response.json({ error: "Gemini boş yanıt döndürdü" }, { status: 502 });

  try {
    return Response.json(JSON.parse(text));
  } catch {
    return Response.json({ error: "Gemini yanıtı JSON formatında değil" }, { status: 502 });
  }
}
