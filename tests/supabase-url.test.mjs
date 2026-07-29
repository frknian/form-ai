import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeSupabaseUrl } from "../lib/supabase/url.ts";

test("proje adresi origin'e indirgenir", () => {
  // Gerçekte yaşanan yanlış yapılandırma: panele OAuth callback adresi girilmişti.
  // Sunucu ham değeri kullandığı için getUser isteği
  // /auth/v1/callback/auth/v1/user adresine gidiyor ve GEÇERLİ jeton bile
  // "Oturum doğrulanamadı." ile reddediliyordu.
  assert.equal(normalizeSupabaseUrl("https://abc.supabase.co/auth/v1/callback"), "https://abc.supabase.co");
  assert.equal(normalizeSupabaseUrl("https://abc.supabase.co/"), "https://abc.supabase.co");
  assert.equal(normalizeSupabaseUrl("https://abc.supabase.co"), "https://abc.supabase.co");
  assert.equal(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1?x=1"), "https://abc.supabase.co");
});

test("geçersiz değer null döner, çağıran kapalı tarafa düşer", () => {
  assert.equal(normalizeSupabaseUrl(""), null);
  assert.equal(normalizeSupabaseUrl(undefined), null);
  assert.equal(normalizeSupabaseUrl(null), null);
  assert.equal(normalizeSupabaseUrl("bu-bir-url-degil"), null);
});

test("hiçbir sunucu dosyası proje adresini normalize etmeden okumaz", async () => {
  // Tek bir yerde unutmak, o uç noktada geçerli oturumları reddeder.
  const files = [
    "../lib/api-auth.ts",
    "../lib/usage-limits.ts",
    "../lib/nutrition-log.ts",
    "../app/api/account/delete/route.ts",
    "../app/api/account/reset-progress/route.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    for (const line of source.split("\n")) {
      if (!line.includes("process.env.NEXT_PUBLIC_SUPABASE_URL")) continue;
      assert.match(line, /normalizeSupabaseUrl\(process\.env\.NEXT_PUBLIC_SUPABASE_URL\)/, `${file}: ${line.trim()}`);
    }
  }
});
