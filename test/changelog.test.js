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
