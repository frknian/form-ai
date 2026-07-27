const ALLOWED_PREFIXES = ["auth/v1/", "rest/v1/", "storage/v1/", "functions/v1/"];
const SUPABASE_PROJECT_REF = "dqhsrabrbizwapkawmnf";
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

type RouteContext = { params: Promise<{ path: string[] }> };

async function forwardToSupabase(request: Request, context: RouteContext) {
  if (request.headers.get("x-supabase-project-ref") !== SUPABASE_PROJECT_REF) {
    return Response.json({ error: "Unknown Supabase project." }, { status: 403 });
  }
  const origin = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

  const { path } = await context.params;
  const pathname = path.join("/");
  if (!ALLOWED_PREFIXES.some((prefix) => `${pathname}/`.startsWith(prefix))) {
    return Response.json({ error: "Unsupported Supabase endpoint." }, { status: 404 });
  }

  const incomingUrl = new URL(request.url);
  const target = new URL(`/${pathname}${incomingUrl.search}`, origin);
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? null : await request.arrayBuffer(),
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
}

export const GET = forwardToSupabase;
export const POST = forwardToSupabase;
export const PUT = forwardToSupabase;
export const PATCH = forwardToSupabase;
export const DELETE = forwardToSupabase;
