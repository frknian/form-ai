export const runtime = "edge";

const schema = { type: "object", properties: { name: { type: "string" }, calories: { type: "integer", minimum: 0 }, protein: { type: "number", minimum: 0 }, carbs: { type: "number", minimum: 0 }, fat: { type: "number", minimum: 0 } }, required: ["name", "calories", "protein", "carbs", "fat"] };

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Fotoğraf analizi yapılandırılmamış." }, { status: 503 });
  const { photoDataUrl } = await request.json().catch(() => ({})) as { photoDataUrl?: unknown };
  if (typeof photoDataUrl !== "string" || !photoDataUrl.startsWith("data:image/")) return Response.json({ error: "Geçerli bir yemek fotoğrafı gönderin." }, { status: 400 });
  const image = photoDataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!image || image[2].length > 7_000_000) return Response.json({ error: "Fotoğraf okunamadı veya çok büyük." }, { status: 400 });
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "Bu bir yemek fotoğrafı. Görünen toplam porsiyon için yaklaşık besin değerlerini Türkçe döndür. Belirsizlik varsa temkinli, tek bir makul tahmin ver. Tıbbi tavsiye veya kesinlik iddiası ekleme." }, { inline_data: { mime_type: image[1], data: image[2] } }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.15 } }), signal: AbortSignal.timeout(18_000) });
    if (!response.ok) throw new Error("ai unavailable");
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error("empty ai response");
    const result = JSON.parse(raw) as Record<string, unknown>;
    return Response.json({ name: typeof result.name === "string" ? result.name.slice(0, 120) : "Fotoğraftaki öğün", calories: Math.max(0, Math.round(Number(result.calories) || 0)), protein: Math.max(0, Number(result.protein) || 0), carbs: Math.max(0, Number(result.carbs) || 0), fat: Math.max(0, Number(result.fat) || 0) });
  } catch {
    return Response.json({ error: "Fotoğraf analizi şu an tamamlanamadı." }, { status: 502 });
  }
}
