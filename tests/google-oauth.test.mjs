import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// Google girişi iki yoldan çalışır:
//   • web: Google Identity Services düğmesi → NEXT_PUBLIC_GOOGLE_CLIENT_ID ile
//     alınan ID token, supabase.auth.signInWithIdToken'a verilir
//   • yerel/uygulama: signInWithOAuth → Supabase'in KENDİ panelindeki client
//
// Supabase, gelen ID token'ın `aud` alanını kendi yapılandırdığı client ile
// karşılaştırır. İki taraf farklı client kullanırsa token reddedilir. Bu yüzden
// tek bir client kullanmak zorundayız.
//
// Yaşanan hata: uygulamadaki client Google Cloud'dan silinmişti ve giriş
// "Hata 401: deleted_client" ile düşüyordu.
const SUPABASE_GOOGLE_CLIENT_ID = "755194872819-d98g7b27u8rhtipqdu962a6ehdijdku3.apps.googleusercontent.com";
const DELETED_CLIENT_ID = "755194872819-jkppcf6trvob6lqd10ksdput7gr4eimo.apps.googleusercontent.com";

test("uygulama, Supabase ile aynı Google client'ını kullanır", async () => {
  const env = await readFile(new URL("../.env.production", import.meta.url), "utf8");
  const match = env.match(/^NEXT_PUBLIC_GOOGLE_CLIENT_ID=(.+)$/m);
  assert.ok(match, "NEXT_PUBLIC_GOOGLE_CLIENT_ID tanımlı değil");
  const clientId = match[1].trim();
  assert.notEqual(clientId, DELETED_CLIENT_ID, "silinmiş client geri gelmiş (deleted_client hatası verir)");
  assert.equal(clientId, SUPABASE_GOOGLE_CLIENT_ID, "uygulama ile Supabase farklı client kullanıyor; ID token'ın aud'u eşleşmez");
});

test("client id yalnızca NEXT_PUBLIC_ olarak tutulur", async () => {
  // Client ID herkese açıktır (istemci paketine gömülür); Client Secret ise
  // yalnız Supabase panelinde durmalı, repoya hiç girmemeli.
  const env = await readFile(new URL("../.env.production", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    assert.match(line, /^NEXT_PUBLIC_/, `.env.production gizli anahtar taşıyor olabilir: ${line.split("=")[0]}`);
  }
  assert.doesNotMatch(env, /CLIENT_SECRET/i, "Client Secret repoya girmiş");
});
