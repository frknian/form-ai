import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function sameOriginSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof window === "undefined" || !configuredUrl) return fetch(input, init);

  const request = new Request(input, init);
  const configuredOrigin = new URL(configuredUrl).origin;
  const target = new URL(request.url);
  if (target.origin !== configuredOrigin) return fetch(request);

  const proxyUrl = new URL(`/api/supabase-proxy${target.pathname}${target.search}`, window.location.origin);
  const projectRef = new URL(configuredUrl).hostname.split(".")[0];
  const proxyRequest = new Request(proxyUrl, request);
  proxyRequest.headers.set("x-supabase-project-ref", projectRef);
  return fetch(proxyRequest);
}

export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key, { global: { fetch: sameOriginSupabaseFetch } });
}
