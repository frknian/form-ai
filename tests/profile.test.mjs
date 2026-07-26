import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { birthdayPremiumAccess, calculateAge, isBirthday, isValidBirthDate, profileHistoryLabel } from "../lib/profile.ts";

test("yaşı doğum tarihinden ve kontrol tarihinden doğru hesaplar", () => {
  assert.equal(calculateAge("2000-07-22", new Date("2026-07-21T12:00:00Z")), 25);
  assert.equal(calculateAge("2000-07-22", new Date("2026-07-22T12:00:00Z")), 26);
  assert.equal(calculateAge("2000-02-30", new Date("2026-07-22T12:00:00Z")), null);
  assert.equal(isValidBirthDate("2030-01-01", new Date("2026-07-22T12:00:00Z")), false);
});

test("doğum günü premium bayrağı varsayılan olarak kapalı kalır", () => {
  const birthday = new Date("2026-07-22T12:00:00Z");
  assert.equal(isBirthday("2000-07-22", birthday), true);
  assert.equal(birthdayPremiumAccess("2000-07-22", { key: "birthday_premium_day", enabled: false, config: {} }, birthday), false);
  assert.equal(birthdayPremiumAccess("2000-07-22", { key: "birthday_premium_day", enabled: true, config: {} }, birthday), true);
});

test("profil tarihçesi alanları Türkçe ve anlaşılır etiketlenir", () => {
  assert.equal(profileHistoryLabel("weight_kg"), "Kilo");
  assert.equal(profileHistoryLabel("birth_date"), "Doğum tarihi");
  assert.equal(profileHistoryLabel("requested_exercises"), "İstenen hareketler");
});

test("profil yaşam döngüsü özel depolama, RLS ve güçlü silme doğrulaması içerir", async () => {
  const [component, route, migration, auth] = await Promise.all([
    readFile(new URL("../components/ProfileManager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/delete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/migrations/20260723_profile_lifecycle.sql", import.meta.url), "utf8"),
    readFile(new URL("../components/AuthScreen.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /birth_date/);
  assert.match(component, /deleteConfirmPhrase/);
  assert.match(component, /t\.profileManager\.freezeAccount/);
  assert.match(component, /profile-avatars/);
  assert.doesNotMatch(component, /DEĞİŞİKLİK GEÇMİŞİ|her doğum gününde otomatik güncellenir/);
  assert.match(route, /auth\.admin\.deleteUser/);
  assert.match(route, /SUPABASE_SECRET_KEY/);
  assert.match(migration, /birthday_premium_day', false/);
  assert.match(migration, /profile_history/);
  assert.match(migration, /account_is_active/);
  assert.doesNotMatch(migration, /public\.user_streaks/);
  assert.doesNotMatch(migration, /public\.activity_logs/);
  assert.match(migration, /public = false/);
});
