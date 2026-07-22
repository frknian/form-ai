import { coachModelCandidates, localCoachReply, type CoachMessage } from "@/lib/ai-coach";

export const runtime = "edge";

function safeMessages(value: unknown): CoachMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
    const text = typeof record.text === "string" ? record.text.trim().slice(0, 1_000) : "";
    return role && text ? [{ role, text }] : [];
  });
}

export async function POST(request: Request) {
  let payload: { messages?: unknown; context?: unknown };
  try {
    payload = await request.json() as { messages?: unknown; context?: unknown };
  } catch {
    return Response.json({ error: "Sohbet isteği okunamadı" }, { status: 400 });
  }

  const messages = safeMessages(payload.messages);
  if (!messages.length) return Response.json({ error: "Mesaj bulunamadı" }, { status: 400 });
  const question = messages.at(-1)?.text || "";
  const context = typeof payload.context === "string" ? payload.context.slice(0, 8_000) : "Profil bilgisi bulunmuyor.";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ text: localCoachReply(question), source: "fallback", notice: "AI bağlantısı yapılandırılmadığı için güvenli yerel yanıt gösteriliyor." });

  const systemInstruction = `Sen FİT.AI uygulamasının Türkçe konuşan kişisel fitness koçusun. Yanıtın en fazla 140 kelime, açık ve uygulanabilir olsun. Kullanıcının programını, seviyesini, ekipmanını, hedefini ve ağrı alanlarını dikkate al. Tıbbi tanı veya kesin sağlık iddiası üretme. Keskin ağrı, baş dönmesi, göğüs ağrısı veya yaralanma belirtisinde antrenmanı durdurmasını ve sağlık uzmanına başvurmasını söyle. Bağlamda olmayan kişisel veri uydurma.\n\nKULLANICI VE PROGRAM BAĞLAMI:\n${context}`;
  const contents = messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.text }] }));

  for (const model of coachModelCandidates(process.env.GEMINI_MODEL)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: systemInstruction }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 500 } }),
        signal: controller.signal,
      });
      if (!response.ok) {
        console.error("AI coach model error", model, response.status);
        continue;
      }
      const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join(" ").trim();
      if (text) return Response.json({ text, source: "gemini", model });
    } catch {
      // Sıradaki erişilebilir modele geçilir.
    } finally {
      clearTimeout(timeout);
    }
  }

  return Response.json({ text: localCoachReply(question), source: "fallback", notice: "AI servisi geçici olarak yanıt vermedi; güvenli yerel öneri gösteriliyor." });
}
