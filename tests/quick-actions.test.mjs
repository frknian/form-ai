import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_QUICK_ACTION_IDS, QUICK_ACTIONS, parseQuickActionIds, toggleQuickActionId } from "../lib/quick-actions.ts";

test("kısayol kataloğu tutarlıdır", () => {
  const ids = QUICK_ACTIONS.map((action) => action.id);
  assert.equal(new Set(ids).size, ids.length, "kimlikler benzersiz olmalı");
  for (const id of DEFAULT_QUICK_ACTION_IDS) assert.ok(ids.includes(id), `varsayılan katalogda yok: ${id}`);
});

test("bozuk veya bilinmeyen seçim varsayılana düşer", () => {
  assert.deepEqual(parseQuickActionIds(null), DEFAULT_QUICK_ACTION_IDS);
  assert.deepEqual(parseQuickActionIds("bu json değil"), DEFAULT_QUICK_ACTION_IDS);
  assert.deepEqual(parseQuickActionIds('{"a":1}'), DEFAULT_QUICK_ACTION_IDS);
  assert.deepEqual(parseQuickActionIds('["silinmis-kisayol"]'), DEFAULT_QUICK_ACTION_IDS);
});

test("geçerli seçim korunur ve tekilleştirilir", () => {
  assert.deepEqual(parseQuickActionIds('["calendar","library"]'), ["calendar", "library"]);
  assert.deepEqual(parseQuickActionIds('["calendar","calendar"]'), ["calendar"]);
});

test("açıp kapatma en az bir kısayol bırakır", () => {
  // Hepsi kapatılabilseydi ana ekranda boş bir şerit kalırdı.
  assert.deepEqual(toggleQuickActionId(["calendar"], "calendar"), ["calendar"]);
  assert.deepEqual(toggleQuickActionId(["calendar", "library"], "calendar"), ["library"]);
});

test("kapalı kısayol eklenir, üst sınır aşılmaz", () => {
  assert.deepEqual(toggleQuickActionId(["calendar"], "library"), ["calendar", "library"]);
  const six = QUICK_ACTIONS.slice(0, 6).map((action) => action.id);
  assert.deepEqual(toggleQuickActionId(six, QUICK_ACTIONS[6].id), six, "6'dan fazlası eklenmemeli");
});

test("kaydırma hedefleri yalnız gerçekten bölümü olan işlemlerde vardır", () => {
  const withAnchor = QUICK_ACTIONS.filter((action) => action.anchor);
  assert.ok(withAnchor.length >= 3);
  for (const action of withAnchor) assert.match(action.anchor, /^[a-z-]+$/);
});
