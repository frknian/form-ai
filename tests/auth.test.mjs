import assert from "node:assert/strict";
import test from "node:test";
import { isVerifiedAuthUser } from "../lib/auth.ts";

test("yalnızca e-postası doğrulanmış kullanıcı uygulamaya alınır", () => {
  assert.equal(isVerifiedAuthUser(null), false);
  assert.equal(isVerifiedAuthUser({ id: "unverified", email_confirmed_at: undefined }), false);
  assert.equal(isVerifiedAuthUser({ id: "verified", email_confirmed_at: "2026-07-23T10:00:00.000Z" }), true);
});
