import assert from "node:assert/strict";
import test from "node:test";
import { canPerformExercise, hasEquipment, usableEquipmentText } from "../lib/equipment-match.ts";

const dumbbellRow = { bodyweight: false, requires: ["dambıl"] };
const pushup = { bodyweight: true, requires: [] };
const legPress = { bodyweight: false, requires: ["leg press", "makine", "salon"] };

test("olumsuz cümlecik ekipman sayılmaz", () => {
  // Asıl hata buydu: "dambılım yok" ham metinde "dambıl" içerdiği için
  // dambıl hareketleri ekipmansız kullanıcının planına giriyordu.
  assert.equal(hasEquipment("dambılım yok", "dambıl"), false);
  assert.equal(hasEquipment("hiç ekipmanım yok", "dambıl"), false);
  assert.equal(hasEquipment("dambıl değil sadece mat", "dambıl"), false);
});

test("olumlu cümlecik ekipman sayılır", () => {
  assert.equal(hasEquipment("2 adet 5 kg dambıl", "dambıl"), true);
  assert.equal(hasEquipment("evde bir yoga matı ve dambıl var", "dambıl"), true);
});

test("karışık cümlede yalnız olumsuz kısım atılır", () => {
  // "dambıl var, bench yok" → dambıl evet, bench hayır.
  assert.equal(hasEquipment("dambıl var, bench yok", "dambıl"), true);
  assert.equal(hasEquipment("dambıl var, bench yok", "bench"), false);
});

test("İngilizce ve yaygın yanlış yazımlar eşleşir", () => {
  for (const text of ["2 dumbbells", "dumbell setim var", "elimde dumbel var"]) {
    assert.equal(hasEquipment(text, "dambıl"), true, text);
  }
  assert.equal(hasEquipment("direnç bandı", "band"), true);
  assert.equal(hasEquipment("lastik var", "band"), true);
});

test("boş ekipman hiçbir şeyle eşleşmez", () => {
  assert.equal(hasEquipment("", "dambıl"), false);
  assert.equal(hasEquipment("   ", "dambıl"), false);
  assert.equal(usableEquipmentText("hiçbir şey yok"), "");
});

test("evde ekipmansız kullanıcıya yalnız vücut ağırlığı verilir", () => {
  const options = { isGym: false, equipmentText: "dambılım yok" };
  assert.equal(canPerformExercise(pushup, options), true);
  assert.equal(canPerformExercise(dumbbellRow, options), false, "dambıl hareketi girmemeli");
  assert.equal(canPerformExercise(legPress, options), false);
});

test("salonda her hareket yapılabilir", () => {
  const options = { isGym: true, equipmentText: "" };
  assert.equal(canPerformExercise(legPress, options), true);
  assert.equal(canPerformExercise(dumbbellRow, options), true);
});

test("evde dambılı olan kullanıcı dambıl hareketi alır", () => {
  const options = { isGym: false, equipmentText: "iki tane 8 kg dambıl" };
  assert.equal(canPerformExercise(dumbbellRow, options), true);
  assert.equal(canPerformExercise(legPress, options), false, "salon makinesi eve girmemeli");
});
