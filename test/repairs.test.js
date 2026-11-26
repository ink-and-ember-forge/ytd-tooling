// Suggested tag repairs and the skeleton check (src/changelog/repairs.js, skeleton.js). Findings 4.4, 4.5, 3.6.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suggestRepairs, applyRepairs } from "../src/changelog/repairs.js";
import { detectSkeleton } from "../src/changelog/skeleton.js";
import { buildMigration } from "../src/changelog/migrate.js";
import { getBaseHTML } from "../src/base/index.js";
import { scanHtml } from "../src/validate/html-scan.js";

const fixture = (p) => readFileSync(new URL(`./fixtures/${p}`, import.meta.url), "utf8").replace(/\r/g, "");
const words = (h) => h.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
// Errors a repair can fix (a stray quote inside a tag, or a repeated attribute, is the author's to fix).
const errors = (h) => scanHtml(h).findings.filter((f) => f.severity === "error" && !/unclosed-quote|duplicate-attribute/.test(f.id)).length;

test("a page with nothing wrong gets no suggestions", () => {
  const r = suggestRepairs('<div id="page-container">\n  <p>hi</p>\n</div>\n');
  assert.deepEqual(r.repairs, []);
  assert.equal(r.resolved, true);
});

test("an element never closed gets its end tag where the indentation says, innermost first", () => {
  const html = ['<section>', '  <div class="a">', '    <ul>', '      <li>One</li>', '      <li>Two</li>', '  </div>', '</section>', ''].join("\n");
  const r = suggestRepairs(html);
  assert.equal(r.resolved, true);
  assert.deepEqual(r.repairs.map((x) => [x.action, x.tag, x.line]), [["insert", "ul", 3]]);
  assert.equal(r.repairs[0].text, "    </ul>\n", "put at the indentation of the <ul>, before the line that is no deeper");
  assert.equal(r.repaired, ['<section>', '  <div class="a">', '    <ul>', '      <li>One</li>', '      <li>Two</li>', '    </ul>', '  </div>', '</section>', ''].join("\n"));
});

test("a text <div> that the author's own end tag closes leaves the wrapper open: it is closed at the end, and the page scans clean", () => {
  const html = ['<div class="image-text-section">', '  <img src="a.png" alt="" />', '  <div>', '  <p>Text</p>', '  <p>More</p>', '</div>', ''].join("\n");
  const r = suggestRepairs(html);
  assert.equal(r.resolved, true);
  assert.deepEqual(r.repairs.map((x) => [x.action, x.tag, x.line]), [["insert", "div", 1]]);
  assert.equal(r.repaired, html + "</div>\n");
});

test("a stray </div> that closes .content-body early is deleted and the sections stay inside it", () => {
  const html = ['<main>', '  <div class="content-column">', '    <div class="content-body">', '      <section id="a">', '        <p>One</p>', '    </div>', '      </section>', '      <section id="b">', '        <p>Two</p>', '      </section>', '    </div>', '  </div>', '</main>', ''].join("\n");
  assert.ok(errors(html) > 0);
  const r = suggestRepairs(html);
  assert.equal(r.resolved, true);
  assert.deepEqual(r.repairs.map((x) => [x.action, x.tag]), [["delete", "div"]]);
  assert.equal(r.repairs[0].line, 6);
  assert.equal(words(r.repaired), words(html), "no words were touched");
  assert.equal(errors(r.repaired), 0);
});

test("</br> becomes <br />, and a heading closed at the wrong level is closed at the right one", () => {
  const r = suggestRepairs("<p>a</br>b</p>\n<h3>Title</h4>\n");
  assert.equal(r.resolved, true);
  assert.deepEqual(r.repairs.map((x) => [x.action, x.text]), [["replace", "<br />"], ["replace", "</h3>"]]);
  assert.equal(r.repaired, "<p>a<br />b</p>\n<h3>Title</h3>\n");
});

test("repairs are data: nothing changes until they are applied, and the author can accept some", () => {
  const html = "<p>a</br>b</p>\n<div>\n  <p>x</p>\n";
  const r = suggestRepairs(html);
  assert.equal(r.repairs.length, 2);
  assert.equal(applyRepairs(html, r.repairs, []), html, "none accepted: exactly as written");
  assert.equal(applyRepairs(html, r.repairs, ["R1"]).includes("<br />"), r.repairs[0].tag === "br");
  assert.equal(applyRepairs(html, r.repairs), r.repaired, "all accepted: the suggested page");
  assert.ok(r.repairs.every((x) => x.id && x.why && x.line));
});

test("the real pilot-shaped pages: legacy and legacy3 repair to a clean page with every word kept; example 3 too", () => {
  for (const f of ["legacy/page.html", "legacy3/page.html", "validate/example-3.html"]) {
    const html = fixture(f), r = suggestRepairs(html);
    assert.ok(r.repairs.length > 0, f);
    assert.equal(r.resolved, true, `${f}: scans clean after the repairs`);
    assert.equal(errors(r.repaired), 0, f);
    assert.equal(words(r.repaired), words(html), `${f}: no words changed`);
  }
  const legacy = suggestRepairs(fixture("legacy/page.html")).repaired;
  assert.equal(scanHtml(legacy).elements.filter((e) => e.tag === "section" && !(function inside(el) { for (let p = el.parent; p; p = p.parent) if (/content-body/.test(p.openTag)) return true; return false; })(e)).length, 0, "every section ends up inside .content-body");
});

test("known limit: example 4 is only partly repaired and says so", () => {
  const r = suggestRepairs(fixture("validate/example-4.html"));
  assert.equal(r.resolved, false);
  assert.ok(r.remaining > 0 && r.repairs.length > 0);
});

test("buildMigration: suggestions are listed, nothing is applied by default, `repairs` applies all or some, and each is reported", () => {
  const page = { html: fixture("legacy/page.html"), css: fixture("legacy/page.css"), js: fixture("legacy/page.js") };
  const none = buildMigration(page, { theme: "gwella" });
  assert.ok(none.repairSuggestions.repairs.length >= 4);
  assert.deepEqual(none.repairsApplied, []);
  assert.ok(none.lint.tagProblems.length > 0, "still reported");
  const all = buildMigration(page, { theme: "gwella", repairs: true });
  assert.equal(all.repairsApplied.length, all.repairSuggestions.repairs.length);
  assert.equal(all.lint.tagProblems.length, 0, "the repaired page has no tag problems");
  assert.ok(all.htmlChanges.filter((c) => c.id.startsWith("repair:")).length === all.repairsApplied.length);
  assert.equal(words(all.html), words(none.html));
  const some = buildMigration(page, { theme: "gwella", repairs: ["R1"] });
  assert.deepEqual(some.repairsApplied, ["R1"]);
  assert.ok(some.lint.tagProblems.length > 0, "one repair does not fix the rest");
});

test("skeleton: the template's own base HTML is the landing skeleton (no ToC) and the ToC one; older layouts are told apart", () => {
  const landing = detectSkeleton(getBaseHTML(false, "gwella"));
  assert.deepEqual([landing.kind, landing.hasToc, landing.landing, landing.issues], ["template", false, true, []]);
  const withToc = detectSkeleton(getBaseHTML(true, "gwella"));
  assert.deepEqual([withToc.kind, withToc.hasToc, withToc.landing], ["template", true, false]);
  assert.match(getBaseHTML(false, "gwella"), /<div class="main-grid standard-container">\s*<div class="content-column">\s*<h1 id="header-h1">[^<]*<\/h1>[\s\S]*?<div class="content-body">/, "div.main-grid.standard-container > .content-column > h1 + .content-body");
  assert.doesNotMatch(getBaseHTML(false, "gwella"), /id="table-of-contents"/);
  const old = detectSkeleton('<div id="page-container"><header class="header"><h1>Title</h1><p>Intro</p></header><section id="a"><p>x</p></section></div>');
  assert.equal(old.kind, "legacy-header");
  assert.equal(old.h1InHeader, true);
  assert.match(old.issues[0], /inside <header>/);
  assert.equal(detectSkeleton("<p>x</p>").kind, "unknown");
  const m = buildMigration({ html: '<div id="page-container"><header class="header"><h1>Title</h1></header><section id="a"><p>x</p></section></div>', css: "", js: "" }, { theme: "gwella" });
  assert.equal(m.skeleton.kind, "legacy-header");
  assert.ok(m.notes.some((n) => /inside <header>/.test(n)));
});
