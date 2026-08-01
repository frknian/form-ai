import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  SYNCED_PREFERENCE_KEYS,
  collectPreferences,
  planPreferenceSync,
  sanitizePreferences,
} from "../lib/preference-sync.ts";

const reader = (store) => (key) => (key in store ? store[key] : null);

test("yalnız dolu tercihler toplanır", () => {
  const bag = collectPreferences(reader({ "hedefit-theme": "dark", "hedefit:locale": "", "bilinmeyen": "x" }));
  assert.deepEqual(bag, { "hedefit-theme": "dark" });
});

test("uzaktan gelen veri süzülür", () => {
  // jsonb'ye elle yazılmış ya da eski sürümden kalmış her şey gelebilir.
  assert.deepEqual(sanitizePreferences({ "hedefit-theme": "dark", "kötü": "x", "fitai:weight-unit": 5 }), { "hedefit-theme": "dark" });
  assert.equal(sanitizePreferences(null), null);
  assert.equal(sanitizePreferences("metin"), null);
  assert.equal(sanitizePreferences(["a"]), null);
  assert.deepEqual(sanitizePreferences({}), {});
});

test("sunucuda kayıt yoksa yerel tercihler yukarı taşınır", () => {
  // İlk girişte localStorage'da birikmiş tercihler kaybolmamalı.
  const local = { "hedefit-theme": "dark", "fitai:weight-unit": "lb" };
  assert.deepEqual(planPreferenceSync(null, local), { applyLocal: {}, push: local });
});

test("hiç tercih yoksa boş satır yazılmaz", () => {
  assert.deepEqual(planPreferenceSync(null, {}), { applyLocal: {}, push: null });
});

test("uzaktaki değer kazanır", () => {
  // Telefonda koyu temaya geçildiyse web de koyu açılmalı.
  const plan = planPreferenceSync({ "hedefit-theme": "dark" }, { "hedefit-theme": "light" });
  assert.deepEqual(plan.applyLocal, { "hedefit-theme": "dark" });
  assert.equal(plan.push, null, "yalnız okuma yapılan durumda yazma tetiklenmemeli");
});

test("aynı değerler gereksiz yazma yaratmaz", () => {
  const same = { "hedefit-theme": "dark", "hedefit:locale": "tr" };
  assert.deepEqual(planPreferenceSync(same, same), { applyLocal: {}, push: null });
});

test("uzakta olmayan yerel tercih birleştirilip itilir", () => {
  // Yeni bir tercih eklendiğinde eski satır onu içermez; üzerine yazılmamalı.
  const plan = planPreferenceSync({ "hedefit-theme": "dark" }, { "hedefit:quick-actions": '["water"]' });
  assert.deepEqual(plan.applyLocal, { "hedefit-theme": "dark" });
  assert.deepEqual(plan.push, { "hedefit-theme": "dark", "hedefit:quick-actions": '["water"]' });
});

test("eşitlenen anahtarlar modüllerin gerçekten yazdığı anahtarlardır", async () => {
  // Bir anahtar yanlış yazılırsa o tercih sessizce cihaza özel kalırdı.
  const sources = await Promise.all(
    ["../lib/preferences.ts", "../lib/quick-actions.ts", "../lib/i18n/locale.ts", "../components/ThemeToggle.tsx"].map((file) =>
      readFile(new URL(file, import.meta.url), "utf8"),
    ),
  );
  const combined = sources.join("\n");
  for (const key of SYNCED_PREFERENCE_KEYS) {
    assert.ok(combined.includes(`"${key}"`), `hiçbir modül bu anahtarı kullanmıyor: ${key}`);
  }
});

test("her tercih yazıcısı eşitleme katmanını uyarır", async () => {
  // Uyarmayan bir yazıcı, değişikliği yalnız o cihazda bırakırdı.
  for (const file of ["../lib/preferences.ts", "../lib/quick-actions.ts", "../lib/i18n/locale.ts", "../components/ThemeToggle.tsx"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const setters = [...source.matchAll(/localStorage\.(setItem|removeItem)/g)].length;
    const notices = [...source.matchAll(/notifyPreferenceChange\(\)/g)].length;
    assert.ok(notices > 0, `${file}: notifyPreferenceChange çağrılmıyor`);
    assert.ok(setters > 0, `${file}: yazma bulunamadı, test anlamını yitirmiş`);
  }
});
