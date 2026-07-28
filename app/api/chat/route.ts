import { localCoachReply, type CoachMessage } from "../../../lib/ai-coach.ts";
import { authenticateRequest } from "../../../lib/api-auth.ts";
import { rateLimit, tooManyRequests } from "../../../lib/rate-limit.ts";
import { generateAiText, hasAiProvider, aiModelId } from "../../../lib/ai-provider.ts";
import { checkAndConsumeUsage, usageLimitExceeded } from "../../../lib/usage-limits.ts";

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
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const rateLimitResult = rateLimit(`chat:${auth.user.id}`, 20, 60_000);
  if (!rateLimitResult.ok) return tooManyRequests(rateLimitResult.retryAfterSeconds);

  let payload: { messages?: unknown; context?: unknown; locale?: unknown };
  try {
    payload = await request.json() as { messages?: unknown; context?: unknown; locale?: unknown };
  } catch {
    return Response.json({ error: "Sohbet isteği okunamadı" }, { status: 400 });
  }

  const locale = payload.locale === "en" ? "en" : "tr";
  const messages = safeMessages(payload.messages);
  if (!messages.length) return Response.json({ error: "Mesaj bulunamadı" }, { status: 400 });
  const question = messages.at(-1)?.text || "";
  const context = typeof payload.context === "string" ? payload.context.slice(0, 8_000) : "Profil bilgisi bulunmuyor.";
  if (!hasAiProvider()) return Response.json({ text: localCoachReply(question, locale), source: "fallback", notice: "AI bağlantısı yapılandırılmadığı için güvenli yerel yanıt gösteriliyor." });

  const usage = await checkAndConsumeUsage(request, "chat");
  if ("error" in usage) return usage.error;
  if (!usage.allowed) return usageLimitExceeded("chat", usage.used, usage.limit);

  const languageInstruction = locale === "en"
    ? "You are Fit Coach, FİT.AI's English-speaking personal fitness coach."
    : "Sen Fit Koç'sun; FİT.AI uygulamasının Türkçe konuşan kişisel fitness koçusun.";
  const systemInstruction = `${languageInstruction} Yanıtın en fazla 140 kelime, açık ve uygulanabilir olsun. Kullanıcının programını, seviyesini, ekipmanını, hedefini ve ağrı alanlarını dikkate al. Tıbbi tanı veya kesin sağlık iddiası üretme. Keskin ağrı, baş dönmesi, göğüs ağrısı veya yaralanma belirtisinde antrenmanı durdurmasını ve sağlık uzmanına başvurmasını söyle. Bağlamda olmayan kişisel veri uydurma.\n\nKULLANICI VE PROGRAM BAĞLAMI:\n${context}`;

  try {
    const text = await generateAiText({
      system: systemInstruction,
      messages: messages.map((message) => ({ role: message.role, content: message.text })),
      temperature: 0.35,
      maxOutputTokens: 500,
      abortSignal: AbortSignal.timeout(20_000),
    });
    if (text.trim()) return Response.json({
      text: text.trim(),
      source: "ai",
      model: aiModelId(),
      usage: { used: usage.used, limit: usage.limit },
    });
  } catch (error) {
    console.error("AI coach error", error);
  }

  return Response.json({ text: localCoachReply(question, locale), source: "fallback", notice: "AI servisi geçici olarak yanıt vermedi; güvenli yerel öneri gösteriliyor." });
}
