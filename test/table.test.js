// The Table block, the default table look, wrapping bare tables, and the validator rule. Findings from the migration check.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS } from "../src/blocks/index.js";
import { FIXTURES } from "./fixtures.js";
import { upgradeTablesHtml } from "../src/changelog/components.js";
import { migrateHtml } from "../src/changelog/migrate.js";
import { getPageCSS, getPageJS } from "../src/base/index.js";
import { validate } from "../src/validate/index.js";
import { templatePack } from "../src/validate/template-pack.js";

const out = (name) => BLOCKS.table.generateHTML(FIXTURES.table[name]);

test("table: light rows with a header row; cells escaped; the box is named by the caption and focusable", () => {
  const html = out("light");
  assert.match(html, /^<div class="table-scroll" role="region" aria-label="Support by band" tabindex="0">\n  <table>\n    <caption>Support by band<\/caption>/);
  assert.match(html, /<thead>\n      <tr><th scope="col">Band<\/th><th scope="col">Support<\/th><th scope="col">Length<\/th><\/tr>\n    <\/thead>/);
  assert.match(html, /<td>Preceptor &amp; buddy<\/td>/);
  assert.doesNotMatch(html, /table--striped/);
  assert.equal(validate({ html, css: getPageCSS(false, [BLOCKS.table]), js: getPageJS([]) }, { packs: [templatePack] }).findings.filter((f) => f.severity !== "info").length, 0, "the block's own output, with its CSS, has no findings");
});

test("table: striped rows and a header column; markup in a cell is text; empty rows are left out", () => {
  const html = out("striped");
  assert.match(html, /<table class="table--striped">/);
  assert.match(html, /<tr><th scope="row">5<\/th><td>Preceptor<\/td><\/tr>/);
  assert.match(html, /&lt;b&gt;Mentor&lt;\/b&gt;/);
  assert.equal((html.match(/<tr>/g) || []).length, 3, "header and two rows; the empty last row is dropped");
});

test("table: no header, ragged and padded grids, one row, nothing typed", () => {
  const plain = out("no-header");
  assert.doesNotMatch(plain, /<thead>|<th/);
  assert.match(plain, /aria-label="Table"/, "no caption: the box is still named");
  assert.doesNotMatch(plain, /<caption>/);
  assert.equal((plain.match(/<tr>/g) || []).length, 2);
  const ragged = out("ragged-and-padded");
  assert.equal((ragged.match(/<th scope="col">/g) || []).length, 2, "empty columns on the right are dropped");
  assert.match(ragged, /<tr><td>1<\/td><td><\/td><\/tr>/);
  const one = out("one-row");
  assert.doesNotMatch(one, /<thead>/, "a header needs a row under it");
  assert.equal(out("empty"), "");
});

test("table: warnings ask for a caption and for content", () => {
  assert.equal(BLOCKS.table.warnings(FIXTURES.table.empty).length, 1);
  assert.match(BLOCKS.table.warnings(FIXTURES.table["no-header"])[0], /caption/);
  assert.equal(BLOCKS.table.warnings(FIXTURES.table.light).length, 0);
});

test("base CSS: a plain table is themed (header in the primary colour, dividers, striped variant in the pale colour) with tokens only", () => {
  const css = readFileSync(new URL("../src/base/base.css", import.meta.url), "utf8");
  assert.match(css, /thead th \{\s*background-color: var\(--primary-colour\);\s*color: var\(--text-on-primary\);/);
  assert.match(css, /border-bottom: 1px solid var\(--divider-colour\);/);
  assert.match(css, /&\.table--striped tbody tr:nth-child\(even\) \{\s*background-color: var\(--secondary-colour\);/);
  assert.match(BLOCKS.table.css, /overflow-x: auto;/);
  assert.match(BLOCKS.table.css, /&:focus-visible \{\s*outline: 3px solid var\(--focus-ring-colour\);/);
});

test("a bare table is wrapped in the scrolling box, named by its caption; tables already in a box or inside another table are left alone", () => {
  const r = upgradeTablesHtml('<p>x</p>\n<table><caption>Dates &amp; times</caption><tr><td>1</td></tr></table>\n<table><tr><td>2</td></tr></table>');
  assert.equal((r.html.match(/<div class="table-scroll"/g) || []).length, 2);
  assert.match(r.html, /aria-label="Dates &amp; times" tabindex="0">\n<table><caption>/);
  assert.match(r.html, /aria-label="Table"/);
  assert.deepEqual(r.changes.map((c) => c.id), ["table-scroll"]);
  assert.equal(upgradeTablesHtml(r.html).changes.length, 0, "idempotent");
  const nested = upgradeTablesHtml("<table><tr><td><table><tr><td>in</td></tr></table></td></tr></table>");
  assert.equal((nested.html.match(/table-scroll/g) || []).length, 1, "only the outer table");
  assert.equal(upgradeTablesHtml(out("light")).changes.length, 0, "the block's own output is already boxed");
  assert.ok(migrateHtml("<table><tr><td>a</td></tr></table>").changes.some((c) => c.id === "table-scroll"), "the migration does it too");
});

test("validator: a table outside the scrolling box is reported, one inside is not", () => {
  const f = (html) => validate({ html }, { packs: [templatePack] }).findings.filter((x) => x.id === "template/table-no-scroll-wrapper");
  assert.equal(f("<table><tr><td>a</td></tr></table>").length, 1);
  assert.equal(f('<div class="table-scroll"><table><tr><td>a</td></tr></table></div>').length, 0);
});
