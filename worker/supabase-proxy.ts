const PROXY_PREFIX = "/api/supabase-proxy/";
const SUPABASE_PROJECT_REF = "dqhsrabrbizwapkawmnf";
const ALLOWED_PREFIXES = ["auth/v1/", "rest/v1/", "storage/v1/", "functions/v1/"];
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-profile",
  "apikey",
  "authorization",
  "content-profile",
  "content-type",
  "prefer",
  "range",
  "x-client-info",
];
const FORWARDED_RESPONSE_HEADERS = [
  "cache-control",
  "content-range",
  "content-type",
  "location",
  "range-unit",
  "retry-after",
  "x-supabase-api-version",
];
const BODYLESS_STATUSES = new Set([101, 204, 205, 304]);

export async function handleSupabaseProxy(request: Request): Promise<Response | null> {
  const incomingUrl = new URL(request.url);
  if (!incomingUrl.pathname.startsWith(PROXY_PREFIX)) return null;

  if (request.headers.get("x-supabase-project-ref") !== SUPABASE_PROJECT_REF) {
    return Response.json({ error: "Unknown Supabase project." }, { status: 403 });
  }

  const pathname = incomingUrl.pathname.slice(PROXY_PREFIX.length);
  if (!ALLOWED_PREFIXES.some((prefix) => `${pathname}/`.startsWith(prefix))) {
    return Response.json({ error: "Unsupported Supabase endpoint." }, { status: 404 });
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const target = new URL(`/${pathname}${incomingUrl.search}`, `https://${SUPABASE_PROJECT_REF}.supabase.co`);
    // Buffer the incoming body instead of forwarding its ReadableStream.
    // Cloudflare and Safari-backed clients do not consistently support
    // streaming uploads for this proxy hop.
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });
    const responseHeaders = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("Cache-Control", "no-store");

    return new Response(BODYLESS_STATUSES.has(upstream.status) ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { code: 502, error_code: "upstream_unavailable", msg: "Authentication service is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
