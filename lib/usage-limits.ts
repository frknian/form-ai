import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "./supabase/url.ts";
import { bearerToken } from "./api-auth.ts";

export type UsageFeature = "chat" | "photo";

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

  const { data, error } = await client.rpc("increment_usage_counter", { p_feature: feature }).single();
  if (error && isMissingInfrastructure(error)) {
    console.error("[usage-limits] secure usage RPC is missing", error.code);
    return { error: Response.json({ error: "Kullanım sınırı servisi yapılandırılmamış." }, { status: 503 }) };
  }
  if (error || !data) {
    console.error("[usage-limits] rpc failed", error?.code);
    return { error: Response.json({ error: "Kullanım sınırı kontrol edilemedi." }, { status: 500 }) };
  }
  const result = data as { allowed: boolean; current_count: number; effective_limit: number };
  if (!Number.isInteger(result.effective_limit) || result.effective_limit <= 0) {
    console.error("[usage-limits] secure usage RPC returned an invalid limit");
    return { error: Response.json({ error: "Kullanım sınırı kontrol edilemedi." }, { status: 500 }) };
  }
  return { allowed: result.allowed, used: result.current_count, limit: result.effective_limit };
}

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
