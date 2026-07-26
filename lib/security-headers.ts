// OWASP A05 – Security Misconfiguration: tüm yanıtlara eklenen tarayıcı savunma başlıkları.
// Tek kaynak: hem Cloudflare Worker girişinde hem de Next `headers()` yapılandırmasında kullanılır.

// CSP, tema betiği satır içi olduğu için script-src'de 'unsafe-inline' gerektirir;
// bu betik statik bir sabittir ve kullanıcı girdisi içermez.
export const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": contentSecurityPolicy,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
};

const BODYLESS_STATUSES = new Set([101, 204, 205, 304]);

/**
 * Yanıtı, güvenlik başlıkları eklenmiş yeni bir yanıtla değiştirir. Mevcut başlıklar ezilmez.
 * `noStore` yalnızca API yanıtları için kullanılır; statik varlıkların önbelleklenmesi bozulmaz.
 */
export function withSecurityHeaders(response: Response, options: { noStore?: boolean } = {}): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  if (options.noStore) headers.set("Cache-Control", "no-store");
  const body = BODYLESS_STATUSES.has(response.status) ? null : response.body;
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
