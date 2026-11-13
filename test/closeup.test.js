// The close-up of one rule in the migration review: which elements actually look different, and what it says about them.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { scanProbe, summariseScan, quietRules } from "../src/ui/scan.js";
import { compareReports, lookAt, summaryLine, probeFor, openedNote, frameHeight, roomFor, measuredSummary } from "../src/ui/closeup.js";

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

test("closeup: it says when it opened something to show the element", () => {
  assert.equal(openedNote([]), "");
  assert.equal(openedNote(['the accordion "Culture"']), 'It was inside the accordion "Culture", so that has been opened for you.');
  assert.match(openedNote(['the icon card "Info"', "a closed section"]), /the icon card "Info" and a closed section, so that has been opened/);
});

test("closeup: the frames take the room the slide has, stacked halves of it or all of it when flipped", () => {
  assert.equal(roomFor(900), 390);
  assert.equal(roomFor(500), 300, "never smaller than a readable minimum");
  assert.equal(frameHeight({ room: 390, stacked: true }), 195);
  assert.equal(frameHeight({ room: 390, stacked: false }), 390);
});

test("closeup: what was measured is kept as real values from the first element the rule changes", () => {
  const t = report([line(["900", "400", "400"]), line(["x", "y", "z"], { measurable: false })]);
  const y = report([line(["700", "400", "400"]), line(["x", "y", "z"], { measurable: false })]);
  const m = measuredSummary(compareReports(t, y, labels), t, y, labels);
  assert.equal(m.status, "differs");
  assert.equal(m.differing, 1);
  assert.deepEqual(m.lines[0], { label: "text weight", measurable: true, template: "900", yours: "700", differs: true });
  assert.equal(m.lines[1].measurable, false, "a hover rule has nothing measured");
  const same = report([line(["700", "700"])]);
  const s = measuredSummary(compareReports(same, same, labels), same, same, labels);
  assert.equal(s.status, "same");
  assert.deepEqual(s.lines[0], { label: "text weight", measurable: true, template: "700", yours: "700", differs: false });
  assert.equal(measuredSummary(compareReports(report([line([])], 0), report([line([])], 0), labels), report([line([])], 0), report([line([])], 0), labels).status, "none");
});

// ---- the scan of every rule before the review ---------------------------------------------------

const row = (id, label, selectors, lines) => ({ id, label, path: id, selectors, lines });
const ln = (where, label, media = null) => ({ where, label, prop: "x", media });
const rep = (lines) => ({ n: 3, desc: [], lines });
const frameSet = (t, y) => ({ template: rep(t), yours: rep(y) });

test("scan: every rule's lines go in one flat list, and each rule remembers where its lines are", () => {
  const rows = [row("a", "a", ["p"], [ln("p", "colour"), ln("p", "size")]), row("b", "b", ["h2", "h3"], [ln("h2", "gap")])];
  const p = scanProbe(rows);
  assert.deepEqual(p.selectors, ["p", "h2", "h3"]);
  assert.equal(p.lines.length, 3);
  assert.deepEqual(p.spans, [[0, 2], [2, 3]]);
});

test("scan: a rule is quiet when nothing it sets looks different, and loud when anything does", () => {
  const rows = [row("quiet", "quiet", ["p"], [ln("p", "colour")]), row("loud", "loud", ["h2"], [ln("h2", "size")]), row("dead", "dead", ["x"], [ln("x", "gap")])];
  const spans = [[0, 1], [1, 2], [2, 3]];
  const desktop = frameSet(
    [line(["black", null, null]), line([null, "16px", "16px"]), line([null, null, null])],
    [line(["black", null, null]), line([null, "24px", "16px"]), line([null, null, null])]);
  const phone = frameSet([line(["black"], { applies: true }), line(["1"], { applies: true }), line([null])], [line(["black"]), line(["1"]), line([null])]);
  const m = summariseScan(rows, spans, { desktop, phone });
  assert.equal(m.get("quiet").status, "same");
  assert.equal(m.get("loud").status, "differs");
  assert.equal(m.get("loud").differing, 1);
  assert.equal(m.get("dead").status, "none", "it matches nothing on this page");
  const q = quietRules(rows, m);
  assert.deepEqual(q.same.map((r) => r.id), ["quiet"]);
  assert.deepEqual(q.none.map((r) => r.id), ["dead"]);
});

test("scan: a rule written for phones is read from the phone frame, not the desktop one", () => {
  const rows = [row("p", "p", ["p"], [ln("p", "order", "@media (max-width: 768px)")])];
  const desktop = frameSet([line(["x"], { applies: false })], [line(["x"], { applies: false })]);
  const phone = frameSet([line(["1"], { applies: true })], [line(["3"], { applies: true })]);
  const m = summariseScan(rows, [[0, 1]], { desktop, phone });
  assert.equal(m.get("p").status, "differs");
  assert.deepEqual(m.get("p").lines[0], { label: "order", measurable: true, template: "1", yours: "3", differs: true });
});

test("scan: a rule that only applies on hover is never called quiet", () => {
  const rows = [row("h", "h", ["a"], [ln("a:hover", "colour")])];
  const f = frameSet([line(["a"], { measurable: false })], [line(["b"], { measurable: false })]);
  const m = summariseScan(rows, [[0, 1]], { desktop: f, phone: f });
  assert.equal(m.get("h").status, "state");
  assert.deepEqual(quietRules(rows, m), { same: [], none: [] });
});
