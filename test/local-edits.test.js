// Local CSS edits: the structural CSS parser, finding an author's own edits against a
// baseline, and keeping them in a PAGE-SPECIFIC OVERRIDES region through an upgrade.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS, BLOCK_LIST } from "../src/blocks/index.js";
import { FIXTURES } from "./fixtures.js";
import { BUILDER_VERSION } from "../src/changelog/index.js";
import { parseCss, serializeCss, countDecls } from "../src/changelog/css-tree.js";
import { findLocalEdits, overridesRegion, splitOverrides, OVERRIDES_START, OVERRIDES_END } from "../src/changelog/local-edits.js";
import { buildUpgrade, upgradePage } from "../src/changelog/upgrade.js";
import { BASE_CSS_SOURCE, forToc, removeCssRule, getPageCSS } from "../src/base/index.js";
import { assembleCSS } from "../src/lib/assemble.js";
import { loadBaseline, baselinePage } from "../src/lib/baseline.js";

const old = await loadBaseline("3.1.1");
const USED = ["at-a-glance", "accordion", "buttons"];
const pristineCss = (ids = USED) => baselinePage(old, { blockIds: ids }).css;
const edit = (css, from, to) => { assert.ok(css.includes(from), `fixture text not found: ${from}`); return css.replace(from, to); };
const firstFixture = (id) => BLOCKS[id].generateHTML(Object.values(FIXTURES[id])[0]);
const pageOf = (css, ids = USED) => {
  const p = baselinePage(old, { blockIds: ids });
  return { html: p.html.replace('<p class="timestamp">', ids.map(firstFixture).join("\n") + '\n<p class="timestamp">'), css, js: p.js };
};

// ---- parser ----------------------------------------------------------------

test("parser: reads the whole template, and its output reads back the same", () => {
  const tree = parseCss(readFileSync(new URL("../template/template.css", import.meta.url), "utf8"));
  assert.equal(tree.unbalanced, false);
  assert.deepEqual(tree.children.map((c) => c.selector), ["html", ".gwella", ".ytydysgu", "body > main > article.plain-text", "#page-container"]);
  const again = parseCss(serializeCss(tree));
  assert.equal(serializeCss(again), serializeCss(tree));
  assert.equal(countDecls(again), countDecls(tree));
  assert.ok(countDecls(tree) > 300);
});

test("parser: formatting, comments, case and comma spacing do not matter", () => {
  const a = parseCss(".a, .b { COLOR : red ; margin: 0 auto !important; background: rgba(0,0,0,.5) }  @media (max-width:768px) { .a { gap:1rem } }");
  const b = parseCss("/* c */ .a,\n.b {\n  color: red;\n  margin: 0 auto!important;\n  background: rgba(0, 0, 0, .5);\n}\n@media (max-width: 768px) {\n  .a { gap: 1rem; /* x */ }\n}");
  assert.equal(serializeCss(a), serializeCss(b));
});

test("parser: strings and url() may contain ; { } and comment markers", () => {
  const t = parseCss('.a::before { content: "a;b}{c /* d */"; background: url(data:image/png;base64,AAA=); } .b { color: red }');
  assert.deepEqual(t.children.map((c) => c.selector), [".a::before", ".b"]);
  assert.deepEqual(t.children[0].decls.get("content"), ['"a;b}{c /* d */"']);
  assert.deepEqual(t.children[0].decls.get("background"), ["url(data:image/png;base64,AAA=)"]);
});

test("parser: unmatched braces are reported, not thrown", () => {
  assert.equal(parseCss(".a { color: red;").unbalanced, true);
  assert.equal(parseCss(".a { color: red; } }").unbalanced, true);
  assert.equal(parseCss(".a { color: red; }").unbalanced, false);
});

// ---- finding edits ---------------------------------------------------------

test("a page that is exactly the standard code has no edits, however it is laid out", () => {
  assert.deepEqual(findLocalEdits(pristineCss(), old).edits, []);
  assert.deepEqual(findLocalEdits(pristineCss(["accordion"]), old).edits, [], "a subset of blocks causes no 'removed' noise");
  assert.deepEqual(findLocalEdits(pristineCss([]), old).edits, [], "base only");
  const messy = pristineCss().replace(/\n  /g, "\n\t").replace(/;\n/g, ";\n\n").replace("html {", "/* hi */ html   {");
  assert.deepEqual(findLocalEdits(messy, old).edits, []);
  const noToc = `<style>\n${assembleCSS(forToc(old.css, false), USED.map((id) => old.blocks[id]))}\n</style>`;
  assert.deepEqual(findLocalEdits(noToc, old, { includeToc: false }).edits, [], "the no-ToC variant is understood");
});

test("finds changed, added, removed and own-rule edits, with where they are", () => {
  let css = pristineCss();
  css = edit(css, "color: var(--primary-colour);\n    line-height: 120%", "color: #123456;\n    line-height: 120%");
  css = edit(css, "font-weight: 600;\n\n      .accordion-button-text", "font-weight: 600;\n      letter-spacing: 0.02em;\n\n      .accordion-button-text");
  css = edit(css, "--primary-colour: #a3195b;", "--primary-colour: #b0006a;");
  css = edit(css, "    margin-top: 2rem;\n    margin-bottom: 1rem;\n    font-style: italic;", "    margin-top: 2rem;\n    font-style: italic;");
  css = edit(css, "</style>", "#page-container .my-banner { background:#fee; color:red }\n</style>");
  const { edits, blockIds } = findLocalEdits(css, old);
  assert.deepEqual(blockIds.sort(), [...USED].sort());
  const by = (kind) => edits.filter((e) => e.kind === kind);
  assert.equal(edits.length, 5);
  assert.deepEqual(by("changed-decl").map((e) => `${e.path.join(" > ")} ${e.prop}: ${e.from} -> ${e.to}`).sort(), [
    "#page-container > #header-h1 color: var(--primary-colour) -> #123456",
    ".gwella --primary-colour: #a3195b -> #b0006a",
  ]);
  assert.deepEqual(by("added-decl").map((e) => [e.path.join(" > "), e.prop, e.blockId]), [["#page-container > .accordion > .accordion-button", "letter-spacing", "accordion"]]);
  assert.deepEqual(by("removed-decl").map((e) => [e.path.join(" > "), e.prop, e.keepable]), [["#page-container > .timestamp", "margin-bottom", false]]);
  assert.deepEqual(by("added-rule").map((e) => [e.selector, e.keepable, e.blockId]), [["#page-container .my-banner", true, null]]);
  assert.ok(edits.every((e) => e.summary && /^E\d+$/.test(e.id)));
});

test("says when the new standard also changed the same thing, or removed the rule", () => {
  // 3.2.0 turned content-column H3 black, so an author's own H3 colour now collides with the standard.
  const css = edit(pristineCss(), "font-weight: 600;\n      color: var(--primary-colour);", "font-weight: 600;\n      color: #c00;");
  const [h3] = findLocalEdits(css, old, { currentBase: BASE_CSS_SOURCE }).edits;
  assert.equal(h3.kind, "changed-decl");
  assert.equal(h3.standardChanged, true);
  assert.equal(h3.obsolete, false);
  // An edit to a rule the new standard no longer has is marked obsolete.
  const gone = removeCssRule(BASE_CSS_SOURCE, ".timestamp {");
  const css2 = edit(pristineCss(), "font-style: italic;", "font-style: normal;");
  const [ts] = findLocalEdits(css2, old, { currentBase: gone }).edits;
  assert.equal(ts.obsolete, true);
});

// ---- the overrides region --------------------------------------------------

test("the overrides region round-trips and merges with what the page already carried", () => {
  let css = edit(pristineCss(), "color: var(--primary-colour);\n    line-height: 120%", "color: #123456;\n    line-height: 120%");
  const first = findLocalEdits(css, old);
  const region = overridesRegion(first.edits, first.carried);
  assert.ok(region.startsWith(OVERRIDES_START) && region.endsWith(OVERRIDES_END));
  const { css: rest, overrides } = splitOverrides(`${pristineCss()}\n${region}`);
  assert.equal(rest.trim(), pristineCss().trim());
  assert.match(overrides, /#header-h1 \{\s*color: #123456;/);
  // A second batch of edits is merged into the same region; a later value wins.
  const second = [{ kind: "changed-decl", path: ["#page-container", "#header-h1"], prop: "color", to: ["#000"] }, { kind: "added-decl", path: ["#page-container", "#header-h1"], prop: "margin-top", to: ["0"] }];
  const merged = overridesRegion(second, parseCss(overrides));
  assert.match(merged, /color: #000;/);
  assert.doesNotMatch(merged, /#123456/);
  assert.match(merged, /margin-top: 0;/);
  assert.equal(overridesRegion([], parseCss("")), "", "nothing to write, nothing written");
});

// ---- through buildUpgrade --------------------------------------------------

const editedPage = () => {
  let css = pristineCss();
  css = edit(css, "color: var(--primary-colour);\n    line-height: 120%", "color: #123456;\n    line-height: 120%");
  css = edit(css, "font-weight: 600;\n\n      .accordion-button-text", "font-weight: 600;\n      letter-spacing: 0.02em;\n\n      .accordion-button-text");
  css = edit(css, "    margin-top: 2rem;\n    margin-bottom: 1rem;\n    font-style: italic;", "    margin-top: 2rem;\n    font-style: italic;");
  return pageOf(css);
};

test("upgrade keeps the author's edits in an overrides region after the standard CSS", () => {
  const r = buildUpgrade(editedPage(), { baseline: old });
  const standard = getPageCSS(true, USED.map((id) => BLOCKS[id]));
  assert.ok(r.css.startsWith(standard.replace(/\n<\/style>$/, "")), "everything before the region is exactly the standard CSS");
  assert.ok(r.css.includes(OVERRIDES_START) && r.css.endsWith(`${OVERRIDES_END}\n</style>`));
  assert.match(r.css, /#header-h1 \{\s*color: #123456;/);
  assert.match(r.css, /letter-spacing: 0\.02em;/);
  assert.deepEqual(r.edits.map((e) => [e.kind, e.kept]), [["changed-decl", true], ["removed-decl", false], ["added-decl", true]]);
  assert.ok(r.edits.find((e) => !e.kept).why.includes("removed"));
  assert.ok(r.notes.some((n) => /not kept/.test(n) && /margin-bottom/.test(n)));
});

test("upgrade: the author can drop an edit, and edits for an unused block are dropped", () => {
  const dropped = buildUpgrade(editedPage(), { baseline: old, dropEdits: ["E1"] });
  assert.doesNotMatch(dropped.css, /#123456/);
  assert.match(dropped.css, /letter-spacing/);
  assert.equal(dropped.edits.find((e) => e.id === "E1").why, "Dropped by the author.");
  // The accordion CSS is in the page but its markup is not, so the accordion is left out and so is its edit.
  const page = editedPage();
  page.html = page.html.replace(/<div class="accordion"[\s\S]*?<\/div>\s*<\/div>\s*(?=<)/, "");
  const r = buildUpgrade({ ...page, html: page.html.split("\n").filter((l) => !/accordion/.test(l)).join("\n") }, { baseline: old });
  assert.doesNotMatch(r.blocks.join(), /accordion/);
  assert.doesNotMatch(r.css, /letter-spacing/);
  assert.match(r.edits.find((e) => e.blockId === "accordion").why, /not used/);
});

test("upgrading is idempotent, and the kept edits are not seen as new edits next time", async () => {
  const first = await upgradePage(editedPage());
  assert.equal(first.pageVersion, "3.1.1");
  assert.ok(first.edits.length > 0, "upgradePage loaded the baseline itself");
  const page2 = { html: first.html, css: first.css, js: first.js };
  const second = await upgradePage(page2);
  assert.equal(second.pageVersion, BUILDER_VERSION);
  assert.equal(second.upToDate, true);
  assert.deepEqual(second.edits, [], "nothing new to keep");
  assert.equal(second.css, first.css, "the region is carried forward unchanged");
  assert.equal(second.html, first.html);
});

test("a hand-edited rule inside the region is carried forward too", async () => {
  const first = await upgradePage(editedPage());
  const css = first.css.replace("letter-spacing: 0.02em;", "letter-spacing: 0.1em;\n    word-spacing: 2px;");
  const second = await upgradePage({ html: first.html, css, js: first.js });
  assert.match(second.css, /letter-spacing: 0\.1em;/);
  assert.match(second.css, /word-spacing: 2px;/);
});

test("with no stored code for the version, new edits can't be found but an existing region survives", async () => {
  const region = `${OVERRIDES_START}\n#page-container {\n  #header-h1 {\n    color: #123456;\n  }\n}\n${OVERRIDES_END}`;
  const css = pristineCss().replace(/\n<\/style>$/, `\n${region}\n</style>`);
  const r = await upgradePage(pageOf(css), { version: "3.1.0" });
  assert.equal(r.edits, null);
  assert.ok(r.notes.some((n) => /no stored code for version 3\.1\.0/.test(n)));
  assert.match(r.css, /#header-h1 \{\s*color: #123456;/);
});

test("lots of differences warn that the version may be wrong, and broken CSS is flagged", () => {
  const many = Array.from({ length: 40 }, (_, i) => `.mine-${i} { color: red; margin: ${i}px; }`).join("\n");
  const r = buildUpgrade(pageOf(pristineCss().replace(/\n<\/style>$/, `\n${many}\n</style>`)), { baseline: old });
  assert.ok(r.notes.some((n) => /may not really be version 3\.1\.1/.test(n)), r.notes.join("|"));
  const broken = buildUpgrade(pageOf(pristineCss().replace(/\n<\/style>$/, "\n.x { color: red;\n</style>")), { baseline: old });
  assert.ok(broken.notes.some((n) => /unmatched braces/.test(n)));
});
