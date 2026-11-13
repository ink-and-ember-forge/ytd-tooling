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
import { suggestVersions } from "../src/changelog/sniff.js";

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
  assert.equal(dropped.edits.find((e) => e.id === "E1").why, "Not kept.");
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

// ---- guessing the version --------------------------------------------------

const pristineOn = async (version, ids) => baselinePage(await loadBaseline(version), { blockIds: ids }).css;

test("suggests the stored version a page's CSS is closest to", async () => {
  for (const v of ["3.1.1", "3.2.0", "3.3.0"]) {
    const ranked = await suggestVersions(await pristineOn(v, ["at-a-glance", "accordion"]));
    assert.equal(ranked.find((r) => r.version === v).differences, 0, `a pristine ${v} page matches ${v} exactly`);
    assert.equal(ranked[0].differences, 0, "and nothing is a better match than that");
  }
  // A 3.1.1 page with two edits is still closest to 3.1.1.
  const edited = edit(edit(pristineCss(), "color: var(--primary-colour);\n    line-height: 120%", "color: #123456;\n    line-height: 120%"), "font-style: italic;", "font-style: normal;");
  const ranked = await suggestVersions(edited);
  assert.deepEqual([ranked[0].version, ranked[0].differences], ["3.1.1", 2]);
  assert.ok(ranked[1].differences > 2);
  assert.deepEqual(await suggestVersions(""), []);
});

test("versions that differ in no CSS tie, newest first, so the guess is honest about being ambiguous", async () => {
  // Releases that do not change the base CSS (3.2.0, 3.3.0, 3.4.0...) cannot be told apart by a page that uses none of the blocks they changed.
  const ranked = await suggestVersions(await pristineOn("3.3.0", []));
  const tied = ranked.filter((r) => r.differences === 0).map((r) => r.version);
  assert.ok(tied.includes("3.3.0") && tied.includes("3.2.0"), tied.join());
  assert.deepEqual(tied, [...tied].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })), "ties are listed newest first");
  assert.equal(ranked[0].version, tied[0]);
});

test("no marker: the error comes with the closest versions", async () => {
  const page = pageOf(pristineCss());
  page.html = page.html.replace(/ data-base-version="[\d.]+"/, "");
  const r = await upgradePage(page);
  assert.match(r.error, /version/);
  assert.equal(r.suggestions[0].version, "3.1.1");
});

test("a marker that disagrees with the CSS is called out", async () => {
  const page = pageOf(pristineCss());
  page.html = page.html.replace('data-base-version="3.1.1"', 'data-base-version="3.3.0"');
  page.css = page.css.replace(/\n<\/style>$/, `\n${Array.from({ length: 40 }, (_, i) => `.mine-${i} { color: red; margin: ${i}px; }`).join("\n")}\n</style>`);
  const r = await upgradePage(page);
  assert.equal(r.pageVersion, "3.3.0");
  assert.ok(r.notes.some((n) => /closest to version 3\.1\.1/.test(n)), r.notes.join(" | "));
  assert.equal(r.suggestions[0].version, "3.1.1");
});

// ---- opt-in tweaks, JS edits and the self-check -----------------------------

test("keepEdits: only the chosen tweaks are kept (nothing, if none are chosen)", () => {
  const none = buildUpgrade(editedPage(), { baseline: old, keepEdits: [] });
  assert.doesNotMatch(none.css, /PAGE-SPECIFIC|#123456|letter-spacing/);
  assert.deepEqual(none.edits.map((e) => e.kept), [false, false, false]);
  assert.equal(none.edits[0].why, "Not kept.");
  const one = buildUpgrade(editedPage(), { baseline: old, keepEdits: ["E3"] });
  assert.match(one.css, /letter-spacing/);
  assert.doesNotMatch(one.css, /#123456/);
  assert.deepEqual(one.edits.map((e) => e.kept), [false, false, true]);
  const all = buildUpgrade(editedPage(), { baseline: old });
  assert.deepEqual(all.edits.map((e) => [e.kind, e.kept]), [["changed-decl", true], ["removed-decl", false], ["added-decl", true]], "leaving keepEdits out keeps every keepable tweak");
});

test("JS: the page's own lines are reported, formatting and comments are not", () => {
  const page = editedPage();
  assert.deepEqual(buildUpgrade(page, { baseline: old }).jsEdits, { added: [], removed: [] });
  const reformatted = page.js.replace(/\n  /g, "\n      ").replace("<script>", "<script>\n// a comment\n\n");
  assert.deepEqual(buildUpgrade({ ...page, js: reformatted }, { baseline: old }).jsEdits, { added: [], removed: [] });
  const withOwn = buildUpgrade({ ...page, js: page.js.replace("</script>", 'console.log("mine");\n</script>') }, { baseline: old });
  assert.deepEqual(withOwn.jsEdits, { added: ['console.log("mine");'], removed: [] });
  assert.ok(withOwn.notes.some((n) => /JS differs.*1 line/.test(n)));
  assert.doesNotMatch(withOwn.js, /console\.log\("mine"\)/, "the upgraded JS is the standard JS; the author's line is reported, not merged");
  const lines = page.js.split("\n");
  const cut = lines.findIndex((l) => l.includes("scroll-behavior") || l.includes("backToTopBtn.addEventListener"));
  const missing = buildUpgrade({ ...page, js: lines.filter((_, i) => i !== cut).join("\n") }, { baseline: old }).jsEdits;
  assert.equal(missing.removed.length, 1);
  assert.equal(buildUpgrade(page).jsEdits, null, "no baseline, no comparison");
});

test("self-check: the upgraded code has nothing left to copy", () => {
  const r = buildUpgrade(editedPage(), { baseline: old });
  assert.equal(r.check.ok, true);
  assert.deepEqual(r.check.remaining, []);
  assert.deepEqual(r.check.manualSteps, []);
  assert.ok(buildUpgrade(pageOf(pristineCss()), { baseline: old }).check.ok);
});

test("a rule of the author's own says what it does, so it can be judged", () => {
  const css = pristineCss().replace(/\n<\/style>$/, "\n#page-container .banner { background: #fee; color: red; margin: 0 auto; padding: 1rem; border: 1px solid red; .inner { gap: 1px } }\n</style>");
  const [edit] = findLocalEdits(css, old).edits;
  assert.equal(edit.kind, "added-rule");
  assert.equal(edit.summary, "#page-container .banner: a rule of your own — background: #fee; color: red; margin: 0 auto; padding: 1rem; +1 more, and 1 nested rule");
  assert.equal(parseCss(".a { }").children[0].decls.size, 0);
});
