import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { EQUIPMENT_CHOICES, INJURY_CHOICES, formatChoices, parseChoices, toggleChoice } from "../lib/profile-choices.ts";
import { hasEquipment } from "../lib/equipment-match.ts";

test("çoklu seçim değerleri tek dizede saklanıp geri okunur", () => {
  assert.deepEqual(parseChoices(""), []);
  assert.deepEqual(parseChoices("Dambıl · Yoga matı"), ["Dambıl", "Yoga matı"]);
  assert.equal(formatChoices(["Dambıl", "Yoga matı"]), "Dambıl · Yoga matı");
});

test("dışlayıcı cevaplar diğerleriyle birlikte işaretlenemez", () => {
  // "Hiçbiri · Dambıl" kendisiyle çelişen bir değerdi ve plan üretimini
  // yanıltıyordu.
  assert.deepEqual(toggleChoice(["Dambıl", "Kettlebell"], "Hiçbiri"), ["Hiçbiri"]);
  assert.deepEqual(toggleChoice(["Hiçbiri"], "Dambıl"), ["Dambıl"]);
  assert.deepEqual(toggleChoice(["Bel", "Diz"], "Yok"), ["Yok"]);
  // Aynı seçeneğe tekrar basmak seçimi kaldırır.
  assert.deepEqual(toggleChoice(["Dambıl", "Yoga matı"], "Dambıl"), ["Yoga matı"]);
});

test("seçilen ekipman plan üretiminin okuduğu biçimde saklanır", () => {
  // Kaydedilen dize doğrudan hasEquipment'e gider; eşleşmezse kullanıcı
  // dambılını seçmiş olsa bile programda dambıl hareketi çıkmazdı.
  const stored = formatChoices(["Dambıl", "Yoga matı"]);
  assert.equal(hasEquipment(stored, "dambıl"), true);
  assert.equal(hasEquipment(stored, "band"), false);
  assert.equal(hasEquipment(formatChoices(["Direnç bandı"]), "band"), true);
  assert.equal(hasEquipment(formatChoices(["Salon ekipmanı"]), "salon"), true);
  // "Hiçbiri" hiçbir ekipmanı açmamalı.
  assert.equal(hasEquipment(formatChoices(["Hiçbiri"]), "dambıl"), false);
});

test("seçenekler profil testindeki yazımla birebir aynıdır", async () => {
  // İki yerde farklı yazım, aynı kavramı iki ayrı değerle saklardı.
  const tr = await readFile(new URL("../lib/i18n/dictionaries/tr.ts", import.meta.url), "utf8");
  const block = tr.slice(tr.indexOf("answerOptions:"), tr.indexOf("] as string[][]"));
  for (const choice of EQUIPMENT_CHOICES) assert.ok(block.includes(`"${choice}"`), `testte olmayan ekipman: ${choice}`);
  for (const choice of INJURY_CHOICES) assert.ok(block.includes(`"${choice}"`), `testte olmayan sakatlık: ${choice}`);
});

test("profil sayfası iki kutuya toplanır ve çıkış en altta durur", async () => {
  const source = await readFile(new URL("../components/ProfileManager.tsx", import.meta.url), "utf8");
  assert.match(source, /className="profile-box profile-training"/);
  assert.match(source, /className="profile-box profile-settings"/);
  // Tercihler, veriler, test, ilerleme ve hesap yönetimi tek kutuda.
  const settingsBox = source.slice(source.indexOf('className="profile-box profile-settings"'));
  for (const part of ["profile-preferences", "retake-test-zone", "progress-reset-zone", "account-danger-zone"]) {
    assert.ok(settingsBox.includes(part), `ayarlar kutusunda eksik: ${part}`);
  }
  // Çıkış düğmesi hesap kartından alınıp kutunun en altına taşındı.
  assert.match(source, /className="profile-signout"><button type="button" onClick=\{\(\) => void onSignOut\(\)\}/);
  const signOutIndex = source.indexOf('className="profile-signout"');
  assert.ok(signOutIndex > source.indexOf("account-danger-zone"), "çıkış en altta olmalı");
});

test("antrenman alanları şıklı sorulara çevrildi", async () => {
  const source = await readFile(new URL("../components/ProfileManager.tsx", import.meta.url), "utf8");
  // Hedef/ekipman/sakatlık artık serbest metin değil.
  assert.doesNotMatch(source, /t\.profileManager\.goalLabel/, "hedef hâlâ serbest metin");
  assert.doesNotMatch(source, /t\.profileManager\.equipmentLabel/, "ekipman hâlâ serbest metin");
  assert.match(source, /GOAL_PRESETS\.map/);
  assert.match(source, /EQUIPMENT_CHOICES\.map/);
  assert.match(source, /INJURY_CHOICES\.map/);
  // Yaş/boy/kilo hedefle birlikte okunur.
  assert.match(source, /t\.profileChoices\.bodyBody\(/);
});

test("sakatlık cevabı profil testiyle aynı yerde tutulur", async () => {
  // İki ayrı yere yazmak, plan üretiminin hangisini okuyacağını belirsizleştirirdi.
  const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
  assert.match(app, /injuryAnswer=\{history\[QUESTION\.injuries\] \|\| ""\}/);
  assert.match(app, /copy\[QUESTION\.injuries\] = next/);
});
