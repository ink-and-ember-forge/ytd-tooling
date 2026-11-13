// The changelog's detect/outdated rules are checked against the real frozen code in baseline/,
// so a rule that doesn't recognise old code (or flags current code) fails here, at release time.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { CHANGELOG } from "../src/changelog/index.js";
import { verifyAgainstBaselines } from "../src/changelog/verify.js";
import { loadBaseline, baselinePage } from "../src/lib/baseline.js";

// Every released version that has a baseline, as the page code a author would have pasted.
const baselines = {};
for (const rel of CHANGELOG.releases) {
  const b = await loadBaseline(rel.version);
  if (b) baselines[rel.version] = Object.values(baselinePage(b)).join("\n");
}

test("baselines load, and a version without one is null", async () => {
  assert.ok(await loadBaseline("3.1.1"));
  assert.equal(await loadBaseline("9.9.9"), null);
  assert.ok(Object.keys(baselines).length >= 3);
});

test("every changelog rule recognises the previous baseline and not the one that has the change", () => {
  const { problems, checked } = verifyAgainstBaselines(CHANGELOG, baselines);
  assert.deepEqual(problems, []);
  // Not vacuous: the 3.2.0 and 3.3.0 changes that have page-level rules were actually verified.
  for (const id of ["CHG-3.2.0-01", "CHG-3.2.0-02", "CHG-3.2.0-04", "CHG-3.2.0-05", "CHG-3.2.0-06", "CHG-3.3.0-02"]) {
    assert.ok(checked.includes(id), `${id} was not verified`);
  }
});

const withRule = (id, outdated) => ({
  releases: CHANGELOG.releases.map((r) => ({ ...r, changes: r.changes.map((c) => (c.id === id ? { ...c, outdated } : c)) })),
});

test("the verifier catches a rule that never recognises the old code", () => {
  // "." appears in any code, so the change is never reported as needed.
  const { problems } = verifyAgainstBaselines(withRule("CHG-3.3.0-02", { missing: ["."] }), baselines);
  assert.ok(problems.some((p) => p.startsWith("CHG-3.3.0-02: not reported as needed on the 3.2.0 baseline")), problems.join("\n"));
});

test("the verifier catches a rule that flags code which already has the change", () => {
  // "at-a-glance" appears in the current code too, so current pages would be flagged as outdated.
  const { problems } = verifyAgainstBaselines(withRule("CHG-3.3.0-02", { present: ["at-a-glance"] }), baselines);
  assert.ok(problems.some((p) => p.includes("CHG-3.3.0-02: reported as needed on the 3.3.0 baseline")), problems.join("\n"));
});
