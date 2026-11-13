// The close-up of one rule in the migration review: which elements actually look different, and what it says about them.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { compareReports, lookAt, summaryLine, probeFor } from "../src/ui/closeup.js";

const line = (vals, extra = {}) => ({ applies: true, measurable: true, vals, ...extra });
const report = (lines, n = lines[0].vals.length) => ({ n, desc: Array.from({ length: n }, (_, i) => `<p> “item ${i}”`), lines });
const labels = ["text weight", "text colour"];

test("closeup: only the elements whose rendered style differs are listed, with both values", () => {
  const t = report([line(["400", "400", "400"]), line(["black", "black", "black"])]);
  const y = report([line(["700", "400", "700"]), line(["black", "red", "black"])]);
  const c = compareReports(t, y, labels);
  assert.deepEqual(c.differing, [0, 1, 2]);
  assert.deepEqual(c.differ.get(1), [{ label: "text colour", template: "black", yours: "red" }]);
  assert.deepEqual(c.differ.get(0), [{ label: "text weight", template: "400", yours: "700" }]);
  assert.equal(summaryLine(c), "3 of the 3 elements look different.");
  assert.match(summaryLine(compareReports(t, report([line(["700", "400", "400"]), line(["black", "black", "black"])]), labels)), /^1 of the 3 elements look different\. The others already match the template/);
});

test("closeup: a rule that changes nothing you can see says so", () => {
  const same = report([line(["700", "700"])]);
  const c = compareReports(same, same, labels);
  assert.deepEqual(c.differing, []);
  assert.match(summaryLine(c), /^No visible difference on this page: the 2 elements look the same/);
  assert.match(lookAt("<b> “x”", []), /It looks the same either way\.$/);
});

test("closeup: a rule that matches nothing, or only hover and focus, or only another screen size, is said plainly", () => {
  assert.match(summaryLine(compareReports(report([line([])], 0), report([line([])], 0), labels)), /matches nothing on this page/);
  const hover = report([line(["a", "b"], { measurable: false })]);
  assert.match(summaryLine(compareReports(hover, hover, labels)), /hover or focus, which can't be shown here/);
  const small = report([line(["a"], { applies: false })]);
  assert.match(summaryLine(compareReports(small, small, labels)), /different screen size/);
});

test("closeup: a value is compared only where the rule touches the element", () => {
  const t = report([line(["400", null])]), y = report([line(["700", null])]);
  assert.deepEqual(compareReports(t, y, labels).differing, [0]);
});

test("closeup: what to look at is one sentence naming the element and both values (an unset value reads 'not set')", () => {
  assert.equal(lookAt("<strong> “Hi”", [{ label: "text weight", template: "", yours: "700" }]),
    "Looking at the <strong> “Hi”. text weight: the template gives not set, yours gives 700.");
});

test("closeup: the frame is told what to measure, with pseudo-elements kept and hover states marked unmeasurable", () => {
  const p = probeFor({ selectors: ["li"], lines: [
    { where: "ol li::marker", prop: "font-weight", label: "text weight", media: null },
    { where: "a:hover", prop: "color", label: "text colour", media: null },
    { where: ".x", prop: "gap", label: "gap", media: "@media (max-width: 600px)" },
  ] });
  assert.deepEqual(p.lines.map((l) => [l.sel, l.pseudo, l.measurable, l.media]), [["ol li", "::marker", true, null], ["a", null, false, null], [".x", null, true, "@media (max-width: 600px)"]]);
});
