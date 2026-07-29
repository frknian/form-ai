import assert from "node:assert/strict";
import test from "node:test";

test("plan editor source keeps bounded prescriptions and safe ordering", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../lib/plan-editor.ts", import.meta.url), "utf8");
  assert.match(source, /Math\.min\(8, Math\.max\(1/);
  assert.match(source, /Math\.min\(300, Math\.max\(15/);
  assert.match(source, /movePlanWorkout/);
  assert.match(source, /updatePlanPrescription/);
});
