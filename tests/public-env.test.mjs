import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// Cloudflare's CI build container has no .env file (it's gitignored, local-dev
// only), so NEXT_PUBLIC_* values must come from a committed source or the
// production client bundle silently ships with no Supabase config — exactly
// what happened before .env.production existed. This locks the file in place
// and keeps server-only secrets out of it.

test(".env.production carries the public config CI needs and nothing else", async () => {
  const contents = await readFile(new URL("../.env.production", import.meta.url), "utf8");
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"]) {
    assert.match(contents, new RegExp(`^${key}=\\S+`, "m"), `missing or empty: ${key}`);
  }
  // Anything without the NEXT_PUBLIC_ prefix here would be a server secret
  // committed to git by mistake.
  const assignments = contents.split("\n").filter((line) => /^[A-Z_]+=/.test(line));
  for (const line of assignments) {
    assert.match(line, /^NEXT_PUBLIC_/, `non-public key committed: ${line.split("=")[0]}`);
  }
});

test(".env.production is not blocked by the .env* gitignore rule", async () => {
  const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  assert.match(gitignore, /^\.env\*/m);
  assert.match(gitignore, /^!\.env\.production$/m);
});
