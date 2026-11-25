// 3.5.0: Figure block, file size line, accordion heading level, text-and-actions columns, older Icon toggle upgrade.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS } from "../src/blocks/index.js";
import { FIXTURES } from "./fixtures.js";
import { upgradeIconToggleHtml } from "../src/changelog/components.js";
import { buildMigration } from "../src/changelog/migrate.js";
import { validate } from "../src/validate/index.js";
import { templatePack } from "../src/validate/template-pack.js";

const out = (id, name) => BLOCKS[id].generateHTML(FIXTURES[id][name]);

test("figure: a full-width figure with an optional caption, escaped; nothing without an image; warns without alt", () => {
  assert.equal(out("figure", "plain"), '<figure class="figure-block">\n  <img src="https://example.org/chart.png" alt="A chart" />\n</figure>');
  assert.match(out("figure", "captioned"), /alt="Radar chart of &quot;six&quot; domains"[^]*<figcaption>The six &lt;domains&gt;<\/figcaption>/);
  assert.equal(out("figure", "empty"), "");
  assert.equal(BLOCKS.figure.warnings(FIXTURES.figure["no-alt"]).length, 1);
  assert.equal(BLOCKS.figure.warnings(FIXTURES.figure.plain).length, 0);
  assert.equal(validate({ html: out("figure", "no-alt") }, { packs: [templatePack] }).findings.filter((f) => f.id === "template/img-no-alt").length, 0, "alt=\"\" is present, so the validator's missing-alt rule is not what catches this; the tab warning is");
  assert.match(BLOCKS.figure.css, /\.figure-block \{[^}]*margin: 1rem 0;[\s\S]*width: 100%;[\s\S]*height: auto/);
});

test("resource cards: file type and size sits inside the title link, in brackets once, and is part of the new-tab label", () => {
  const html = out("resource-cards", "file-size");
  assert.match(html, /<strong>A guide <i class="fa-solid fa-up-right-from-square"><\/i><\/strong>\n        <span class="file-size">\(PDF, 21\.5MB\)<\/span>\n      <\/a>/);
  assert.match(html, /aria-label="A guide \(PDF, 21\.5MB\) \(opens in a new tab\)"/);
  assert.match(html, /<span class="file-size">\(PDF, 1 page, 1MB\)<\/span>/, "brackets typed by the author are not doubled");
  assert.equal((html.match(/file-size/g) || []).length, 2, "blank or spaces-only: no line");
  assert.doesNotMatch(out("resource-cards", "mixed"), /file-size/, "cards without the field are unchanged");
  const base = readFileSync(new URL("../src/base/base.css", import.meta.url), "utf8");
  assert.match(base, /\.file-size \{[^}]*display: inline-block;[^}]*font-weight: 400;[^}]*color: var\(--secondary-text-colour\);[^}]*text-decoration: none;/);
});

test("accordion: heading level h3 by default, h4 or h5 on request, anything else falls back to h3", () => {
  assert.match(out("accordion", "named"), /<h3 class="accordion-header"[^>]*>[^]*<\/h3>/);
  const h4 = out("accordion", "under-an-h3");
  assert.equal((h4.match(/<h4 class="accordion-header"/g) || []).length, 2);
  assert.equal((h4.match(/<\/h4>/g) || []).length, 2);
  assert.doesNotMatch(h4, /<h3/);
  assert.doesNotMatch(out("accordion", "unknown-level"), /<h1|<\/h1/);
  assert.match(out("accordion", "unknown-level"), /<h3 class="accordion-header"/);
  const under = validate({ html: `<h1>T</h1><h2>S</h2>${h4}` }, { packs: [templatePack] });
  assert.equal(under.findings.filter((f) => f.id === "template/heading-skip").length, 1, "h4 straight under an h2 is still caught");
  assert.equal(validate({ html: `<h1>T</h1><h2>S</h2><h3>Sub</h3>${h4}` }, { packs: [templatePack] }).findings.filter((f) => f.id === "template/heading-skip").length, 0);
});

test("equal columns: buttons in the right column are a fixed width, level with the text, and after it on phones", () => {
  const css = BLOCKS["flex-section"].css;
  assert.match(css, /\.video-content:has\(> \.buttons\) \{[\s\S]*order: 0;[\s\S]*> \.buttons \{\s*flex: 0 1 280px;\s*margin-top: 0;/);
  assert.match(css, /order: -1;/, "images still come first on phones");
});

test("older Icon toggle markup gets the classes the current CSS styles, nothing else changes, and it is idempotent", () => {
  const legacy = readFileSync(new URL("./fixtures/legacy3/page.html", import.meta.url), "utf8");
  const r = upgradeIconToggleHtml(legacy);
  assert.match(r.html, /<div class="data-icons-grid" id="data-icons-grid">/);
  assert.equal((r.html.match(/class="data-icon-trigger"/g) || []).length, (legacy.match(/<div onclick="openAccordion\(/g) || []).length, "one per tile");
  assert.deepEqual(r.changes.map((c) => c.id), ["icon-toggle-grid", "icon-toggle-tiles"]);
  assert.equal(r.html.replace(/ class="data-icons?-(grid|trigger)"/g, ""), legacy, "only those classes were added");
  assert.equal(upgradeIconToggleHtml(r.html).changes.length, 0);
  const current = `<div class="data-icons-grid" id="data-icons-grid-x"><div class="data-icon-trigger" onclick="openAccordion(this, 'a')"></div></div>`;
  assert.equal(upgradeIconToggleHtml(current).html, current, "current markup is left alone");
  const m = buildMigration({ html: legacy, css: "", js: "function openAccordion(){}function openAccordionKey(){}" }, { theme: "gwella" });
  assert.ok(m.htmlChanges.some((c) => c.id === "icon-toggle-tiles"));
});
