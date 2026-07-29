import assert from "node:assert/strict";
import test from "node:test";
import { kgToUnit, unitToKg, parseWeightInputToKg, kgToInputValue, formatWeight } from "../lib/units.ts";

test("kg ve lb arasında dönüşüm tutarlı ve tersine çevrilebilir", () => {
  assert.equal(kgToUnit(100, "kg"), 100);
  assert.ok(Math.abs(kgToUnit(100, "lb") - 220.462) < 0.01);
  assert.ok(Math.abs(unitToKg(220.462, "lb") - 100) < 0.01);
  assert.equal(unitToKg(50, "kg"), 50);
});

test("kullanıcı girdisi seçili birimden kg'a çevrilir", () => {
  assert.equal(parseWeightInputToKg("80", "kg"), 80);
  assert.ok(Math.abs(parseWeightInputToKg("176", "lb") - 79.83) < 0.1);
  assert.equal(parseWeightInputToKg("", "kg"), null);
  assert.equal(parseWeightInputToKg("-5", "kg"), null);
  assert.equal(parseWeightInputToKg("abc", "lb"), null);
  assert.equal(parseWeightInputToKg("72,5", "kg"), 72.5);
});

test("kg değeri seçili birimde input metnine çevrilir", () => {
  assert.equal(kgToInputValue(80, "kg"), "80");
  assert.equal(kgToInputValue(null, "lb"), "");
  assert.equal(kgToInputValue(100, "lb"), "220.5");
});

test("formatWeight birim etiketiyle biçimlendirir ve boş değeri işaretler", () => {
  assert.equal(formatWeight(72, "kg"), "72 kg");
  assert.equal(formatWeight(null, "kg"), "—");
  assert.match(formatWeight(100, "lb"), /lb$/);
  assert.equal(formatWeight(80, "kg", { withUnit: false }), "80");
});
