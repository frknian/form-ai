import assert from "node:assert/strict";
import test from "node:test";
import { checkAndConsumeUsage, usageLimitExceeded, daysBetweenWeekStarts, lastAiWeeklyReviewWeekStart } from "../lib/usage-limits.ts";
import { authorizedRequest, withAuthenticatedFetch, withSupabaseAuthEnv, TEST_TOKEN } from "./helpers/auth.mjs";

function withUsageFetch({ isPremium = false, allowed = true, currentCount = 1 } = {}) {
  return withAuthenticatedFetch((url) => {
    if (String(url).includes("/rest/v1/profiles")) {
      return Response.json({ is_premium: isPremium });
    }
    if (String(url).includes("/rpc/increment_usage_counter")) {
      return Response.json({ allowed, current_count: currentCount });
    }
    throw new TypeError(`beklenmeyen ağ isteği: ${url}`);
  });
}

test("ücretsiz kullanıcı için doğru günlük limit uygulanır", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withUsageFetch({ isPremium: false, allowed: true, currentCount: 3 });
  try {
    const request = authorizedRequest("http://localhost/x", { headers: { Authorization: `Bearer ${TEST_TOKEN}` } });
    const result = await checkAndConsumeUsage(request, "chat");
    assert.ok(!("error" in result));
    assert.deepEqual(result, { allowed: true, used: 3, limit: 5, isPremium: false });
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("ücretli kullanıcı için daha yüksek limit uygulanır", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withUsageFetch({ isPremium: true, allowed: true, currentCount: 8 });
  try {
    const request = authorizedRequest("http://localhost/x");
    const result = await checkAndConsumeUsage(request, "photo");
    assert.ok(!("error" in result));
    assert.deepEqual(result, { allowed: true, used: 8, limit: 10, isPremium: true });
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("eski veritabanında yazılı besin sayacı geçici olarak chat sayacına düşer", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  const requestedFeatures = [];
  globalThis.fetch = withAuthenticatedFetch((url, init) => {
    if (String(url).includes("/rest/v1/profiles")) return Response.json({ is_premium: false });
    if (String(url).includes("/rpc/increment_usage_counter")) {
      const body = JSON.parse(String(init?.body));
      requestedFeatures.push(body.p_feature);
      if (body.p_feature === "text_nutrition") {
        return Response.json({ code: "P0001", message: "invalid feature" }, { status: 400 });
      }
      return Response.json({ allowed: true, current_count: 2 });
    }
    throw new TypeError(`beklenmeyen ağ isteği: ${url}`);
  });
  try {
    const result = await checkAndConsumeUsage(authorizedRequest("http://localhost/x"), "text_nutrition");
    assert.deepEqual(requestedFeatures, ["text_nutrition", "chat"]);
    assert.deepEqual(result, { allowed: true, used: 2, limit: 3, isPremium: false });
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("sunucu limiti aştığını bildirdiğinde sayaç artırılmadığı gibi işaretlenir", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withUsageFetch({ isPremium: false, allowed: false, currentCount: 5 });
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

test("haftalık AI değerlendirme ücretsiz kullanıcı için düşük limitle sınırlanır", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withUsageFetch({ isPremium: false, allowed: false, currentCount: 1 });
  try {
    const request = authorizedRequest("http://localhost/x");
    const result = await checkAndConsumeUsage(request, "weekly_review");
    assert.ok(!("error" in result));
    assert.deepEqual(result, { allowed: false, used: 1, limit: 1, isPremium: false });
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("AI beslenme önerisi ücretli kullanıcı için daha yüksek limit uygular", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withUsageFetch({ isPremium: true, allowed: true, currentCount: 4 });
  try {
    const request = authorizedRequest("http://localhost/x");
    const result = await checkAndConsumeUsage(request, "nutrition_advice");
    assert.ok(!("error" in result));
    assert.deepEqual(result, { allowed: true, used: 4, limit: 20, isPremium: true });
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("iki hafta başlangıcı arasındaki gün farkı doğru hesaplanır", () => {
  assert.equal(daysBetweenWeekStarts("2026-07-06", "2026-07-13"), 7);
  assert.equal(daysBetweenWeekStarts("2026-07-13", "2026-07-06"), 7);
  assert.equal(daysBetweenWeekStarts("2026-07-06", "2026-07-20"), 14);
});

test("en son AI kaynaklı haftalık değerlendirmenin hafta başlangıcı sorgulanır", async () => {
  const restoreEnv = withSupabaseAuthEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = withAuthenticatedFetch((url) => {
    if (String(url).includes("/rest/v1/weekly_ai_reviews")) return Response.json([{ week_start: "2026-07-13" }]);
    throw new TypeError(`beklenmeyen ağ isteği: ${url}`);
  });
  try {
    const result = await lastAiWeeklyReviewWeekStart(authorizedRequest("http://localhost/x"));
    assert.equal(result, "2026-07-13");
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

function withRouteFetch({ isPremium = false, allowed = true, currentCount = 1, aiResponse }) {
  return withAuthenticatedFetch((url) => {
    if (String(url).includes("/rest/v1/profiles")) return Response.json({ is_premium: isPremium });
    if (String(url).includes("/rpc/increment_usage_counter")) return Response.json({ allowed, current_count: currentCount });
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
