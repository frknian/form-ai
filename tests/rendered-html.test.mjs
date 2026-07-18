import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the form.ai fitness onboarding", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>form\.ai — Sana özel antrenman<\/title>/i);
  assert.match(html, /Vücudunu tanı,/i);
  assert.match(html, /Antrenmanım/);
  assert.match(html, /Hareket kütüphanesi/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});

test("keeps the AI plan and movement library wired into the product", async () => {
  const [page, route, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/generate-plan/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /HAZIR PROGRAMLAR/i);
  assert.match(page, /AI verileri taradı/);
  assert.match(page, /Nasıl yapılır/);
  assert.match(page, /Yerde Dambıl Göğüs Presi/);
  assert.ok((page.match(/^  \["/gm) ?? []).length >= 100, "exercise library should contain 100+ additional movements");
  assert.match(page, /toggleInjury/);
  assert.match(page, /personalizeAiWorkouts/);
  assert.match(page, /isExerciseSafeForProfile/);
  assert.match(page, /exerciseCatalog/);
  assert.match(page, /ExerciseAnimation/);
  assert.match(page, /setAiWorkouts\(\[\]\)/);
  assert.match(route, /gemini-3\.5-flash/);
  assert.match(route, /KULLANICI VERİLERİ/);
  assert.match(route, /UYGULAMADA KULLANILABİLEN HAREKET KATALOĞU/);
  assert.match(route, /photoDataUrl/);
  assert.match(layout, /form\.ai — Sana özel antrenman/);
  assert.doesNotMatch(page, /gymvisual|iframe/i);
  assert.doesNotMatch(page, /knowledge-sources|fitnessSources/);
  assert.doesNotMatch(route, /knowledge-sources|fitnessSources/);
});
