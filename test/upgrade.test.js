// The upgrade engine: block detection and buildUpgrade (pure, no UI).
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCK_LIST, BLOCKS } from "../src/blocks/index.js";
import { FIXTURES } from "./fixtures.js";
import { CHANGELOG, BUILDER_VERSION } from "../src/changelog/index.js";
import { checkPage } from "../src/changelog/checker.js";
import { detectBlocks, buildUpgrade } from "../src/changelog/upgrade.js";
import { getPageCSS, getPageJS } from "../src/base/index.js";
import { loadBaseline, baselinePage } from "../src/lib/baseline.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const ids = (blocks) => blocks.map((b) => b.id);

// ---- detection -------------------------------------------------------------

test("every block that has CSS or JS declares how to be detected", () => {
  for (const b of BLOCK_LIST.filter((b) => b.css || b.js)) {
    assert.ok(b.detect && ((b.detect.classes || []).length || (b.detect.ids || []).length), `block "${b.id}" needs a detect signature`);
  }
});

test("detection finds each block in everything its generator produces", () => {
  for (const b of BLOCK_LIST.filter((b) => b.css || b.js)) {
    for (const [name, values] of Object.entries(FIXTURES[b.id] || {})) {
      const html = b.generateHTML(values);
      if (!html.trim()) continue; // empty-input fixtures produce nothing
      assert.ok(ids(detectBlocks(html)).includes(b.id), `${b.id}/${name}: its own output was not detected`);
    }
  }
});

test("detection does not wrongly pick up other blocks (nesting excepted)", () => {
  // Flex section and Two column legitimately contain a Buttons group, so buttons may appear alongside.
  const alsoAllowed = { "flex-section": ["buttons"], "two-column": ["buttons"] };
  for (const b of BLOCK_LIST.filter((b) => b.css || b.js)) {
    for (const [name, values] of Object.entries(FIXTURES[b.id] || {})) {
      const html = b.generateHTML(values);
      const found = ids(detectBlocks(html)).filter((id) => id !== b.id && !(alsoAllowed[b.id] || []).includes(id));
      assert.deepEqual(found, [], `${b.id}/${name} was also detected as ${found.join(", ")}`);
    }
  }
});

test("the example page uses every block that has CSS, and prose or look-alike classes don't count", () => {
  assert.deepEqual(ids(detectBlocks(read("template/index.html"))), ids(BLOCK_LIST.filter((b) => b.detect)));
  assert.deepEqual(detectBlocks('<p>We use an accordion and buttons here, and a flex-section too.</p>'), []);
  assert.deepEqual(detectBlocks('<div class="accordion-item"></div><div data-class="accordion"></div>'), []);
  assert.deepEqual(ids(detectBlocks('<div class="a accordion b"></div>')), ["accordion"]);
});

// ---- assembling a page's code ---------------------------------------------

test("assembling every block gives exactly the template's CSS and JS", () => {
  assert.equal(getPageCSS(true, BLOCK_LIST), `<style>\n${read("template/template.css").replace(/\n$/, "")}\n</style>`);
  assert.equal(getPageJS(BLOCK_LIST), `<script>\n${read("template/template.js").replace(/\n$/, "")}\n</script>`);
});

test("assembling a subset includes only those blocks, and no-ToC drops the ToC", () => {
  const css = getPageCSS(true, [BLOCKS.accordion]);
  assert.match(css, /\.accordion \{/);
  assert.doesNotMatch(css, /nav-cards-grid|#at-a-glance/);
  assert.doesNotMatch(getPageJS([BLOCKS.accordion]), /data-icon/); // icon toggle's JS is left out
  assert.match(getPageJS([BLOCKS["icon-toggle"]]), /data-icon|data-icons|icon/i);
  const noToc = getPageCSS(false, [BLOCKS.accordion]);
  assert.doesNotMatch(noToc, /#table-of-contents/);
  assert.match(noToc, /\.main-grid \{[^}]*grid-template-columns:\s*1fr;/);
});

// ---- buildUpgrade ----------------------------------------------------------

// A page as an author would have it: a baseline's HTML with real content from each block,
// and the CSS/JS from that baseline for those blocks.
const firstFixture = (id) => BLOCKS[id].generateHTML(Object.values(FIXTURES[id])[0]);
const pageOn = (baseline, blockIds) => {
  const p = baselinePage(baseline, { blockIds });
  const content = blockIds.map(firstFixture).join("\n");
  return { html: p.html.replace('<p class="timestamp">', content + '\n<p class="timestamp">'), css: p.css, js: p.js };
};
const old = await loadBaseline("3.1.1");
const USED = ["at-a-glance", "accordion", "buttons"];
const oldPage = () => pageOn(old, USED);

test("upgrade: detects the blocks, keeps only those in the CSS, and bumps the marker", () => {
  const page = oldPage();
  assert.match(page.html, /data-base-version="3\.1\.1"/, "the test page really is a 3.1.1 page");
  const r = buildUpgrade(page);
  assert.deepEqual(r.blocks, ids(BLOCK_LIST).filter((id) => USED.includes(id)), "detected in registry order");
  assert.equal(r.pageVersion, "3.1.1");
  assert.equal(r.toVersion, BUILDER_VERSION);
  assert.equal(r.upToDate, false);
  assert.match(r.html, new RegExp(`data-base-version="${BUILDER_VERSION.replace(/\./g, "\\.")}"`));
  assert.doesNotMatch(r.html, /data-base-version="3\.1\.1"/);
  assert.equal(r.html.replace(/data-base-version="[\d.]+"/, ""), page.html.replace(/data-base-version="[\d.]+"/, ""), "nothing but the marker changed in the HTML");
  assert.equal(r.css, getPageCSS(true, USED.map((id) => BLOCKS[id])), "the CSS is the standard current CSS for exactly these blocks");
  assert.doesNotMatch(r.css, /nav-cards-grid|data-icons-grid/);
  assert.deepEqual(r.notes, []);
});

test("upgrade: the report lists what changed for this page", () => {
  const flagged = buildUpgrade(oldPage()).report.groups.copy.map((c) => c.id);
  for (const id of ["CHG-3.2.0-01", "CHG-3.2.0-02", "CHG-3.2.0-04", "CHG-3.2.0-05", "CHG-3.2.0-06", "CHG-3.3.0-02"]) assert.ok(flagged.includes(id), `${id} should be reported`);
});

test("upgrade: re-checking the result finds nothing left to do", () => {
  const r = buildUpgrade(oldPage());
  const recheck = checkPage([r.html, r.css, r.js].join("\n"), "3.1.1", CHANGELOG);
  for (const group of ["rebuild", "copy", "hand-edit", "manual"]) assert.deepEqual(recheck.groups[group].map((c) => c.id), [], `${group} should be empty after upgrading`);
  assert.equal(checkPage([r.html, r.css, r.js].join("\n"), "auto", CHANGELOG).upToDate, true, "the marker now reads as current");
});

test("upgrade: a page with no table of contents gets single-column CSS", () => {
  const page = oldPage();
  page.html = page.html.replace(/<nav id="table-of-contents">[\s\S]*?<\/nav>/, "");
  const r = buildUpgrade(page);
  assert.equal(r.includeToc, false);
  assert.doesNotMatch(r.css, /#table-of-contents/);
});

test("upgrade: the author can correct the blocks and the version", () => {
  const r = buildUpgrade(oldPage(), { blockIds: ["accordion", "nav-cards"] });
  assert.deepEqual(r.blocks, ["nav-cards", "accordion"]);
  assert.match(r.css, /nav-cards-grid/);
  assert.doesNotMatch(r.css, /#at-a-glance/);
  const explicit = buildUpgrade({ ...oldPage(), html: oldPage().html.replace(/ data-base-version="[\d.]+"/, "") }, { version: "3.1.1" });
  assert.match(explicit.html, new RegExp(`id="page-container"[^>]* data-base-version="${BUILDER_VERSION.replace(/\./g, "\\.")}"`), "a missing marker is added");
  assert.ok(explicit.notes.some((n) => /added/.test(n)));
});

test("upgrade: says what it could not do, instead of guessing", () => {
  assert.match(buildUpgrade({ html: "<p>no marker</p>" }).error, /version/);
  const noHtml = buildUpgrade({ css: "#page-container { }" }, { version: "3.1.1" });
  assert.ok(noHtml.notes.some((n) => /No HTML was pasted/.test(n)));
  const noContainer = buildUpgrade({ html: "<p>hello</p>" }, { version: "3.1.1" });
  assert.ok(noContainer.notes.some((n) => /No #page-container/.test(n)));
  assert.equal(noContainer.html, "<p>hello</p>", "HTML is untouched when there is nowhere safe to put the marker");
});

test("upgrade: a page that is already current is reported as up to date", async () => {
  const r = buildUpgrade(pageOn(await loadBaseline(BUILDER_VERSION), ["accordion"]));
  assert.equal(r.upToDate, true);
  assert.equal(r.css, getPageCSS(true, [BLOCKS.accordion]));
});
