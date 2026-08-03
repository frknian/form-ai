import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const { targetPhotoDimensions, compressFoodPhoto, MAX_PHOTO_EDGE, MAX_PHOTO_CHARS } = await import("../lib/photo-compress.ts");
const tracker = await readFile(new URL("../components/CalorieTracker.tsx", import.meta.url), "utf8");

test("uzun kenar 1280'e iner, en-boy oranı korunur", () => {
  // 12 MP kamera karesi: küçültülmeden ne sunucuya sığar ne localStorage'a.
  assert.deepEqual(targetPhotoDimensions(4032, 3024), { width: 1280, height: 960 });
  assert.deepEqual(targetPhotoDimensions(3024, 4032), { width: 960, height: 1280 });
  assert.equal(MAX_PHOTO_EDGE, 1280);
});

test("zaten küçük olan kare büyütülmez", () => {
  assert.deepEqual(targetPhotoDimensions(800, 600), { width: 800, height: 600 });
  assert.deepEqual(targetPhotoDimensions(1280, 720), { width: 1280, height: 720 });
});

test("ölçüsüz kare reddedilir", () => {
  assert.equal(targetPhotoDimensions(0, 0), null);
  assert.equal(targetPhotoDimensions(Number.NaN, 100), null);
});

test("tarayıcı yokken sıkıştırma sessizce vazgeçer", async () => {
  // Sunucuda ya da testte document yoktur; çağrı çökmemeli, null dönmeli ki
  // çağıran özgün kareyle devam edebilsin.
  assert.equal(await compressFoodPhoto("data:image/jpeg;base64,AAAA"), null);
});

test("fotoğraf gönderilmeden önce küçültülür", () => {
  // Sunucu 7 MB üstü base64'ü reddediyordu: kullanıcı "fotoğraf gelmiyor"
  // diyordu, kamera da megabaytlarca veriyi taşıdığı için yavaştı.
  assert.match(tracker, /const compressed = await compressFoodPhoto\(file\);/, "dosya okunmadan önce küçültülmeli");
  assert.match(tracker, /rawPhotoDataUrl\.length > MAX_PHOTO_CHARS \? \(await compressFoodPhoto\(rawPhotoDataUrl\)\) \?\? rawPhotoDataUrl : rawPhotoDataUrl/, "kurtarılan/yerli kare de küçültülmeli");
  assert.ok(MAX_PHOTO_CHARS < 7_000_000, "sunucu sınırının altında kalmalı");
});

test("fotoğraftan sonra öğün ekleme alanına dönülür ve kayıt otomatik yazılır", () => {
  const analyze = tracker.slice(tracker.indexOf("async function analyzeFoodPhoto"), tracker.indexOf("// Girdi seçili birimde okunur"));
  assert.match(analyze, /getElementById\("food-entry-panel"\)\?\.scrollIntoView/, "ekran öğün ekleme alanına dönmeli");
  assert.match(analyze, /await addEntry\(\{\s*\n\s*name: result\.name,/, "analiz sonucu günlüğe yazılmalı");
  assert.match(analyze, /source: "Fotoğraf",/);
  assert.match(analyze, /t\.calorieTracker\.entryAdded/);
  // Kalori çıkmadıysa kayıt yazılmaz; kullanıcı elle düzeltebilsin.
  assert.match(analyze, /if \(\(result\.calories \|\| 0\) > 0\) \{/);
});
