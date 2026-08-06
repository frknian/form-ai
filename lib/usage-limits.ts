import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "./supabase/url.ts";
import { bearerToken } from "./api-auth.ts";

export type UsageFeature = "chat" | "photo" | "text_nutrition" | "weekly_review" | "nutrition_advice";

const DAILY_LIMITS = {
  free: { chat: 5, photo: 1, text_nutrition: 3, weekly_review: 1, nutrition_advice: 5 },
  premium: { chat: 20, photo: 10, text_nutrition: 20, weekly_review: 3, nutrition_advice: 20 },
} as const;

export type UsageCheckResult = { allowed: boolean; used: number; limit: number };

/**
 * Günlük kullanım sınırını atomik biçimde kontrol eder ve izin varsa sayacı
 * bir artırır (bkz. db/migrations/20260726_usage_limits.sql —
 * increment_usage_counter). Sınır aşılmışsa sayaç ARTIRILMAZ.
 */
export async function checkAndConsumeUsage(request: Request, feature: UsageFeature): Promise<UsageCheckResult | { error: Response }> {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { error: Response.json({ error: "Kullanım sınırı servisi yapılandırılmamış." }, { status: 503 }) };
  }
  const token = bearerToken(request);
  if (!token) {
    return { error: Response.json({ error: "Bu işlem için giriş yapmalısın." }, { status: 401 }) };
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: profile, error: profileError } = await client.from("profiles").select("is_premium").maybeSingle();
  if (profileError && !isMissingInfrastructure(profileError)) {
    console.error("[usage-limits] profile lookup failed", profileError.code);
    return { error: Response.json({ error: "Kullanım sınırı kontrol edilemedi." }, { status: 500 }) };
  }
  if (profileError) return unlimited(feature, "profiles.is_premium");
  const isPremium = Boolean(profile?.is_premium);
  const limit = isPremium ? DAILY_LIMITS.premium[feature] : DAILY_LIMITS.free[feature];

  let { data, error } = await client.rpc("increment_usage_counter", { p_feature: feature, p_limit: limit }).single();
  // text_nutrition sayacı yeni sürümle eklendi. Üretim migration'ı henüz
  // uygulanmamış eski kurulumlarda fonksiyon "invalid feature" döndürür.
  // AI öğün analizini tamamen kilitlemek yerine geçici olarak mevcut chat
  // sayacını aynı (daha düşük) besin limitiyle kullanırız. Migration
  // uygulandığında ilk çağrı doğrudan ayrı sayaca geçer.
  if (feature === "text_nutrition" && error && isLegacyTextNutritionCounter(error)) {
    ({ data, error } = await client.rpc("increment_usage_counter", { p_feature: "chat", p_limit: limit }).single());
  }
  if (error && isMissingInfrastructure(error)) return unlimited(feature, "increment_usage_counter");
  if (error || !data) {
    console.error("[usage-limits] rpc failed", error?.code);
    return { error: Response.json({ error: "Kullanım sınırı kontrol edilemedi." }, { status: 500 }) };
  }
  const result = data as { allowed: boolean; current_count: number };
  return { allowed: result.allowed, used: result.current_count, limit };
}

// db/migrations/20260726_usage_limits.sql henüz uygulanmamışsa sütun/fonksiyon
// yoktur. Bu bir kullanıcı hatası değil, eksik bir kurulum adımıdır; sohbeti ve
// fotoğraf analizini tamamen kilitlemek yerine sınırsız çalıştırıp durumu
// sunucu günlüğüne yazıyoruz. Migration uygulandığı anda sınırlar kendiliğinden
// devreye girer — kod değişikliği gerekmez.
const MISSING_INFRA_CODES = new Set([
  "42883", // undefined_function
  "42P01", // undefined_table
  "42703", // undefined_column
  "PGRST202", // PostgREST: fonksiyon şema önbelleğinde yok
  "PGRST204", // PostgREST: sütun şema önbelleğinde yok
]);

function isMissingInfrastructure(error: { code?: string | null }) {
  return Boolean(error.code && MISSING_INFRA_CODES.has(error.code));
}

function isLegacyTextNutritionCounter(error: { code?: string | null; message?: string | null; details?: string | null }) {
  if (error.code && ["P0001", "23514", "22P02"].includes(error.code)) return true;
  return /invalid feature|usage_counters_feature_check/i.test(`${error.message || ""} ${error.details || ""}`);
}

function unlimited(feature: UsageFeature, missing: string): UsageCheckResult {
  console.warn(`[usage-limits] ${missing} bulunamadı; kullanım sınırı uygulanmıyor. db/migrations/20260726_usage_limits.sql çalıştırılmalı.`);
  return { allowed: true, used: 0, limit: Number.POSITIVE_INFINITY };
}

export function usageLimitExceeded(feature: UsageFeature, used: number, limit: number) {
  const featureLabel = feature === "chat"
    ? "AI koç mesajı"
    : feature === "photo"
      ? "fotoğrafla öğün analizi"
      : feature === "text_nutrition"
        ? "yazarak AI besin tahmini"
        : feature === "weekly_review"
          ? "haftalık AI değerlendirme"
          : "AI beslenme önerisi";
  return Response.json(
    {
      error: `Bugünkü ücretsiz ${featureLabel} sınırına ulaştın (${limit}/${limit}). Yarın tekrar deneyebilirsin.`,
      limitReached: true,
      feature,
      used,
      limit,
    },
    { status: 429 },
  );
}
