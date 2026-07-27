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
  return response.headers.get("x-form-ai-proxy") !== "supabase"
    || !response.headers.get("content-type")?.toLocaleLowerCase("en-US").includes("application/json");
}

function sendAuthProxyRequest(url: URL, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method ?? "GET", url.href, true);
    xhr.responseType = "arraybuffer";
    xhr.withCredentials = init.credentials === "include";

    new Headers(init.headers).forEach((value, name) => {
      xhr.setRequestHeader(name, value);
    });

    xhr.onload = () => {
      const headers = new Headers();
      for (const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
        if (!line) continue;
        const separator = line.indexOf(":");
        if (separator === -1) continue;
        headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
      }

      const body = xhr.response?.byteLength ? xhr.response : null;
      resolve(new Response(body, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers,
      }));
    };
    xhr.onerror = () => reject(new TypeError("Kimlik doğrulama proxy bağlantısı kurulamadı."));
    xhr.ontimeout = () => reject(new TypeError("Kimlik doğrulama proxy isteği zaman aşımına uğradı."));
    xhr.timeout = 20_000;
    xhr.send((init.body as XMLHttpRequestBodyInit | null | undefined) ?? null);
  });
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
    const firstProxyResponse = await sendAuthProxyRequest(proxy.url, proxy.init);
    if (!isUnexpectedAuthResponse(firstProxyResponse)) return firstProxyResponse;

    // Geçici Cloudflare HTML hata sayfasına karşı aynı ArrayBuffer gövdesiyle
    // yalnızca bir kez daha deneriz; ReadableStream yeniden kullanılmaz.
    const retryProxyResponse = await sendAuthProxyRequest(proxy.url, proxy.init);
    if (!isUnexpectedAuthResponse(retryProxyResponse)) return retryProxyResponse;

    const contentType = retryProxyResponse.headers.get("content-type") ?? "bilinmiyor";
    throw new Error(
      `Kimlik doğrulama proxy doğrulaması başarısız `
      + `(HTTP ${retryProxyResponse.status}, ${contentType}, ${proxy.url.pathname}).`,
    );
  }

  return fetch(request);
}

export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key, { global: { fetch: resilientSupabaseFetch } });
}
