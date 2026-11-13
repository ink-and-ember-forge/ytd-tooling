import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { CHANGELOG, BUILDER_VERSION } from "../src/changelog/index.js";
import { validateChangelog, checkPage } from "../src/changelog/checker.js";
import { replacementFor } from "../src/changelog/replacements.js";
import { BLOCKS } from "../src/blocks/index.js";

test("changelog is valid against the schema rules", () => {
  assert.deepEqual(validateChangelog(CHANGELOG), []);
});

test("releases are newest first", () => {
  const v = CHANGELOG.releases.map((r) => r.version);
  const sorted = [...v].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  assert.deepEqual(v, sorted);
  assert.equal(BUILDER_VERSION, v[0]);
});

// Old releases may name blocks that were later removed or renamed; that is history.
// The newest release must point at blocks that exist.
test("the newest release only names blocks that exist", () => {
  for (const c of CHANGELOG.releases[0].changes) {
    for (const id of c.blocks || []) assert.ok(id === "*" || BLOCKS[id], `${c.id} names unknown block ${id}`);
    if (c.scope.startsWith("block:")) assert.ok(BLOCKS[c.scope.slice(6)], `${c.id} has unknown scope ${c.scope}`);
  }
});

test("upgrade checker: a 3.0.0 page with old background is reported", () => {
  const page = '<div id="page-container" data-base-version="3.0.0"></div>\n#page-container { background-color: transparent !important; }';
  const report = checkPage(page, "auto", CHANGELOG);
  assert.equal(report.pageVersion, "3.0.0");
  assert.equal(report.upToDate, false);
  assert.ok(report.groups.copy.some((c) => c.id === "CHG-3.1.1-01"));
});

test("upgrade checker: a current page is up to date", () => {
  const page = `<div id="page-container" data-base-version="${BUILDER_VERSION}"></div>`;
  assert.equal(checkPage(page, "auto", CHANGELOG).upToDate, true);
});

test("upgrade checker: missing marker asks for a version", () => {
  assert.match(checkPage("<p>no marker</p>", "auto", CHANGELOG).error, /version/);
});

test("guided fixes: base-css change yields replacement code", () => {
  const code = { html: () => "H", css: () => "C", js: () => "J" };
  const fix = replacementFor({ action: "copy", scope: "base-css" }, code, BLOCKS);
  assert.equal(fix.text, "C");
  assert.equal(replacementFor({ action: "hand-edit", scope: "base-css" }, code, BLOCKS), null);
  assert.equal(replacementFor({ action: "copy", scope: "block:buttons" }, code, BLOCKS).text, BLOCKS.buttons.css);
});

test("upgrade checker: a 3.1.1 page is flagged for every 3.2.0 base and accordion change", async () => {
  const { BASE_CSS } = await import("../src/base/index.js");
  // Reconstruct a 3.1.1-style page by undoing each 3.2.0 change in the current CSS.
  const old = BASE_CSS
    .replace(/\n\s*margin-block: 1em;\n(\s*\})/, "\n$1")
    .replace(/\s*ol > li::marker \{[^}]*\}/, "")
    .replace("color: #000;", "color: var(--primary-colour);")
    .replace("grid-template-columns: 1.3fr 3fr;", "grid-template-columns: 1fr 3fr;")
    .replace(/\n\s*border: 1px solid var\(--primary-colour\);/, "");
  const page = `<div id="page-container" data-base-version="3.1.1"></div>\n${old}\n.accordion-button { color: red; }`;
  const ids = Object.values(checkPage(page, "auto", CHANGELOG).groups).flat().map((c) => c.id);
  for (const n of [1, 2, 4, 5, 6]) assert.ok(ids.includes(`CHG-3.2.0-0${n}`), `CHG-3.2.0-0${n} should be reported`);
});

test("upgrade checker: a page built on the current base CSS and accordion is not flagged", async () => {
  const { BASE_CSS } = await import("../src/base/index.js");
  const page = `<div id="page-container" data-base-version="3.1.1"></div>\n${BASE_CSS}\n${BLOCKS.accordion.css}`;
  const { current, ...needAction } = checkPage(page, "auto", CHANGELOG).groups;
  assert.deepEqual(Object.values(needAction).flat(), [], "nothing should need action");
  const ids = current.map((c) => c.id);
  for (const id of ["CHG-3.2.0-01", "CHG-3.2.0-02", "CHG-3.2.0-04", "CHG-3.2.0-05", "CHG-3.2.0-06"]) assert.ok(ids.includes(id), `${id} should be recognised as already in the code`);
});

test("3.3.0: an At a glance block without its own heading colour is flagged; the current one is not", () => {
  const head = '<div id="page-container" data-base-version="3.2.0"></div>\n';
  const flagged = (css) => Object.entries(checkPage(head + css, "auto", CHANGELOG).groups)
    .some(([group, list]) => group !== "current" && list.some((c) => c.id === "CHG-3.3.0-02"));
  assert.ok(flagged(BLOCKS["at-a-glance"].css.replace("      color: var(--primary-colour);\n", "")), "old At a glance CSS should be flagged");
  assert.ok(!flagged(BLOCKS["at-a-glance"].css), "current At a glance CSS should not be flagged");
});

// The version number says what kind of release it is (changelog/SCHEMA.md, "Versioning"): the highest change type decides.
test("versions follow the rules: fixes and invisible changes are patches, new or noticeable things are minors", () => {
  const releases = [...CHANGELOG.releases].reverse(), MINOR = new Set(["additive", "visual", "breaking"]);
  for (let i = 1; i < releases.length; i++) {
    const [pa, pb, pc] = releases[i - 1].version.split(".").map(Number), [a, b, c] = releases[i].version.split(".").map(Number);
    const kind = a > pa ? "major" : b > pb ? "minor" : c > pc ? "patch" : "none";
    const types = releases[i].changes.map((x) => x.type);
    const rebuild = releases[i].changes.some((x) => x.page_rebuild);
    const expected = rebuild ? "major" : types.some((t) => MINOR.has(t)) ? "minor" : "patch";
    assert.equal(kind, expected, `${releases[i].version} is a ${kind} bump, but its changes (${types.join(", ")}) make it a ${expected}`);
    if (kind === "minor") assert.equal(c, 0, `${releases[i].version}: a minor resets the patch number`);
  }
});
