import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { classifyAuthFailure, parseAuthCallback } from "../lib/auth-callback.ts";

// Kullanıcının gerçekten aldığı adres: hata hem sorguda hem hash'te.
const REAL = {
  search: "?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+4%2F0A",
  hash: "#error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%253A+4%252F0A&sb=",
};

test("hata yalnızca hash'te olsa da okunur", () => {
  // Örtük akışta Supabase parametreleri hash'e koyar; yalnız sorguyu okumak
  // gerçek hatayı görünmez kılıp alakasız bir mesaj gösteriyordu.
  const params = parseAuthCallback("", "#error=access_denied&error_description=User+denied");
  assert.equal(params.error, "access_denied");
  assert.equal(params.errorDescription, "User denied");
});

test("sorgu dizesi hash'e göre önceliklidir", () => {
  const params = parseAuthCallback("?error=from_query", "#error=from_hash");
  assert.equal(params.error, "from_query");
});

test("gerçek Google takas hatası sağlayıcı sorunu olarak sınıflanır", () => {
  const params = parseAuthCallback(REAL.search, REAL.hash);
  assert.match(params.errorDescription, /Unable to exchange external code/);
  assert.equal(classifyAuthFailure(params), "provider-config");
});

test("bilinen sağlayıcı hata kodları da yakalanır", () => {
  for (const description of ["invalid_client", "invalid_grant", "redirect_uri_mismatch", "unauthorized_client"]) {
    const params = parseAuthCallback(`?error=server_error&error_description=${description}`, "");
    assert.equal(classifyAuthFailure(params), "provider-config", description);
  }
});

test("süresi dolmuş bağlantı sağlayıcı sorunu sayılmaz", () => {
  // Bunda "yeni bağlantı iste" doğru tavsiyedir; sağlayıcı hatasında değildir.
  const params = parseAuthCallback("?error=access_denied&error_description=Email+link+is+invalid+or+has+expired", "");
  assert.equal(classifyAuthFailure(params), "link-error");
});

test("hatasız dönüşte kod okunur ve failure üretilmez", () => {
  const params = parseAuthCallback("?code=abc123", "");
  assert.equal(params.code, "abc123");
  assert.equal(classifyAuthFailure(params), "none");
});

test("callback sayfası hem sorguyu hem hash'i okur", async () => {
  const source = await readFile(new URL("../app/auth/callback/page.tsx", import.meta.url), "utf8");
  assert.match(source, /parseAuthCallback\(window\.location\.search, window\.location\.hash\)/);
  // Eski, yalnız sorguyu okuyan hâline dönülmemeli.
  assert.doesNotMatch(source, /new URLSearchParams\(window\.location\.search\)/);
});
