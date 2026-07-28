import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { asSchema, generateObject, generateText, type FlexibleSchema, type ModelMessage } from "ai";

// Tek bir OpenAI-uyumlu uç nokta üzerinden çalışır. Bu sayede sağlayıcı
// (Moonshot/Kimi, OpenRouter, Together, Fireworks, kendi vLLM sunucunuz) veya
// model değiştirmek tek bir ortam değişkenidir; hiçbir route dosyası
// dokunulmaz. Gemini'ye özgü `responseSchema`/`inline_data` alanları burada
// OpenAI'nin standart `response_format`/`image_url` alanlarına çevrilir.
// Varsayılan: maliyet/kalite dengesi için Moonshot AI'nin Kimi K2.5 modeli.
// Öğün fotoğrafı analizi, GEMINI_API_KEY tanımlıysa ayrı ve daha ekonomik
// Gemini Flash-Lite sağlayıcısına yönlendirilir.
//
// Ortam değişkenleri modül yüklenirken DEĞİL, her çağrıda okunur — testlerde
// (ve bazı edge çalışma zamanlarında) modül bir kez yüklenip önbelleğe alınır;
// üst düzeyde okunsaydı `AI_API_KEY` sonradan tanımlansa bile hiç görülmezdi.
function hasAiProvider() {
  return Boolean(process.env.AI_API_KEY);
}

function aiModelId() {
  return process.env.AI_MODEL || "kimi-k2.5";
}

function photoAiModelId() {
  return process.env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite";
}

function languageModel() {
  const provider = createOpenAICompatible({
    name: process.env.AI_PROVIDER_NAME || "moonshot",
    baseURL: process.env.AI_BASE_URL || "https://api.moonshot.ai/v1",
    apiKey: process.env.AI_API_KEY,
    headers: {
      // OpenRouter'ın kontrol panelinde uygulamayı tanımlamak için önerdiği
      // isteğe bağlı başlıklar; Moonshot dahil diğer sağlayıcılarda zararsızca
      // yok sayılır.
      "HTTP-Referer": process.env.AI_SITE_URL || "https://form.ai",
      "X-Title": "form.ai",
    },
  });
  return provider.chatModel(aiModelId());
}

function geminiVisionModel() {
  const provider = createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: process.env.GEMINI_API_KEY,
    // Gemini 3.1 Flash-Lite JSON Schema tabanlı structured output destekler.
    supportsStructuredOutputs: true,
  });
  return provider.chatModel(photoAiModelId());
}

function hasPhotoAiProvider() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.AI_API_KEY);
}

export { hasAiProvider, hasPhotoAiProvider, aiModelId, photoAiModelId };

// K2.5 resmi Moonshot API'sinde varsayılan olarak düşünme modunda çalışır.
// Uygulamadaki kısa sohbet, plan ve besin ayrıştırma işleri için instant mod
// yeterlidir; gizli düşünme tokenlarını kapatmak maliyeti ve gecikmeyi azaltır.
// Başka bir OpenAI-uyumlu sağlayıcı kullanıldığında ona Moonshot'a özgü alan
// göndermemek için seçenek yalnızca resmi Moonshot uç noktasında eklenir.
function primaryProviderOptions() {
  const baseURL = process.env.AI_BASE_URL || "https://api.moonshot.ai/v1";
  if (!baseURL.includes("moonshot.ai") || !aiModelId().startsWith("kimi-k2.5")) return undefined;
  const providerName = process.env.AI_PROVIDER_NAME || "moonshot";
  return { [providerName]: { thinking: { type: "disabled" } } };
}

// Bazı modeller (ör. Kimi K3) sıcaklık parametresini hiç kabul etmez veya
// yalnızca tek bir sabit değeri (1) kabul eder; başka bir değer gönderildiğinde
// istek tamamen reddedilir. Model listesi elle tutulamayacak kadar geniş ve
// sürekli değiştiği için, "geçersiz sıcaklık" hatasını yakalayıp isteği
// sıcaklık olmadan (sağlayıcının kendi varsayılanıyla) bir kez daha deneriz.
// Böylece sağlayıcı/model değişse bile kod değişikliği gerekmez.
function isUnsupportedTemperatureError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /temperature/i.test(message);
}

async function withTemperatureFallback<T>(attempt: (useTemperature: boolean) => Promise<T>) {
  try {
    return await attempt(true);
  } catch (error) {
    if (!isUnsupportedTemperatureError(error)) throw error;
    return attempt(false);
  }
}

// Bazı modeller (ör. Kimi K3 — "always thinks", tamamen kapatılamaz) asıl
// yanıttan önce ayrı bir "reasoning" bütçesi tüketir ve bu bütçe de
// maxOutputTokens'a dahildir. Route'lardaki değerler (180–900) yalnızca
// GÖRÜNEN yanıt için düşünülmüştü; reasoning modelinde bu, düşünme payını
// tüketip asıl içeriğe hiç sıra bırakmadan sessizce boş sonuç döndürür (hata
// fırlatmaz). Bu yüksek tabanı yalnızca K3 ailesinde koruyoruz. K2.5 instant
// modunda route'un gerçek sınırını kullanmak gereksiz çıktı maliyetini önler.
function primaryMaxOutputTokens(requested?: number) {
  if (aiModelId().startsWith("kimi-k3")) return Math.max(requested ?? 0, 4_000);
  return requested ?? 1_000;
}

type ImageInput = { mimeType: string; base64: string };

function userContent(text: string, image?: ImageInput) {
  if (!image) return text;
  return [
    { type: "text" as const, text },
    { type: "file" as const, data: image.base64, mediaType: image.mimeType },
  ];
}

export type AiTextRequest = {
  system?: string;
  image?: ImageInput;
  maxOutputTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
} & ({ prompt: string; messages?: undefined } | { messages: ModelMessage[]; prompt?: undefined });

export async function generateAiText(request: AiTextRequest): Promise<string> {
  const { text } = await withTemperatureFallback((useTemperature) => generateText({
    model: languageModel(),
    system: request.system,
    ...(request.messages
      ? { messages: request.messages }
      : { prompt: [{ role: "user" as const, content: userContent(request.prompt, request.image) }] }),
    maxOutputTokens: primaryMaxOutputTokens(request.maxOutputTokens),
    temperature: useTemperature ? request.temperature : undefined,
    providerOptions: primaryProviderOptions(),
    abortSignal: request.abortSignal,
  }));
  return text;
}

export type AiObjectRequest<T> = {
  system?: string;
  prompt: string;
  image?: ImageInput;
  schema: FlexibleSchema<T>;
  maxOutputTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
};

// createOpenAICompatible() sağlayıcısı `supportsStructuredOutputs`'u
// belirtmediğimiz için varsayılan `false` kalır; bu da AI SDK'nın modele
// yalnızca `response_format: {type: "json_object"}` göndermesi anlamına
// gelir — bu, geçerli JSON SÖZDİZİMİni garanti eder ama alan adlarını
// (schema'yı) modele hiç iletmez. Sonuç: model kendi uydurduğu bir JSON
// şekli döndürebilir (gerçek bir Kimi K3 testinde doğrulandı). Çözüm:
// şemanın ham JSON Schema halini sistem promptuna açıkça ekleyip modele
// "bu alanları kullan" demek — her route'un promptunu elle yazmasına gerek
// kalmadan, tek yerden.
async function withSchemaInSystemPrompt(system: string | undefined, schema: FlexibleSchema<unknown>) {
  const jsonSchema = await asSchema(schema).jsonSchema;
  const instruction = `Yanıtını AŞAĞIDAKİ JSON şemasına harfiyen uyacak şekilde, tam olarak bu alan adlarıyla ver (başka alan uydurma, eksik bırakma):\n${JSON.stringify(jsonSchema)}`;
  return system ? `${system}\n\n${instruction}` : instruction;
}

export async function generateAiObject<T>(request: AiObjectRequest<T>): Promise<T> {
  const system = await withSchemaInSystemPrompt(request.system, request.schema);
  const { object } = await withTemperatureFallback((useTemperature) => generateObject({
    model: languageModel(),
    system,
    prompt: [{ role: "user", content: userContent(request.prompt, request.image) }],
    schema: request.schema,
    maxOutputTokens: primaryMaxOutputTokens(request.maxOutputTokens),
    temperature: useTemperature ? request.temperature : undefined,
    providerOptions: primaryProviderOptions(),
    abortSignal: request.abortSignal,
  }));
  return object;
}

export async function generatePhotoAiObject<T>(request: AiObjectRequest<T>): Promise<T> {
  if (!request.image) throw new TypeError("Photo AI requests require an image");
  if (!process.env.GEMINI_API_KEY) return generateAiObject(request);

  const system = await withSchemaInSystemPrompt(request.system, request.schema);
  try {
    const { object } = await generateObject({
      model: geminiVisionModel(),
      system,
      prompt: [{ role: "user", content: userContent(request.prompt, request.image) }],
      schema: request.schema,
      // Fotoğraf JSON'u küçük; Kimi için gerekli 4K düşünme tabanını maliyet
      // odaklı Gemini isteğine taşımıyoruz.
      maxOutputTokens: Math.max(request.maxOutputTokens ?? 0, 1_200),
      abortSignal: request.abortSignal,
    });
    return object;
  } catch (error) {
    // Gemini anahtarı/servisi geçici olarak sorunluysa çalışan görsel akışı
    // kesilmez; mevcut sağlayıcı yalnızca yedek olarak devreye girer.
    if (!hasAiProvider()) throw error;
    console.warn("[photo-ai] Gemini failed; falling back to the primary AI provider");
    return generateAiObject(request);
  }
}

// Bir data URL'sini ("data:image/jpeg;base64,...") ImageInput'a çevirir.
// Tüm route'lar aynı doğrulamayı tekrarlamasın diye burada.
export function parseImageDataUrl(dataUrl: string): ImageInput | null {
  const match = dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!match || match[2].length > 7_000_000) return null;
  return { mimeType: match[1], base64: match[2] };
}
