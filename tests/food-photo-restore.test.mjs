import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// localStorage, modül yüklenmeden önce kurulmalı: işaret oradan okunur.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => void store.set(key, String(value)),
  removeItem: (key) => void store.delete(key),
};

const { markPendingFoodPhoto, hasPendingFoodPhoto, clearPendingFoodPhoto } = await import("../lib/mobile.ts");
const mobileSource = await readFile(new URL("../lib/mobile.ts", import.meta.url), "utf8");
const tracker = await readFile(new URL("../components/CalorieTracker.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");

test("bekleyen fotoğraf işareti konur ve temizlenir", () => {
  store.clear();
  assert.equal(hasPendingFoodPhoto(), false);
  markPendingFoodPhoto();
  assert.equal(hasPendingFoodPhoto(), true);
  clearPendingFoodPhoto();
  assert.equal(hasPendingFoodPhoto(), false);
});

test("depolama kapalıysa işaret sessizce yok sayılır", () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error("kapalı"); }, setItem() { throw new Error("kapalı"); }, removeItem() { throw new Error("kapalı"); } };
  // Gizli sekmede/depolama kapalıyken kamera akışı çökmemeli.
  assert.doesNotThrow(() => markPendingFoodPhoto());
  assert.equal(hasPendingFoodPhoto(), false);
  assert.doesNotThrow(() => clearPendingFoodPhoto());
  globalThis.localStorage = original;
});

test("kamera açılmadan önce işaret konur, her durumda temizlenir", () => {
  // Android kamera öndeyken Activity'yi öldürebiliyor; dönüşte hangi ekrana
  // dönüleceğini yalnız bu işaret biliyor.
  const body = mobileSource.slice(mobileSource.indexOf("export async function takeFoodPhoto"));
  assert.match(body, /markPendingFoodPhoto\(\);\s*\n\s*try \{/, "çağrıdan önce işaretlenmeli");
  assert.match(body, /\} finally \{\s*\n\s*clearPendingFoodPhoto\(\);/, "vazgeçilse de temizlenmeli");
});

test("öldürülen süreçte kamera sonucu appRestoredResult ile kurtarılır", () => {
  // Activity öldürülürse takeFoodPhoto'nun sözü hiç çözülmez — JS bağlamı yok
  // olmuştur. Capacitor sonucu yeniden açılışta bir kez yayınlar.
  const body = mobileSource.slice(mobileSource.indexOf("export function listenForRestoredFoodPhoto"));
  assert.match(body, /App\.addListener\("appRestoredResult"/);
  assert.match(body, /result\.pluginId !== "Camera" \|\| result\.methodName !== "getPhoto"/, "yalnız kamera sonucu işlenmeli");
  // path yerel dosya yoludur; WebView'in okuyabilmesi için çevrilmeli.
  assert.match(body, /Capacitor\.convertFileSrc\(data\.path\)/);
  assert.match(body, /result\.success && dataUrl/, "başarısız sonuç analize gitmemeli");
  assert.match(body, /clearPendingFoodPhoto\(\)/, "sonuç işlenince işaret kalkmalı");
});

test("beslenme ekranı dönüşte fotoğrafı karşılar ve adımı sabitler", () => {
  assert.match(tracker, /listenForRestoredFoodPhoto\(\(dataUrl\) => \{/);
  assert.match(tracker, /setChosenMethod\("photo"\)/, "analiz başlarken metin adımına atılmamalı");
  assert.match(tracker, /void analyzeRef\.current\(dataUrl\)/, "kurtarılan fotoğraf analize gitmeli");
  // İşaret sonsuza dek kalıp sekmeyi kilitlemesin.
  assert.match(tracker, /setTimeout\(clearPendingFoodPhoto, 8_000\)/);
});

test("uygulama yeniden açılınca beslenme sekmesine dönülür", () => {
  assert.match(app, /const pendingFoodPhoto = usePendingFoodPhoto\(\);/);
  // İşaret analiz başlarken temizlendiği için yapışkan olmalı; aksi hâlde
  // kullanıcı tam o anda ana ekrana geri atılırdı.
  assert.match(app, /if \(pendingFoodPhoto\) sawPendingFoodPhoto\.current = true;/);
  assert.match(app, /chosenView \?\? \(sawPendingFoodPhoto\.current \? "nutrition" : "plan"\)/);
});

test("kurtarma mesajı iki dilde de tanımlı", async () => {
  const [tr, en] = await Promise.all([
    readFile(new URL("../lib/i18n/dictionaries/tr.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n/dictionaries/en.ts", import.meta.url), "utf8"),
  ]);
  assert.match(tr, /restoringPhoto: "/);
  assert.match(en, /restoringPhoto: "/);
  assert.match(tracker, /message \|\| t\.calorieTracker\.restoringPhoto/, "dönüşte ekran boş kalmamalı");
});
