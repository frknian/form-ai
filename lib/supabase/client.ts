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

  return new Request(proxyUrl, {
    method: source.method,
    headers,
    body,
    credentials: source.credentials,
  });
}

function isUnexpectedAuthResponse(response: Response, pathname: string) {
  if (!pathname.startsWith("/auth/v1/")) return false;
  return !response.headers.get("content-type")?.toLocaleLowerCase("en-US").includes("application/json");
}

async function resilientSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof window === "undefined" || !configuredUrl) return fetch(input, init);

  const request = new Request(input, init);
  const configuredOrigin = new URL(configuredUrl).origin;
  const target = new URL(request.url);
  if (target.origin !== configuredOrigin) return fetch(request);

  const firstProxySource = request.clone();
  const retryProxySource = request.clone();
  try {
    return await fetch(request);
  } catch {
    const firstProxyResponse = await fetch(await proxiedRequest(firstProxySource, configuredUrl));
    if (!isUnexpectedAuthResponse(firstProxyResponse, target.pathname)) return firstProxyResponse;

    // Cloudflare ücretsiz Worker bazen JSON yerine geçici HTML hata sayfası üretebilir.
    // Supabase istemcisine HTML vermek yerine aynı isteği tek kez temiz gövdeyle yineleriz.
    const retryProxyResponse = await fetch(await proxiedRequest(retryProxySource, configuredUrl));
    if (!isUnexpectedAuthResponse(retryProxyResponse, target.pathname)) return retryProxyResponse;
    throw new Error("Kimlik doğrulama servisi geçici olarak yanıt veremedi. Lütfen tekrar dene.");
  }
}

export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key, { global: { fetch: resilientSupabaseFetch } });
}
