// Migration engine behaviour added from the five-page pilot: default class stripping, renames, safer component removal,
// the date line. Findings 4.3, 4.6b, 4.8, 4.10.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { retireComponents, rewriteClasses } from "../src/changelog/components.js";
import { migrateHtml, dateLine, buildMigration, IGNORED_CLASSES } from "../src/changelog/migrate.js";

test("rewriteClasses: strips and renames class tokens and leaves every other character alone", () => {
  const html = '<p class="burgundy intro">a</p>\n<a class="burgundy-link" href="x">b</a>\n<span class="accordion-text">c</span><div class="keep">d</div>';
  const r = rewriteClasses(html, { strip: ["burgundy", "burgundy-link"], rename: { "accordion-text": "accordion-button-text" } });
  assert.equal(r.html, '<p class="intro">a</p>\n<a href="x">b</a>\n<span class="accordion-button-text">c</span><div class="keep">d</div>');
  assert.deepEqual(r.stripped.map((s) => `${s.name}<${s.tag}>`), ["burgundy<p>", "burgundy-link<a>"]);
  assert.deepEqual(r.renamed, [{ from: "accordion-text", to: "accordion-button-text", tag: "span", count: 1 }]);
  assert.equal(rewriteClasses(html, {}).html, html);
});

test("default stripping: burgundy, burgundy-link and grey-text are not components and are not asked about", () => {
  const html = '<div id="page-container"><p class="grey-text">x</p><p class="burgundy">y</p><a class="burgundy-link" href="#">z</a></div>';
  const css = ".burgundy { color: #a3195b } .burgundy-link { color: #a3195b } .grey-text { color: #777 }";
  const m = buildMigration({ html, css, js: "" }, { theme: "gwella", retire: true });
  assert.deepEqual(m.groups.filter((g) => g.kind === "custom"), []);
  assert.doesNotMatch(m.html, /burgundy|grey-text/);
  assert.ok(m.htmlChanges.some((c) => c.id === "class:grey-text"));
  assert.deepEqual(m.retired.removed, []);
  const off = buildMigration({ html, css, js: "" }, { theme: "gwella", stripClasses: [] });
  assert.deepEqual(off.groups.filter((g) => g.kind === "custom").map((g) => g.key).sort(), ["burgundy", "burgundy-link", "grey-text"]);
});

test("accordion-text is renamed to accordion-button-text, so it is styled by the block", () => {
  const html = '<div id="page-container"><div class="accordion"><div class="accordion-item"><h3 class="accordion-header"><button class="accordion-button"><span class="accordion-text">T</span></button></h3></div></div></div>';
  const m = buildMigration({ html, css: ".accordion-text { font-weight: 700 }", js: "" }, { theme: "gwella", retire: true });
  assert.match(m.html, /class="accordion-button-text"/);
  assert.ok(m.htmlChanges.some((c) => c.id === "rename:accordion-text"));
  assert.deepEqual(m.lint.unstyledClasses, []);
});

test("IGNORED_CLASSES: Bootstrap's own classes are ignored; look-alikes from a page are not", () => {
  for (const c of ["accordion", "accordion-button", "card-body", "nav-link", "col-md-6", "col", "text-center", "text-muted"]) assert.ok(IGNORED_CLASSES.test(c), c);
  for (const c of ["accordion-text", "card-section", "nav-box", "col-label", "text-content", "text-block"]) assert.equal(IGNORED_CLASSES.test(c), false, c);
});

test("retire: a wrapper that holds a KEPT component is not removed; its class is stripped and it is reported", () => {
  const html = '<div id="page-container"><div class="section-block"><div class="org-chart"><p>CEO</p></div><p>words</p></div></div>';
  const r = retireComponents(html, ["section-block"], { keep: ["org-chart"] });
  assert.deepEqual(r.removed, []);
  assert.ok(r.html.includes('<div class="org-chart"><p>CEO</p></div><p>words</p>'), "everything inside survives");
  assert.doesNotMatch(r.html, /section-block/);
  assert.match(r.unresolved[0].why, /component that is being kept/);
  // without `keep` the old behaviour stays
  assert.equal(retireComponents(html, ["section-block"]).removed.length, 1);
});

test("retire: an image inside a link is only stripped; `dispositions` can ask for strip, and removals say what they held", () => {
  const link = '<a href="/x">Go <img class="inline-icon" src="i.png" alt=""></a>';
  const r = retireComponents(link, ["inline-icon"]);
  assert.equal(r.html, '<a href="/x">Go <img src="i.png" alt=""></a>');
  assert.match(r.unresolved[0].why, /inside a <a>/);
  const box = '<div class="resource-card-grid"><p>Some words</p><a href="/y">a link</a><img src="p.png" alt=""></div>';
  const kept = retireComponents(box, ["resource-card-grid"], { dispositions: { "resource-card-grid": "strip" } });
  assert.equal(kept.html, '<div><p>Some words</p><a href="/y">a link</a><img src="p.png" alt=""></div>');
  assert.deepEqual(kept.removed, []);
  const gone = retireComponents(box, ["resource-card-grid"]);
  assert.deepEqual(gone.removed[0].holds, { words: 4, links: 1, images: 1 });
  assert.ok(gone.removed[0].original.includes("Some words"), "the original is always listed");
});

test("date line: the <sup> form is cleaned, other forms are tolerated and reported, the date itself is never rewritten", () => {
  const fix = (h) => migrateHtml(h).html;
  assert.equal(fix('<p class="timestamp">Webpage last updated on 27<sup>th</sup> November 2025.</p>'), '<p class="timestamp">Webpage last updated on 27th November 2025.</p>');
  assert.equal(fix('<p>Webpage last updated on 1 <sup> st </sup> October 2026</p>'), '<p>Webpage last updated on 1st October 2026</p>');
  assert.ok(migrateHtml('<p>Webpage last updated on 27<sup>th</sup> November 2025.</p>').changes.some((c) => c.id === "date-sup"));
  assert.equal(fix("<p>Webpage last updated on: 26th June 2026</p>"), "<p>Webpage last updated on: 26th June 2026</p>", "a colon is left as written");
  assert.equal(dateLine("<p>Webpage last updated on: 26th June 2026</p>").colon, true);
  assert.equal(dateLine("<p>Webpage last updated on 26th June 2026</p>").truncated, false);
  assert.equal(dateLine("<p>Webpage last updated on 26th June 20</p>").truncated, true);
  assert.equal(dateLine("<p>Webpage last updated on [date].</p>").placeholder, true);
  assert.equal(dateLine("<p>nothing</p>"), null);
  const m = buildMigration({ html: '<div id="page-container"><p>Webpage last updated on: 26th June 22</p></div>', css: "", js: "" }, { theme: "gwella" });
  assert.ok(m.notes.some((n) => /cut off/.test(n)) && m.notes.some((n) => /colon/.test(n)));
});
