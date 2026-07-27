import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

async function proxiedRequest(source: Request, configuredUrl: string) {
  const target = new URL(source.url);
  const proxyUrl = new URL(`/api/supabase-proxy${target.pathname}${target.search}`, window.location.origin);
  const projectRef = new URL(configuredUrl).hostname.split(".")[0];
  const headers = new Headers(source.headers);
  headers.set("x-supabase-project-ref", projectRef);

  // Safari does not support uploading a ReadableStream request body. Buffering
  // keeps the fallback compatible across Safari, Chromium and WebViews.
  const body = source.method === "GET" || source.method === "HEAD"
    ? undefined
    : await source.arrayBuffer();

  return {
    url: proxyUrl,
    init: {
      method: source.method,
      headers,
      body,
      credentials: source.credentials,
    } satisfies RequestInit,
  };
}

function isUnexpectedAuthResponse(response: Response) {
  return !response.headers.get("content-type")?.toLocaleLowerCase("en-US").includes("application/json");
}

async function resilientSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof window === "undefined" || !configuredUrl) return fetch(input, init);

  const request = new Request(input, init);
  const configuredOrigin = new URL(configuredUrl).origin;
  const target = new URL(request.url);
  if (target.origin !== configuredOrigin) return fetch(request);

  // Kimlik doğrulama isteklerini doğrudan Supabase'e göndermeyi denemek Safari'de
  // gövde stream'ini bozabiliyor. Auth trafiği ilk denemeden itibaren yalnızca
  // aynı-origin proxy üzerinden gider.
  if (target.pathname.startsWith("/auth/v1/")) {
    const proxy = await proxiedRequest(request, configuredUrl);
    const firstProxyResponse = await fetch(proxy.url, proxy.init);
    if (!isUnexpectedAuthResponse(firstProxyResponse)) return firstProxyResponse;

    // Geçici Cloudflare HTML hata sayfasına karşı aynı ArrayBuffer gövdesiyle
    // yalnızca bir kez daha deneriz; ReadableStream yeniden kullanılmaz.
    const retryProxyResponse = await fetch(proxy.url, proxy.init);
    if (!isUnexpectedAuthResponse(retryProxyResponse)) return retryProxyResponse;

    const contentType = retryProxyResponse.headers.get("content-type") ?? "bilinmiyor";
    throw new Error(`Kimlik doğrulama proxy'si JSON döndürmedi (HTTP ${retryProxyResponse.status}, ${contentType}).`);
  }

  return fetch(request);
}

export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key, { global: { fetch: resilientSupabaseFetch } });
}
