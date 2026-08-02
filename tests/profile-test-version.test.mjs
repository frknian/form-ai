import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CURRENT_PROFILE_TEST_VERSION } from "../lib/onboarding-questions.ts";

const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../db/migrations/20260803_profile_test_version.sql", import.meta.url), "utf8");
const guide = await readFile(new URL("../docs/GELISTIRME.md", import.meta.url), "utf8");

test("kayıtlı kullanıcı eski sürümdeki testi tamamladıysa yeniden teste yönlendirilir", () => {
  // Yağ kaybını kilo vermeden ayıran değişiklikten sonra eski cevaplar farklı
  // yorumlanıyor; testi tamamlamış olmak artık tek başına yeterli değil,
  // sürüm de güncel olmalı.
  const loadBlock = app.slice(app.indexOf('setAccountStatus(profile.account_status'), app.indexOf("void loadProfile();"));
  assert.match(loadBlock, /const completedCurrentVersion = Number\(profile\.profile_test_version\) >= CURRENT_PROFILE_TEST_VERSION;/);
  assert.match(loadBlock, /setStep\(completedCurrentVersion \? STEP\.dashboard : STEP\.test\)/, "sürüm eskiyse STEP.test'e gitmeli, baştan onboarding değil");
});

test("test tamamlanınca güncel sürüm kaydedilir", () => {
  assert.match(app, /profile_test_version: CURRENT_PROFILE_TEST_VERSION/, "history_answers ile aynı yazımda sürüm de kaydedilmeli");
});

test("sürüm sabiti pozitif bir tam sayı", () => {
  assert.ok(Number.isInteger(CURRENT_PROFILE_TEST_VERSION) && CURRENT_PROFILE_TEST_VERSION >= 1);
});

test("migration idempotent ve mevcut kullanıcıları güvenli varsayılanla açar", () => {
  // default 0: mevcut hiçbir satırın sürümü CURRENT_PROFILE_TEST_VERSION'a
  // erişemez, yani migration çalıştığı anda TÜM kayıtlı kullanıcılar bir
  // sonraki açılışta teste yönlendirilir — bu değişikliğin asıl amacı.
  assert.match(migration, /add column if not exists profile_test_version integer not null default 0/);
  assert.ok(0 < CURRENT_PROFILE_TEST_VERSION, "varsayılan güncel sürümden küçük olmalı, yoksa kimse yönlendirilmez");
});

test("veritabanı kurulum rehberi yeni migration'ı da kapsar", () => {
  // Belge tek tek dosya adı saymıyor, db/migrations altındaki her şeyi tarih
  // sırasıyla çalıştırmayı söylüyor; yeni dosya bu genel talimatla kapsanır.
  assert.match(guide, /db\/migrations\/\*\.sql/);
});
