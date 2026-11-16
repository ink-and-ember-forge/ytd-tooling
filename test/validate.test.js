// The code validator (src/validate/). See docs/VALIDATOR.md.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { validate } from "../src/validate/index.js";
import { locator } from "../src/validate/locate.js";
import { scanHtml } from "../src/validate/html-scan.js";
import { scanCss } from "../src/validate/css-scan.js";
import { BLOCKS } from "../src/blocks/index.js";
import { FIXTURES } from "./fixtures.js";

const v = (html, css = "", js = "") => validate({ html, css, js });
const ofId = (r, id) => r.findings.filter((f) => f.id === id);
const ids = (r) => r.findings.map((f) => f.id);
const loud = (r) => r.findings.filter((f) => f.severity !== "info");

// ---- positions -------------------------------------------------------------

test("locator: offsets become 1-based line and column", () => {
  const loc = locator("ab\ncde\n\nf");
  assert.deepEqual(loc.at(0), { line: 1, column: 1 });
  assert.deepEqual(loc.at(4), { line: 2, column: 2 });
  assert.deepEqual(loc.at(7), { line: 3, column: 1 });
  assert.deepEqual(loc.at(8), { line: 4, column: 1 });
});

// ---- HTML: tags ------------------------------------------------------------

test("html: a clean page has no findings", () => {
  const r = v('<div id="a"><p>Hi</p><ul><li>one</li><li>two</li></ul><img src="x.png" alt=""><br></div>');
  assert.deepEqual(r.findings, []);
});

test("html: an unclosed container says where it stops and what it swallowed, with the closing tag as a related place", () => {
  const html = '<section>\n<div class="x">\n<h2>Title</h2>\n<p>Words</p>\n</section>\n<p>after</p>';
  const [f] = ofId(v(html), "html/unclosed-tag");
  assert.equal(f.severity, "error");
  assert.equal(f.line, 2);
  assert.match(f.message, /<div> is never closed/);
  assert.match(f.why, /until the <\/section> on line 5/);
  assert.match(f.why, /2 elements/);
  assert.deepEqual(f.related.map((r) => r.line), [5]);
  assert.equal(f.data.elementsInside, 2);
});

test("html: an element still open at the end of the page is reported as such", () => {
  const [f] = ofId(v("<div><p>x</p>"), "html/unclosed-tag");
  assert.match(f.why, /end of the page/);
  assert.deepEqual(f.related, []);
});

test("html: a stray close tag, and a heading closed with the wrong level, with a hint", () => {
  const stray = ofId(v("<div></div></span>"), "html/stray-close-tag");
  assert.equal(stray.length, 1);
  assert.match(stray[0].message, /<\/span> has no matching <span>/);
  const r = v("<h3>Title</h4>\n<p>x</p>");
  const wrong = ofId(r, "html/stray-close-tag")[0];
  assert.match(wrong.message, /the heading opened on line 1 is a <h3>/);
  assert.match(wrong.why, /Did you mean <\/h3>/);
  assert.equal(ofId(r, "html/unclosed-tag").length, 1, "and the <h3> is reported as never closed");
});

test("html: an element shut early by an outer end tag and its own end tag turning up later are ONE finding, not two that contradict", () => {
  const r = v('<div id="a">\n<main>\n<p>x</p>\n</div>\n</main>\n</div>');
  const mis = ofId(r, "html/misnested-tag");
  assert.equal(mis.length, 1);
  assert.equal(mis[0].line, 2);
  assert.match(mis[0].message, /<main> \(line 2\) is shut early by the <\/div> on line 4, so its own <\/main> on line 5 closes nothing/);
  assert.deepEqual(mis[0].related.map((x) => x.line), [4, 5, 1]);
  assert.equal(ofId(r, "html/unclosed-tag").length, 0, "it is not also reported as never closed");
  const stray = ofId(r, "html/stray-close-tag");
  assert.equal(stray.length, 1, "</main> is not also reported as a stray");
  assert.equal(stray[0].line, 6);
  assert.match(stray[0].message, /the <div> it belongs to \(line 1\) was already ended by the <\/div> on line 4/);
  assert.match(stray[0].why, /forced <main> \(line 2\) shut/);
});

test("html: the earliest element left open is named as probably where it went wrong", () => {
  // The <div class="open"> on line 3 is never closed: the </section> on line 4 shuts it. That shifts the nesting, so the </div> on
  // line 6 ends #a instead and forces <main> shut, and <main>'s own </main> then finds nothing.
  const r = v('<div id="a">\n<section>\n<div class="open">\n</section>\n<main>\n</div>\n</main>\n</div>');
  assert.deepEqual(ofId(r, "html/unclosed-tag").map((f) => f.line), [3]);
  const [mis] = ofId(r, "html/misnested-tag");
  assert.equal(mis.data.tag, "main");
  assert.match(mis.why, /first thing left open above it is the <div> on line 3: that is probably where it started/);
  assert.deepEqual(mis.related.map((x) => x.line), [6, 7, 1, 3]);
  // With nothing left open before it, no root is guessed.
  const [none] = ofId(v('<div id="a">\n<main>\n</div>\n</main>\n</div>'), "html/misnested-tag");
  assert.doesNotMatch(none.why, /first thing left open/);
});

test("html: an end tag that matches nothing earlier stays an ordinary stray, and an element with no later end tag stays 'never closed'", () => {
  const stray = v("<div></div></span>");
  assert.equal(ofId(stray, "html/stray-close-tag").length, 1);
  assert.equal(ofId(stray, "html/misnested-tag").length, 0);
  const open = v("<div><section><p>x</p></div>");
  assert.equal(ofId(open, "html/unclosed-tag").length, 1);
  assert.equal(ofId(open, "html/misnested-tag").length, 0);
});

test("html: a closing tag on a void element is an error (</br> adds a line break)", () => {
  const [f] = ofId(v("<p>a<br></br>b</p>"), "html/void-close-tag");
  assert.match(f.message, /<\/br> is not allowed/);
  assert.match(f.why, /line break/);
});

test("html: an unclosed quote, a stray quote, duplicated attributes and missing spaces", () => {
  const r = v('<img src="a.png" alt=" class="card" /><a href="x"target="_blank" class="a" class="b">go</a>');
  assert.ok(ofId(r, "html/unclosed-quote").length >= 1, "alt=\" class=\" leaves a quote where an attribute name should be");
  assert.match(ofId(r, "html/duplicate-attribute")[0].message, /class is written twice/);
  assert.equal(ofId(r, "html/duplicate-attribute")[0].related.length, 1);
  const spacing = ofId(r, "html/attribute-spacing").find((f) => /href/.test(f.message));
  assert.ok(spacing, 'href="x"target= has no space between the attributes');
  assert.equal(spacing.severity, "warning");
  const open = ofId(v('<a href="never closed>x</a>'), "html/unclosed-quote");
  assert.equal(open.length, 1);
});

test("html: comments and the contents of script and style are not read as markup", () => {
  const r = v('<!-- <div><span></div> --><script>var s = "<div>"; if (a < b) {}</script><style>a > b { color: red }</style><p>ok</p>');
  assert.deepEqual(r.findings, []);
  const open = ofId(v("<p>a</p><!-- never closed <p>b</p>"), "html/unclosed-comment");
  assert.equal(open.length, 1);
  assert.equal(open[0].severity, "error");
});

// ---- HTML: omitted end tags are flagged ------------------------------------

test("html: leaving out </li>, </p> or </td> is flagged as a warning, with what ended the element", () => {
  const li = ofId(v("<ul><li>one<li>two</ul>"), "html/missing-end-tag");
  assert.equal(li.length, 2);
  assert.ok(li.every((f) => f.severity === "warning" && f.data.tag === "li"));
  assert.equal(li[0].data.endedBy, "li", "the first </li> was ended by the next <li>");
  assert.equal(li[1].data.endedBy, "ul", "the last by the </ul>");
  assert.match(li[1].why, /ended by the <\/ul> on line 1/);
  assert.equal(li[1].related.length, 1);

  const p = ofId(v("<p>one<p>two"), "html/missing-end-tag");
  assert.equal(p.length, 2);
  assert.match(p[1].why, /the end of the page/);

  const td = ofId(v("<table><tr><td>a<td>b</table>"), "html/missing-end-tag");
  assert.deepEqual(td.map((f) => f.data.tag).sort(), ["td", "td", "tr"]);
});

test("html: explicit end tags are not flagged, and a <ul> inside a <p> is explained through the stray </p>", () => {
  assert.deepEqual(ids(v("<ul><li>a</li><li>b</li></ul><p>x</p><table><tr><td>a</td></tr></table>")), []);
  const r = v("<p>Intro<ul><li>a</li></ul></p>");
  assert.equal(ofId(r, "html/missing-end-tag").length, 1);
  const stray = ofId(r, "html/stray-close-tag")[0];
  assert.match(stray.message, /the <p> on line 1 was closed early by the <ul>/);
  assert.equal(stray.related.length, 2);
});

test("html: the scanner knows where an element with an omitted end tag stops, so containers around it are not blamed", () => {
  const r = v("<div><ul><li>a<li>b</ul></div><p>after</p>");
  assert.equal(ofId(r, "html/unclosed-tag").length, 0);
  const { elements } = scanHtml("<ul><li>a<li>b</ul>");
  assert.deepEqual(elements.filter((e) => e.tag === "li").map((e) => e.end), [9, 14], "each <li> ends where the next <li> or the </ul> starts");
});

// ---- HTML: ids and the things that point at them ---------------------------

test("html: an id used twice is an error on the second, pointing at the first", () => {
  const html = '<div id="a"></div>\n<div id="a"></div><div id="b"></div><div id="b"></div>';
  const fs = ofId(v(html), "html/duplicate-id");
  assert.equal(fs.length, 2);
  assert.equal(fs[0].line, 2);
  assert.deepEqual(fs[0].related.map((r) => r.line), [1]);
  assert.match(fs[0].why, /FIRST element/);
});

test("html: links and controls that point at an id the page does not have", () => {
  const html = `<a href="#there">ok</a><a href="#gone">x</a><a href="#">top</a><div id="there"></div>
    <button data-bs-toggle="collapse" data-bs-target="#nope" aria-controls="nope also-gone">t</button>
    <div data-bs-parent="#missing-group"></div><label for="field">F</label>`;
  const r = v(html), fs = ofId(r, "html/missing-target");
  const by = (t) => fs.filter((f) => f.data.target === t);
  assert.equal(by("gone")[0].severity, "warning");
  assert.equal(by("nope").find((f) => /data-bs-target/.test(f.message)).severity, "error", "Bootstrap finds nothing to toggle");
  assert.equal(by("missing-group")[0].severity, "warning");
  assert.ok(by("also-gone").length && by("field").length);
  assert.equal(by("there").length, 0);
  assert.equal(by("").length, 0, 'href="#" is not a link to an id');
});

// ---- CSS: structure --------------------------------------------------------

test("css: nested, media and string-heavy CSS with comments and url() scans clean", () => {
  const css = `<style>\n/* a { b */\n#page-container { color: red; & a { color: blue; &:hover { text-decoration: none } }\n  @media (max-width: 768px) { .x { margin: 0 } } }\n.y::after { content: "}{;"; background: url("data:image/png;base64,AAA=") }\n@import url(a.css);\n</style>`;
  assert.deepEqual(scanCss(css).findings, []);
});

test("css: a } with nothing to close, and where it probably went wrong (an indented top-level close)", () => {
  const css = `#page-container {\n  a { color: red; }\n  }\n  .b { color: blue; }\n  .c { color: green; }\n}\n`;
  const [f] = scanCss(css).findings;
  assert.equal(f.id, "css/unbalanced-brace");
  assert.equal(f.line, 6);
  assert.equal(f.related.length, 1);
  assert.equal(f.related[0].line, 3);
  assert.match(f.related[0].note, /may be closing it too early/);
  assert.match(f.why, /whole site/);
});

test("css: a { that is never closed, and a declaration outside any rule", () => {
  const open = scanCss(".a { color: red;\n.b { color: blue; }").findings;
  assert.equal(open.length, 1);
  assert.equal(open[0].id, "css/unclosed-brace");
  assert.equal(open[0].line, 1);
  const orphan = scanCss("color: red;\n.a { margin: 0 }").findings;
  assert.equal(orphan[0].id, "css/orphan-declaration");
  assert.equal(orphan[0].line, 1);
  assert.equal(scanCss("/* never closed\n.a { }").findings[0].id, "css/unclosed-comment");
});

// ---- CSS that the HTML never uses ------------------------------------------

const unused = (r) => ofId(r, "css/unused-selector");

test("unused css: a rule whose selector matches nothing is reported, with its size, and the summary counts it", () => {
  const r = v('<div class="a"><p id="x">hi</p></div>', ".a { color: red }\n.gone { color: blue; margin: 0 }\n#x p { top: 0 }");
  assert.deepEqual(unused(r).map((f) => f.message.split(" never")[0]), [".gone", "#x p"]);
  assert.equal(unused(r)[0].data.bytes, ".gone { color: blue; margin: 0 }".length);
  const [s] = ofId(r, "css/unused-summary");
  assert.match(s.message, /^2 of 3 rules/);
  assert.equal(s.data.bytes, unused(r).reduce((n, f) => n + f.data.bytes, 0));
});

test("unused css: what a static page can't show is not reported (hover, pseudo-elements, the host page, runtime state)", () => {
  const css = `a:hover { color: red }
.a::before { content: "" }
.a:focus-visible { outline: 0 }
html { scroll-behavior: smooth }
body > main { overflow: visible }
:root { --c: red }
.acc-btn:not(.collapsed) { color: red }
.acc-btn.collapsed::after { content: "" }
.panel.show { display: block }
.added-by-script { color: red }`;
  const r = v('<a href="#" class="a acc-btn collapsed">x</a><div class="panel"></div>', css, 'el.classList.add("added-by-script")');
  assert.deepEqual(unused(r), []);
});

test("unused css: a selector with only some unused parts, and nested rules shown as the selector they really are", () => {
  const r = v('<div class="card"><img src="a.png" alt=""></div>', "h1, .card, h5 { margin: 0 }\n.card { > iframe { border: 0 } > img { width: 1px } &.big { x: y } }");
  const partial = unused(r).filter((f) => /although/.test(f.message)).map((f) => f.message.split(" never")[0]);
  assert.deepEqual(partial, ["h1", "h5"]);
  assert.deepEqual(unused(r).filter((f) => !/although/.test(f.message)).map((f) => f.message.split(" never")[0]), [".card > iframe", ".card.big"]);
});

test("unused css: an unused rule takes its nested rules with it, and they are not counted twice", () => {
  const r = v("<p>x</p>", ".gone { color: red; .a { x: y } .b { x: y } }");
  assert.equal(unused(r).length, 1);
  assert.match(unused(r)[0].message, /Its 2 nested rules go with it/);
  assert.match(ofId(r, "css/unused-summary")[0].message, /^3 of 3 rules/);
});

test("unused css: media rules and keyframes", () => {
  const r = v('<p class="a">x</p>', "@media (max-width: 600px) { .a { color: red } .nope { color: blue } }\n@keyframes spin { from { x: 0 } to { x: 1 } }");
  assert.deepEqual(unused(r).map((f) => f.message), [".nope never matches anything in the HTML (inside @media (max-width: 600px))."]);
});

test("unused css: custom properties nothing uses are reported, unless HTML or JS reads them", () => {
  const css = ":root { --used: red; --dead: blue; --inline: 1px; --script: 2px; --bs-body-font: x; --thinqi-navbar-height: 0 }\np { color: var(--used) }";
  const r = v('<p style="margin: var(--inline)">x</p>', css, 'getComputedStyle(e).getPropertyValue("--script")');
  assert.deepEqual(ofId(r, "css/unused-variable").map((f) => f.data.name), ["--dead"]);
});

test("unused css: without HTML there is nothing to compare against, and it says so", () => {
  const r = v("", ".a { color: red }");
  assert.deepEqual(unused(r), []);
  assert.equal(ofId(r, "css/unused-skipped").length, 1);
});

// ---- the whole validator ---------------------------------------------------

test("validate: findings come most serious first, then by language and position, with counts", () => {
  const r = v('<div id="a"></div><div id="a"></div><p>x</p><p>y', ".gone { color: red }");
  assert.deepEqual(r.findings.map((f) => f.severity), [...r.findings.map((f) => f.severity)].sort((a, b) => ["error", "warning", "info"].indexOf(a) - ["error", "warning", "info"].indexOf(b)));
  assert.deepEqual(r.counts, { error: 1, warning: 1, info: r.counts.info });
  assert.ok(r.counts.info >= 1);
});

test("validate: a pack adds its own findings", () => {
  const pack = ({ html }) => [{ id: "pack/test", severity: "warning", language: "html", line: 1, column: 1, endLine: 1, endColumn: 2, message: html, why: null, related: [], data: null }];
  const r = validate({ html: "<p>x</p>" }, { packs: [pack] });
  assert.deepEqual(ids(r), ["pack/test"]);
  assert.equal(r.counts.warning, 1);
});

// ---- real pages ------------------------------------------------------------

const read = (name) => readFileSync(new URL(`./fixtures/validate/${name}`, import.meta.url), "utf8");
const page = (n) => validate({ html: read(`example-${n}.html`), css: read(`example-${n}.css`), js: "" });

test("fixtures: example 1 has one root fault (a <div> and <ul> left open) and its consequences, each reported once and consistently", () => {
  const r = page(1);
  // The root: the <div> on line 80 and the <ul> on line 92 are never closed.
  assert.deepEqual(ofId(r, "html/unclosed-tag").map((f) => `${f.data.tag}@${f.line}`), ["div@80", "ul@92"]);
  // The consequences: later end tags land one level out, so <main> and <section> are shut early and their own end tags find nothing.
  const mis = ofId(r, "html/misnested-tag");
  assert.deepEqual(mis.map((f) => `${f.data.tag}@${f.line}`), ["main@26", "section@99"]);
  assert.equal(mis[0].data.shutBy, "div");
  assert.equal(mis[0].data.ownEndLine, 210);
  assert.match(mis[0].why, /first thing left open above it is the <div> on line 80/);
  assert.deepEqual(mis[0].related.map((x) => x.line), [207, 210, 4, 80]);
  // And the final </div> is explained too, instead of contradicting the <main> finding.
  const stray = ofId(r, "html/stray-close-tag");
  assert.deepEqual(stray.map((f) => f.line), [219]);
  assert.match(stray[0].message, /was already ended by the <\/div> on line 207/);
  // No finding says <main> is never closed while another says </main> has nothing to close.
  assert.ok(!r.findings.some((f) => /<main> is never closed/.test(f.message)));
  assert.ok(!r.findings.some((f) => /<\/main> has no matching/.test(f.message)));
  assert.equal(ofId(r, "html/void-close-tag")[0].line, 150);
  assert.equal(r.counts.error, 6);
  assert.equal(r.counts.warning, 0);
});

test("fixtures: example 2 is valid, and its CSS carries rules for sections the page does not have", () => {
  const r = page(2);
  assert.deepEqual(loud(r), []);
  assert.ok(ofId(r, "css/unused-summary").length === 1);
});

test("fixtures: example 3 has three duplicate ids, an unclosed accordion, a wrong heading close, a </p> after a list and a stray CSS brace", () => {
  const r = page(3);
  assert.deepEqual(ofId(r, "html/duplicate-id").map((f) => f.data.id), [
    "accordion-strong-key-skill-areas-strong-ward-manag", "heading-responsibilities-of-the-ward-manager-abo", "collapse-responsibilities-of-the-ward-manager-abo",
  ]);
  assert.deepEqual(ofId(r, "html/unclosed-tag").map((f) => `${f.data.tag}@${f.line}`), ["h3@395", "div@430", "div@431"]);
  assert.ok(ofId(r, "html/unclosed-tag").slice(1).every((f) => /Training Needs Analysis|elements/.test(f.why) && f.data.elementsInside > 10), "the open accordion swallows what follows");
  assert.match(ofId(r, "html/stray-close-tag").find((f) => /<\/h4>/.test(f.message)).why, /Did you mean <\/h3>/);
  assert.match(ofId(r, "html/stray-close-tag").find((f) => /<\/p>/.test(f.message)).message, /closed early by the <ul>/);
  assert.equal(ofId(r, "html/duplicate-attribute")[0].line, 472);
  const brace = ofId(r, "css/unbalanced-brace")[0];
  assert.equal(brace.line, 640);
  assert.deepEqual(brace.related.map((x) => x.line), [95], "it points at the } on line 95 that closes #page-container too early");
});

test("fixtures: example 4 has an unclosed content-body, a stray </p> and a stray </section>", () => {
  const r = page(4);
  assert.deepEqual(ofId(r, "html/unclosed-tag").map((f) => `${f.data.tag}@${f.line}`), ["div@57", "div@68"]);
  assert.deepEqual(ofId(r, "html/stray-close-tag").map((f) => f.line), [82, 135]);
  assert.equal(r.counts.error, 4);
});

// What each page reports, pinned: a change to a rule shows up here. Review the diff, then: UPDATE_SNAPSHOTS=1 node --test test/validate.test.js
const SNAPSHOT = new URL("./snapshots/validate.json", import.meta.url);
const summary = (n) => { const r = page(n); return { counts: r.counts, findings: r.findings.filter((f) => f.severity !== "info").map((f) => `${f.severity} ${f.language} ${f.line}:${f.column} ${f.id}`), info: r.findings.filter((f) => f.severity === "info").map((f) => `${f.line}:${f.column} ${f.id}`) }; };
test("fixtures: what each page reports matches the pinned snapshot", () => {
  const actual = Object.fromEntries([1, 2, 3, 4].map((n) => [`example-${n}`, summary(n)]));
  if (process.env.UPDATE_SNAPSHOTS || !existsSync(SNAPSHOT)) writeFileSync(SNAPSHOT, JSON.stringify(actual, null, 2) + "\n");
  assert.deepEqual(actual, JSON.parse(readFileSync(SNAPSHOT, "utf8")));
});

// ---- false positives: what the builder makes must validate clean ----------------

test("clean: the template's own reference page has no errors and no warnings", () => {
  const t = (f) => readFileSync(new URL(`../template/${f}`, import.meta.url), "utf8");
  const r = validate({ html: t("index.html"), css: t("template.css"), js: t("template.js") });
  assert.deepEqual(loud(r).map((f) => `${f.id} ${f.line} ${f.message}`), []);
});

test("clean: every block's generated HTML, in every fixture variant, has no errors and no warnings", () => {
  for (const [id, variants] of Object.entries(FIXTURES)) for (const [name, values] of Object.entries(variants)) {
    const r = validate({ html: `<div id="page-container">${BLOCKS[id].generateHTML(values)}</div>` });
    assert.deepEqual(loud(r).map((f) => `${f.id} ${f.line}:${f.column} ${f.message}`), [], `${id}/${name}`);
  }
});
