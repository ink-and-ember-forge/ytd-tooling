// Removing a page's own components from its HTML (src/changelog/components.js), and how the migration uses it.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { retireComponents, elementsOf } from "../src/changelog/components.js";
import { buildMigration } from "../src/changelog/migrate.js";
import { loadBaseline } from "../src/lib/baseline.js";

const reference = await loadBaseline("3.1.1");
const legacy = () => { const f = (n) => readFileSync(new URL(`./fixtures/legacy/page.${n}`, import.meta.url), "utf8"); return { html: f("html"), css: f("css"), js: f("js") }; };

test("components: a container becomes a placeholder, with every dropped class inside it named, and its id carried in the message", () => {
  const html = `<p>Hi</p>\n<section class="journey" id="start">\n  <div class="journey-content"><a class="cta" href="#">Go</a></div>\n</section>\n<p>after</p>`;
  const r = retireComponents(html, ["journey", "journey-content", "cta"]);
  assert.equal(r.removed.length, 1, "the nested components go with their container");
  assert.deepEqual(r.removed[0].classes, ["journey", "journey-content", "cta"]);
  assert.equal(r.removed[0].id, "start");
  assert.equal(r.removed[0].line, 2);
  assert.ok(r.removed[0].original.startsWith('<section class="journey"') && r.removed[0].original.endsWith("</section>"));
  assert.match(r.html, /<!-- REBUILD: \.journey, \.journey-content, \.cta have no equivalent[^>]*id="start"[^>]*-->/);
  assert.ok(r.html.startsWith("<p>Hi</p>\n<!-- REBUILD") && r.html.endsWith("-->\n<p>after</p>"), "everything around it is exactly as written");
});

test("components: a link or paragraph keeps its words and only loses the class; an image is a component and is replaced", () => {
  const r = retireComponents('<a class="burgundy-link x" href="u">link</a> <p class="note">words</p> <img class="icon" src="a.png">', ["burgundy-link", "note", "icon"]);
  assert.ok(r.html.startsWith('<a class="x" href="u">link</a> <p>words</p> <!-- REBUILD: .icon has no equivalent'));
  assert.deepEqual(r.stripped.map((s) => `${s.name}<${s.tag}>`), ["burgundy-link<a>", "note<p>"]);
  assert.equal(r.removed[0].tag, "img");
});

test("components: only whole class names match (image-text-section is not 'text'), and ids are never removed", () => {
  const html = '<div class="image-text-section" id="text"><p>x</p></div>';
  assert.equal(retireComponents(html, ["text"]).html, html);
});

test("components: where the tags are broken, nothing is removed, the class is stripped, and it is reported", () => {
  const r = retireComponents('<div class="box"><p>never closed</p>\n<p>after</p>', ["box"]);
  assert.equal(r.removed.length, 0);
  assert.equal(r.html, '<div><p>never closed</p>\n<p>after</p>');
  assert.equal(r.unresolved.length, 1);
  assert.match(r.unresolved[0].why, /closing tag can't be found/);
});

test("components: an element holding the page's own structure is never removed", () => {
  const html = '<div class="wrap"><nav id="table-of-contents"><ul><li>x</li></ul></nav></div>';
  const r = retireComponents(html, ["wrap"]);
  assert.equal(r.removed.length, 0);
  assert.match(r.unresolved[0].why, /own structure/);
  assert.ok(r.html.includes('id="table-of-contents"'));
});

test("components: comments and scripts are not read as tags", () => {
  const html = '<!-- <div class="box"><p>x</p></div> --><script>var s = "<div class=\\"box\\">";</script><div class="box"><p>real</p></div>';
  assert.equal(elementsOf(html).filter((e) => e.tag === "div").length, 1);
  const r = retireComponents(html, ["box"]);
  assert.equal(r.removed.length, 1);
  assert.ok(r.html.startsWith("<!-- <div class=\"box\"><p>x</p></div> --><script>"), "the comment and script are untouched");
});

// ---- inside the migration ---------------------------------------------------

test("migration: nothing is removed unless asked, so existing callers see the HTML they always did", () => {
  const a = buildMigration(legacy(), { reference, keepGroups: [] }), b = buildMigration(legacy(), { reference, keepGroups: [], retire: false });
  assert.equal(a.html, b.html);
  assert.ok(!a.html.includes("REBUILD"));
  assert.deepEqual(a.retired.removed, []);
});

test("migration: with retire on and nothing kept, the real page's own components are gone and everything else is untouched", () => {
  const page = legacy(), m = buildMigration(page, { reference, keepGroups: [], retire: true });
  assert.ok(m.retired.removed.length > 0);
  assert.equal((m.html.match(/<!-- REBUILD/g) || []).length, m.retired.removed.length);
  assert.ok(!/class="[^"]*\bcta-button\b/.test(m.html), "no element still carries a dropped class");
  const before = buildMigration(page, { reference, keepGroups: [] }).html;
  let rebuilt = m.html;
  for (const r of m.retired.removed) rebuilt = rebuilt.replace(/<!-- REBUILD:[^>]*-->/, () => r.original);
  const classes = (h) => h.replace(/\sclass="[^"]*"/g, "");
  assert.equal(classes(rebuilt), classes(before), "putting each original back gives the page again, apart from the class attributes of decorations");
  for (const r of m.retired.removed) assert.ok(before.includes(r.original), "the original code is exactly what the page had");
});

test("migration: a component the author keeps stays in the HTML and keeps its CSS; the others still go", () => {
  const page = legacy(), all = buildMigration(page, { reference, keepGroups: [], retire: true });
  const first = all.retired.removed[0], keep = first.classes; // every class in it, or a kept parent's unkept child is still removed
  const some = buildMigration(page, { reference, keepGroups: keep, retire: true });
  assert.ok(some.retired.removed.length < all.retired.removed.length, "one fewer is removed");
  assert.ok(some.html.includes(first.original), "the kept component's HTML is exactly as written");
  assert.ok(keep.every((c) => new RegExp(`\\.${c}\\b`).test(some.css)), "and its styling is carried");
});

test("migration: Bootstrap's own classes are never removed, only the page's mobile rules for them", () => {
  const page = { html: '<div id="page-container"><main><table class="table"><tr><td><b>x</b></td></tr></table></main></div>', css: ":root{--burgundy:#a3195b}\n@media (max-width: 768px) { .table { table-layout: fixed; } }", js: "" };
  const m = buildMigration(page, { reference, keepGroups: [], retire: true });
  assert.ok(m.html.includes('<table class="table">'));
  assert.deepEqual(m.retired.removed, []);
});

test("migration: the changes list says what was removed and the notes tell the author how to rebuild", () => {
  const m = buildMigration(legacy(), { reference, keepGroups: [], retire: true });
  assert.ok(m.htmlChanges.some((c) => /^component:/.test(c.id) && /placeholder/.test(c.summary)));
  assert.ok(m.notes.some((n) => /REBUILD/.test(n) && /paste it over its placeholder/.test(n)));
  assert.equal(m.retiring, true);
});

test("report: the original code of every removed component is kept in it, and kept components are called out", async () => {
  const { buildReview } = await import("../src/changelog/review.js");
  const { buildReport, reportMarkdown } = await import("../src/changelog/report.js");
  const page = legacy(), first = buildMigration(page, { reference, keepGroups: [] });
  const steps = buildReview(first, page.html);
  const m = buildMigration(page, { reference, keepGroups: ["burgundy-link"], retire: true });
  const md = reportMarkdown(buildReport(m, steps, new Map(), { date: "2026-01-01" }));
  assert.ok(m.retired.removed.length > 0);
  for (const r of m.retired.removed) assert.ok(md.includes(r.original), `the report holds the original ${r.tag} (${r.classes[0]})`);
  assert.match(md, /## Original code of what was removed/);
  assert.match(md, /- burgundy-link: kept for now, \*\*rebuild it\*\*/);
  assert.match(md, /- journey-section: \*\*removed\*\*, rebuild it over the placeholder/);
  assert.ok(buildReport(m, steps, new Map(), { date: "x" }).toCheck.some((c) => /^Rebuild \.journey-section/.test(c)));
});
