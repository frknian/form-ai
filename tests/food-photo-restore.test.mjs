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

const { markPendingFoodPhoto, hasPendingFoodPhoto, clearPendingFoodPhoto, storeCapturedFoodPhoto, readCapturedFoodPhoto, clearCapturedFoodPhoto } = await import("../lib/mobile.ts");
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
  assert.match(body, /if \(!result\.success \|\| !dataUrl\) return;/, "başarısız sonuç analize gitmemeli");
  assert.match(body, /storeCapturedFoodPhoto\(dataUrl\)/, "kurtarılan kare depoya da yazılmalı");
  assert.match(body, /clearPendingFoodPhoto\(\)/, "sonuç işlenince işaret kalkmalı");
});

test("beslenme ekranı dönüşte fotoğrafı karşılar ve adımı sabitler", () => {
  assert.match(tracker, /listenForRestoredFoodPhoto\(\(dataUrl\) => \{/);
  assert.match(tracker, /setChosenMethod\("photo"\)/, "analiz başlarken metin adımına atılmamalı");
  assert.match(tracker, /void analyzeRef\.current\(dataUrl\)/, "kurtarılan fotoğraf analize gitmeli");
});

test("saklanan kare beslenme sekmesi açılınca kendiliğinden analize girer", () => {
  // appRestoredResult gelmese de (mobil tarayıcıda böyle bir olay yok) kare
  // depodadır: ekran açılır açılmaz fotoğraf adımına dönülür ve analiz başlar.
  const restore = tracker.slice(tracker.indexOf("const stored = readCapturedFoodPhoto();"));
  assert.match(restore, /setChosenMethod\("photo"\)/);
  assert.match(restore, /setPhotoPreview\(stored\)/);
  assert.match(restore, /void analyzeRef\.current\(stored\)/);
  // Aynı kare iki kez analiz edilip kullanıcının hakkını yakmamalı.
  assert.match(restore, /analyzedPhoto\.current === stored/);
});

test("kare ağ isteğinden önce saklanır, başarısızlıkta durur", () => {
  const analyze = tracker.slice(tracker.indexOf("async function analyzeFoodPhoto"), tracker.indexOf("// Girdi seçili birimde okunur"));
  const store = analyze.indexOf("storeCapturedFoodPhoto(photoDataUrl);");
  const request = analyze.indexOf("/api/nutrition/analyze-photo");
  assert.ok(store > 0 && store < request, "kare istekten önce saklanmalı");
  // Yalnız BAŞARILI analizden sonra silinir; hata hâlinde yeniden denenebilir.
  assert.ok(analyze.indexOf("clearCapturedFoodPhoto();") > analyze.indexOf("photoAnalysisFailed"));
  assert.match(tracker, /async function retryPhotoAnalysis\(\)/);
  assert.match(tracker, /t\.calorieTracker\.retryPhotoAnalysis/);
});

test("mobil tarayıcıda da işaret konur", () => {
  // Sekme kamera açıkken tazelenirse kullanıcı ana ekranda uyanıyordu.
  const choose = tracker.slice(tracker.indexOf("async function chooseFoodPhoto"), tracker.indexOf("/** Aynı kareyi"));
  const mark = choose.indexOf("markPendingFoodPhoto();");
  assert.ok(mark > 0 && mark < choose.indexOf("isNativeApp()"), "işaret yerli/web ayrımından önce konmalı");
});

test("saklanan kare işareti süresi dolsa da bekleyen sayılır", () => {
  store.clear();
  assert.equal(hasPendingFoodPhoto(), false);
  storeCapturedFoodPhoto("data:image/jpeg;base64,AAAA");
  assert.equal(readCapturedFoodPhoto(), "data:image/jpeg;base64,AAAA");
  assert.equal(hasPendingFoodPhoto(), true, "kare dururken kullanıcı başka ekrana yönlendirilmemeli");
  clearCapturedFoodPhoto();
  assert.equal(hasPendingFoodPhoto(), false);
});

test("işaret zaman damgasıyla eskir", () => {
  store.clear();
  markPendingFoodPhoto();
  assert.equal(hasPendingFoodPhoto(), true);
  store.set("hedefit:pending-food-photo", String(Date.now() - 11 * 60_000));
  assert.equal(hasPendingFoodPhoto(), false, "eski işaret sekmeyi kilitlememeli");
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
