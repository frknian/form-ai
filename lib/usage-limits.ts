import { createClient } from "@supabase/supabase-js";
import { bearerToken } from "./api-auth.ts";

export type UsageFeature = "chat" | "photo";

const DAILY_LIMITS = {
  free: { chat: 5, photo: 5 },
  premium: { chat: 15, photo: 10 },
} as const;

export type UsageCheckResult = { allowed: boolean; used: number; limit: number };

/**
 * Günlük kullanım sınırını atomik biçimde kontrol eder ve izin varsa sayacı
 * bir artırır (bkz. db/migrations/20260726_usage_limits.sql —
 * increment_usage_counter). Sınır aşılmışsa sayaç ARTIRILMAZ.
 */
export async function checkAndConsumeUsage(request: Request, feature: UsageFeature): Promise<UsageCheckResult | { error: Response }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
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

  const { data, error } = await client.rpc("increment_usage_counter", { p_feature: feature, p_limit: limit }).single();
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

function unlimited(feature: UsageFeature, missing: string): UsageCheckResult {
  console.warn(`[usage-limits] ${missing} bulunamadı; kullanım sınırı uygulanmıyor. db/migrations/20260726_usage_limits.sql çalıştırılmalı.`);
  return { allowed: true, used: 0, limit: Number.POSITIVE_INFINITY };
}

export function usageLimitExceeded(feature: UsageFeature, used: number, limit: number) {
  const featureLabel = feature === "chat" ? "sohbet sorusu" : "fotoğrafla besin ekleme";
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
