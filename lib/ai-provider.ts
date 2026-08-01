import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { asSchema, generateObject, generateText, type FlexibleSchema, type JSONValue, type ModelMessage } from "ai";

// Tek bir OpenAI-uyumlu uç nokta üzerinden çalışır. Bu sayede sağlayıcı
// (Moonshot/Kimi, OpenRouter, Together, Fireworks, kendi vLLM sunucunuz) veya
// model değiştirmek tek bir ortam değişkenidir; hiçbir route dosyası
// dokunulmaz. Gemini'ye özgü `responseSchema`/`inline_data` alanları burada
// OpenAI'nin standart `response_format`/`image_url` alanlarına çevrilir.
// Varsayılan: Moonshot AI'nin Kimi K3 modeli — native görsel girdi destekler,
// öğün/plan fotoğrafı için ayrı bir görsel modele gerek yoktur.
//
// Ortam değişkenleri modül yüklenirken DEĞİL, her çağrıda okunur — testlerde
// (ve bazı edge çalışma zamanlarında) modül bir kez yüklenip önbelleğe alınır;
// üst düzeyde okunsaydı `AI_API_KEY` sonradan tanımlansa bile hiç görülmezdi.
function hasAiProvider() {
  return Boolean(process.env.AI_API_KEY);
}

function aiModelId() {
  return process.env.AI_MODEL || "kimi-k3";
}

function languageModel(modelId = aiModelId()) {
  const provider = createOpenAICompatible({
    name: process.env.AI_PROVIDER_NAME || "moonshot",
    baseURL: process.env.AI_BASE_URL || "https://api.moonshot.ai/v1",
    apiKey: process.env.AI_API_KEY,
    headers: {
      // OpenRouter'ın kontrol panelinde uygulamayı tanımlamak için önerdiği
      // isteğe bağlı başlıklar; Moonshot dahil diğer sağlayıcılarda zararsızca
      // yok sayılır.
      "HTTP-Referer": process.env.AI_SITE_URL || "https://hedefit.app",
      "X-Title": "Hedefit",
    },
  });
  return provider.chatModel(modelId);
}

export { hasAiProvider, aiModelId };

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
// fırlatmaz). Bu yüzden route'ların istediği değerden bağımsız bir taban
// zorluyoruz; reasoning yapmayan modellerde zararsızdır (model kendi doğal
// bitiş noktasında durur, bu üst sınır yalnızca bir tavan).
const MIN_OUTPUT_TOKENS = 4_000;

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
  model?: string;
  minimumOutputTokens?: number;
  providerOptions?: Record<string, Record<string, JSONValue>>;
  maxOutputTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
} & ({ prompt: string; messages?: undefined } | { messages: ModelMessage[]; prompt?: undefined });

export async function generateAiText(request: AiTextRequest): Promise<string> {
  const { text } = await withTemperatureFallback((useTemperature) => generateText({
    model: languageModel(request.model),
    system: request.system,
    ...(request.messages
      ? { messages: request.messages }
      : { prompt: [{ role: "user" as const, content: userContent(request.prompt, request.image) }] }),
    maxOutputTokens: Math.max(request.maxOutputTokens ?? 0, request.minimumOutputTokens ?? MIN_OUTPUT_TOKENS),
    temperature: useTemperature ? request.temperature : undefined,
    providerOptions: request.providerOptions,
    abortSignal: request.abortSignal,
  }));
  return text;
}

export type AiObjectRequest<T> = {
  system?: string;
  prompt: string;
  image?: ImageInput;
  model?: string;
  minimumOutputTokens?: number;
  providerOptions?: Record<string, Record<string, JSONValue>>;
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
    model: languageModel(request.model),
    // AI SDK varsayılanı 2 yeniden deneme, yani 3 tam üretim. Bu sağlayıcının
    // akıl yürüten modellerinde tek üretim ~90 sn sürüyor; üç katı her zaman
    // zaman aşımına düşüyordu. Tek deneme, verilen bütçenin tamamını kullanır.
    maxRetries: 0,
    system,
    prompt: [{ role: "user", content: userContent(request.prompt, request.image) }],
    schema: request.schema,
    maxOutputTokens: Math.max(request.maxOutputTokens ?? 0, request.minimumOutputTokens ?? MIN_OUTPUT_TOKENS),
    temperature: useTemperature ? request.temperature : undefined,
    providerOptions: request.providerOptions,
    abortSignal: request.abortSignal,
  }));
  return object;
}

// Bir data URL'sini ("data:image/jpeg;base64,...") ImageInput'a çevirir.
// Tüm route'lar aynı doğrulamayı tekrarlamasın diye burada.
export function parseImageDataUrl(dataUrl: string): ImageInput | null {
  const match = dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!match || match[2].length > 7_000_000) return null;
  return { mimeType: match[1], base64: match[2] };
}
