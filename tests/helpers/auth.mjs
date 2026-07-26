// Korumalı API rotalarını test ederken Supabase kimlik doğrulamasını taklit eden yardımcılar.
// Güvenlik kontrolü devre dışı bırakılmaz; yalnızca Supabase'in kullanıcı uç noktası taklit edilir.

export const TEST_TOKEN = "test-access-token";

export function withSupabaseAuthEnv() {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  return () => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  };
}

/** Supabase kullanıcı uç noktasını doğrulanmış kullanıcıyla yanıtlar, diğer istekleri devreder. */
export function withAuthenticatedFetch(passThrough) {
  return async (url, init) => {
    if (String(url).includes("/auth/v1/user")) {
      return Response.json({
        id: "00000000-0000-4000-8000-000000000001",
        aud: "authenticated",
        role: "authenticated",
        email: "test@example.com",
        email_confirmed_at: "2026-01-01T00:00:00.000Z",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
      });
    }
    if (!passThrough) throw new TypeError("beklenmeyen ağ isteği");
    return passThrough(url, init);
  };
}

export function authorizedRequest(url, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${TEST_TOKEN}`);
  return new Request(url, { ...init, headers });
}
