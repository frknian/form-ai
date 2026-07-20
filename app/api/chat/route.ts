import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

export const runtime = "edge";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "AI koç yapılandırılmamış" }, { status: 503 });

  let payload: { messages?: UIMessage[]; context?: string };
  try {
    payload = await request.json() as { messages?: UIMessage[]; context?: string };
  } catch {
    return Response.json({ error: "Sohbet isteği okunamadı" }, { status: 400 });
  }

  const messages = Array.isArray(payload.messages) ? payload.messages.slice(-12) : [];
  if (!messages.length) return Response.json({ error: "Mesaj bulunamadı" }, { status: 400 });
  const context = typeof payload.context === "string" ? payload.context.slice(0, 8_000) : "Profil bilgisi bulunmuyor.";
  const google = createGoogleGenerativeAI({ apiKey });

  const result = streamText({
    model: google(process.env.GEMINI_MODEL || "gemini-2.5-flash"),
    system: `Sen form.ai uygulamasının Türkçe konuşan kişisel fitness koçusun.

KULLANICI VE PROGRAM BAĞLAMI:
${context}

Kurallar:
- Yanıtlarını kısa, açık ve uygulanabilir Türkçe ile ver.
- Kullanıcının mevcut programını, seviyesini, ekipmanını, hedefini ve belirttiği ağrı bölgelerini dikkate al.
- Hareket adları yaygın İngilizce adıyla kalabilir; açıklamalar Türkçe olmalı.
- Tıbbi tanı, kesin yağ oranı, tedavi veya kesin kalori sonucu verme.
- Keskin ağrı, baş dönmesi, göğüs ağrısı veya yaralanma belirtisinde antrenmanı durdurmasını ve sağlık uzmanına başvurmasını söyle.
- Kullanıcı bağlamında bulunmayan kişisel veri uydurma.
- Programda değişiklik öneriyorsan nedenini ve güvenli alternatifi belirt.`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 700,
    temperature: 0.35,
  });

  return result.toUIMessageStreamResponse({
    onError: () => "AI koç yanıt üretirken bir sorun yaşadı. Lütfen yeniden dene.",
  });
}
