import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkAndConsumeUsage, usageLimitExceeded } from "../lib/usage-limits.ts";
import { authorizedRequest, withAuthenticatedFetch, withSupabaseAuthEnv, TEST_TOKEN } from "./helpers/auth.mjs";

function withUsageFetch({ allowed = true, currentCount = 1, effectiveLimit = 5 } = {}) {
  return withAuthenticatedFetch((url) => {
    if (String(url).includes("/rpc/increment_usage_counter")) {
      return Response.json({ allowed, current_count: currentCount, effective_limit: effectiveLimit });
    }
    throw new TypeError(`beklenmeyen ağ isteği: ${url}`);
  });
}

test("ücretsiz kullanıcı için doğru günlük limit uygulanır", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withUsageFetch({ allowed: true, currentCount: 3, effectiveLimit: 5 });
  try {
    const request = authorizedRequest("http://localhost/x", { headers: { Authorization: `Bearer ${TEST_TOKEN}` } });
    const result = await checkAndConsumeUsage(request, "chat");
    assert.ok(!("error" in result));
    assert.deepEqual(result, { allowed: true, used: 3, limit: 5 });
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("ücretli kullanıcı için daha yüksek limit uygulanır", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withUsageFetch({ allowed: true, currentCount: 8, effectiveLimit: 10 });
  try {
    const request = authorizedRequest("http://localhost/x");
    const result = await checkAndConsumeUsage(request, "photo");
    assert.ok(!("error" in result));
    assert.deepEqual(result, { allowed: true, used: 8, limit: 10 });
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("sunucu limiti aştığını bildirdiğinde sayaç artırılmadığı gibi işaretlenir", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withUsageFetch({ allowed: false, currentCount: 5, effectiveLimit: 5 });
  try {
    const request = authorizedRequest("http://localhost/x");
    const result = await checkAndConsumeUsage(request, "chat");
    assert.ok(!("error" in result));
    assert.equal(result.allowed, false);
    const response = usageLimitExceeded("chat", result.used, result.limit);
    assert.equal(response.status, 429);
    const payload = await response.json();
    assert.equal(payload.limitReached, true);
    assert.match(payload.error, /5\/5/);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("jetonsuz istek Supabase'e hiç gitmeden reddedilir", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("beklenmeyen ağ isteği"); };
  try {
    const result = await checkAndConsumeUsage(new Request("http://localhost/x"), "chat");
    assert.ok("error" in result);
    assert.equal(result.error.status, 401);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("güvenli RPC eksikse kullanım sınırsız açılmaz", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withAuthenticatedFetch((url) => {
    if (String(url).includes("/rpc/increment_usage_counter")) {
      return Response.json(
        { code: "PGRST202", message: "function not found" },
        { status: 404 },
      );
    }
    throw new TypeError(`beklenmeyen ağ isteği: ${url}`);
  });
  try {
    const result = await checkAndConsumeUsage(authorizedRequest("http://localhost/x"), "chat");
    assert.ok("error" in result);
    assert.equal(result.error.status, 503);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("güvenlik migration'ı limiti ve premium yetkisini veritabanında belirler", async () => {
  const migration = await readFile(
    new URL("../db/migrations/20260728_security_definer_hardening.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /private\.user_entitlements/);
  assert.match(migration, /before insert or update on public\.profiles/);
  assert.match(migration, /increment_usage_counter\(p_feature text\)/);
  assert.match(migration, /effective_limit integer/);
  assert.match(migration, /p_limit is intentionally/);
  assert.match(migration, /account_is_active[\s\S]*security invoker/);
  assert.match(migration, /revoke all on function public\.record_workout_streak_activity\(\)[\s\S]*authenticated/);
});

function withRouteFetch({ allowed = true, currentCount = 1, effectiveLimit = 5, aiResponse }) {
  return withAuthenticatedFetch((url) => {
    if (String(url).includes("/rpc/increment_usage_counter")) {
      return Response.json({ allowed, current_count: currentCount, effective_limit: effectiveLimit });
    }
    if (String(url).includes("/chat/completions")) return Response.json(aiResponse);
    throw new TypeError(`beklenmeyen ağ isteği: ${url}`);
  });
}

test("sohbet günlük soru sınırına ulaşınca AI'ya hiç gitmeden 429 döner", { concurrency: false }, async () => {
  const previousKey = process.env.AI_API_KEY;
  const previousFetch = globalThis.fetch;
  const restoreAuthEnv = withSupabaseAuthEnv();
  process.env.AI_API_KEY = "test-key";
  globalThis.fetch = withRouteFetch({ allowed: false, currentCount: 5 });
  try {
    const { POST } = await import(`../app/api/chat/route.ts?test=${Date.now()}`);
    const response = await POST(authorizedRequest("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", text: "Bugün ne yapmalıyım?" }] }) }));
    assert.equal(response.status, 429);
    const payload = await response.json();
    assert.equal(payload.limitReached, true);
    assert.match(payload.error, /5\/5/);
  } finally {
    globalThis.fetch = previousFetch;
    restoreAuthEnv();
    if (previousKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previousKey;
  }
});

test("sınır altındayken sohbet yanıtı kullanım bilgisiyle birlikte döner", { concurrency: false }, async () => {
  const previousKey = process.env.AI_API_KEY;
  const previousFetch = globalThis.fetch;
  const restoreAuthEnv = withSupabaseAuthEnv();
  process.env.AI_API_KEY = "test-key";
  globalThis.fetch = withRouteFetch({ allowed: true, currentCount: 2, aiResponse: { choices: [{ message: { role: "assistant", content: "Bugün dinlenme günü, hafif bir yürüyüş yapabilirsin." } }] } });
  try {
    const { POST } = await import(`../app/api/chat/route.ts?test=${Date.now()}`);
    const response = await POST(authorizedRequest("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", text: "Bugün ne yapmalıyım?" }] }) }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.source, "ai");
    assert.deepEqual(payload.usage, { used: 2, limit: 5 });
  } finally {
    globalThis.fetch = previousFetch;
    restoreAuthEnv();
    if (previousKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previousKey;
  }
});

test("fotoğraf analizi günlük sınıra ulaşınca AI'ya hiç gitmeden 429 döner", { concurrency: false }, async () => {
  const previousKey = process.env.AI_API_KEY;
  const previousFetch = globalThis.fetch;
  const restoreAuthEnv = withSupabaseAuthEnv();
  process.env.AI_API_KEY = "test-key";
  globalThis.fetch = withRouteFetch({ allowed: false, currentCount: 5 });
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  try {
    const { POST } = await import(`../app/api/nutrition/analyze-photo/route.ts?test=${Date.now()}`);
    const response = await POST(authorizedRequest("http://localhost/api/nutrition/analyze-photo", { method: "POST", body: JSON.stringify({ photoDataUrl: `data:image/png;base64,${tinyPng}` }) }));
    assert.equal(response.status, 429);
    const payload = await response.json();
    assert.equal(payload.limitReached, true);
    assert.equal(payload.feature, "photo");
  } finally {
    globalThis.fetch = previousFetch;
    restoreAuthEnv();
    if (previousKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previousKey;
  }
});
