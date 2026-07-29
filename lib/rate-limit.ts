type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Basit sabit pencereli hız sınırlayıcı (OWASP A04 – Insecure Design: sınırsız kaynak tüketimi).
 * Not: sayaç süreç/isolate belleğinde tutulur; çok örnekli dağıtımda üst sınır örnek başına uygulanır.
 * Bu, kötüye kullanımı ve maliyet patlamasını tek başına bitirmez ama önemli ölçüde yavaşlatır.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (buckets.size > MAX_TRACKED_KEYS) sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

export function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    { error: "Çok fazla istek gönderdin. Kısa bir süre sonra tekrar dene." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/** Kimliği doğrulanmamış uç noktalar için istemci ayrımı; proxy başlıklarına güvenilmez, yalnızca kabaca ayırır. */
export function clientKey(request: Request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "anonim";
}
