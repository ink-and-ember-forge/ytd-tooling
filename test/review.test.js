// The guided review: where a migrated page differs from the template, as a few decisions grouped by purpose.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILDER_VERSION } from "../src/changelog/index.js";
import { buildMigration } from "../src/changelog/migrate.js";
import { buildReview, affectedElements, cleanSelector, ledgerLine, REASONS, crossDecisionLinks } from "../src/changelog/review.js";
import { buildReport, reportMarkdown } from "../src/changelog/report.js";
import { splitOverrides, ledgerComment } from "../src/changelog/local-edits.js";
import { upgradePage } from "../src/changelog/upgrade.js";
import { loadBaseline } from "../src/lib/baseline.js";

const page = (dir) => ({ html: readFileSync(new URL(`./fixtures/${dir}/page.html`, import.meta.url), "utf8"), css: readFileSync(new URL(`./fixtures/${dir}/page.css`, import.meta.url), "utf8"), js: readFileSync(new URL(`./fixtures/${dir}/page.js`, import.meta.url), "utf8") });
const reference = await loadBaseline("3.1.1");
const review = (dir, options = {}) => { const p = page(dir); const m = buildMigration(p, { reference, ...options }); return { p, m, steps: buildReview(m, p.html) }; };
const keysOf = (m) => m.groups.filter((g) => g.kind === "deviation").map((g) => g.key);

test("review: every difference is in exactly one decision, and there are far fewer decisions than differences", () => {
  for (const [dir, decisions, differences] of [["legacy", 5, 18], ["legacy2", 5, 21], ["legacy3", 6, 21]]) {
    const { m, steps } = review(dir);
    assert.equal(keysOf(m).length, differences, `${dir}: differences`);
    assert.equal(steps.length, decisions, `${dir}: ${steps.map((s) => s.title).join(" | ")}`);
    assert.deepEqual(steps.flatMap((s) => s.keys).sort(), keysOf(m).sort(), `${dir}: nothing is lost or asked twice`);
    for (const s of steps) assert.ok(s.why && s.lines.length && s.headline && s.id, `${dir}/${s.title} is explained`);
  }
});

test("review: differences are grouped by what they are for, not by selector", () => {
  const { steps } = review("legacy2");
  const by = (title) => steps.find((s) => s.title === title);
  const keys = (title) => by(title).keys.map((k) => k.replace("differs:", ""));
  assert.deepEqual(keys("Text and headings").sort(), ["#page-container", ".content-column h4", "h5", "ol li::marker", "strong"].sort(),
    "text rules, and the --heading-4 variable the h4 rule uses (ol is decided with the breadcrumb fix, below)");
  assert.ok(keys("Your phone and tablet layout").includes(".main-grid") && keys("Your phone and tablet layout").includes("#table-of-contents") && keys("Your phone and tablet layout").length === 9,
    "the page's phone layout is one decision, not nine");
  assert.ok(keys("Fixes that use !important").includes("a") && !keys("Fixes that use !important").includes("#breadcrumb-nav #breadcrumb-nav__list"), "the breadcrumb fix has moved with the rule it undoes");
  assert.deepEqual(keys("Page header, contents list and layout"), ["#header-h1"]);
  assert.equal(by("Your phone and tablet layout").width, "phone", "a phone-layout decision is shown at phone width");
  assert.equal(by("Text and headings").width, "desktop");
  // Components are named after the block they belong to.
  assert.ok(review("legacy").steps.some((s) => s.title === "Buttons component"));
  assert.ok(review("legacy3").steps.some((s) => s.title === "Icon-toggle component"));
});

test("review: each decision says what changes in plain words and what the template does instead", () => {
  const { steps } = review("legacy2");
  const text = steps.find((s) => s.title === "Text and headings");
  assert.match(text.headline, /^Changes .*text weight/);
  const strong = text.lines.find((l) => l.where === "strong");
  assert.deepEqual({ label: strong.label, mine: strong.mine, template: strong.template }, { label: "text weight", mine: "bold", template: null }, "no template equivalent");
  const header = steps.find((s) => s.title === "Page header, contents list and layout").lines.find((l) => l.where === "#header-h1");
  assert.deepEqual({ label: header.label, mine: header.mine, template: header.template }, { label: "space above and below", mine: "1.5rem 1rem", template: "1.5rem" }, "the template's own value");
  assert.match(steps.find((s) => s.title === "Fixes that use !important").why, /beat another stylesheet/);
});

test("review: how many elements of THIS page each decision touches, counted from the HTML", () => {
  const { p, steps } = review("legacy2");
  assert.equal(affectedElements(p.html, ["strong"]).count, (p.html.match(/<strong\b/g) || []).length);
  assert.equal(affectedElements(p.html, ["h5", "h4"]).count, (p.html.match(/<h[45]\b/g) || []).length, "distinct elements across selectors");
  assert.equal(affectedElements(p.html, ["strong", "strong"]).count, affectedElements(p.html, ["strong"]).count, "an element is not counted twice");
  assert.equal(affectedElements(p.html, [".nothing-like-this"]).count, 0);
  assert.ok(steps.every((s) => typeof s.elements === "number" && s.elements >= 0));
  assert.deepEqual(steps.map((s) => s.elements), [...steps.map((s) => s.elements)].sort((a, b) => b - a), "the decision that touches the most comes first");
  assert.equal(steps[0].title, "Text and headings");
});

test("review: states and pseudo-elements are ignored when matching, and unreadable selectors never throw", () => {
  assert.equal(cleanSelector("li:not(:last-child)::after"), "li:not(:last-child)");
  assert.equal(cleanSelector(".a:hover"), ".a");
  assert.equal(cleanSelector("#x >"), "#x");
  assert.equal(cleanSelector(".x::marker"), ".x");
  assert.equal(affectedElements("<ul><li>a</li><li>b</li></ul>", ["li:not(:last-child)::after", "li:hover"]).count, 2);
  assert.doesNotThrow(() => affectedElements("<p>x</p>", ["p[", ":::bad", ""]));
  assert.deepEqual(affectedElements("<p>x</p>", ["p", "p["]).selectors, ["p"]);
});

test("review: a reason is a short list plus a note, written as the page's own comment", () => {
  assert.deepEqual(REASONS.map(([id]) => id), ["design", "problem", "unsure"]);
  const step = { title: "Text and headings" };
  assert.equal(ledgerLine(step, { reason: "design", note: "bold is our house style" }), "Text and headings: A deliberate design choice, bold is our house style");
  assert.equal(ledgerLine(step, { reason: "problem" }), "Text and headings: It fixes a problem (say which)");
  assert.equal(ledgerLine(step), "Text and headings: Not sure yet", "no reason given is 'not sure', never blank");
  assert.equal(ledgerComment("a */ b\nc"), "/* kept: a * / b c */", "a note can't end the comment early");
});

test("review: kept reasons are written into the overrides block, and survive a later upgrade", async () => {
  const { p, steps } = review("legacy2");
  const strongStep = steps.find((s) => s.title === "Text and headings");
  const ledger = [ledgerLine(strongStep, { reason: "design", note: "bold is our house style" })];
  const kept = buildMigration(p, { reference, keepGroups: strongStep.keys, ledger });
  const region = kept.css.slice(kept.css.indexOf("/* ===== PAGE-SPECIFIC"));
  assert.match(region, /\/\* kept: Text and headings: A deliberate design choice, bold is our house style \*\//);
  assert.match(region, /strong \{\s*font-weight: bold;/);
  assert.deepEqual(splitOverrides(kept.css).ledger, ledger);
  // a rule that is not kept leaves no reason behind
  const none = buildMigration(p, { reference, keepGroups: [] });
  assert.doesNotMatch(none.css, /kept:/);
  // upgrading the migrated page later carries the reason with the rules
  const next = await upgradePage({ html: kept.html, css: kept.css, js: kept.js });
  assert.equal(next.pageVersion, BUILDER_VERSION);
  assert.deepEqual(splitOverrides(next.css).ledger, ledger, "the reason is still there");
  assert.match(next.css, /strong \{\s*font-weight: bold;/);
  assert.equal(next.css.split("kept: Text and headings").length, 2, "and not duplicated");
});

test("review: the preview leads with the most-affected selector, and a phone layout is shown from the top", () => {
  const { p, steps } = review("legacy2");
  const text = steps.find((s) => s.title === "Text and headings");
  assert.equal(text.selectors[0], "strong", "22 bold elements make a better example than the one breadcrumb list");
  assert.equal(text.scroll, "first");
  const counts = text.selectors.map((s) => affectedElements(p.html, [s]).count);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a), "most affected first");
  assert.ok(counts.every((n) => n > 0), "a selector that matches nothing is not offered");
  const phone = steps.find((s) => s.title === "Your phone and tablet layout");
  assert.equal(phone.scroll, "top", "order differences show at the top of the page");
  const labels = phone.lines.filter((l) => l.where === ".back-to-top").map((l) => l.label);
  assert.deepEqual(labels.sort(), ["distance from the bottom edge", "distance from the right edge"], "two different properties are not both called 'position'");
});

// ---- decisions that depend on each other are decided together -------------------------------
// The page's `ol { list-style-type: decimal !important }` numbers the breadcrumb list too, and a separate !important rule on the
// breadcrumb undoes it. Decided apart, "keep the ol rule, use the template for the fix" numbers the breadcrumb: a state nobody chose.

test("linking: rules that set the same property on the same element are one decision, whatever their purpose", () => {
  const { steps } = review("legacy2");
  const linked = steps.find((s) => s.title === "Rules that work together: list markers and spacing inside (left)");
  assert.ok(linked, steps.map((s) => s.title).join(" | "));
  assert.deepEqual(linked.keys.sort(), ["differs:#breadcrumb-nav #breadcrumb-nav__list", "differs:ol"]);
  assert.match(linked.why, /ol and #breadcrumb-nav #breadcrumb-nav__list both set list markers and spacing inside \(left\) on the same element/);
  assert.match(linked.why, /decided together/);
  assert.equal(linked.elements, 2, "the breadcrumb list and the numbered list of the page");
  assert.equal(linked.linked.length, 1, "one sentence per pair of rules, naming every property they share");
});

test("linking: rules that are linked but already in one decision stay there, with a note", () => {
  const { steps } = review("legacy");
  assert.equal(steps.some((s) => s.title.startsWith("Rules that work together")), false);
  const buttons = steps.find((s) => s.title === "Buttons component");
  assert.ok(buttons.keys.includes("differs:.buttons a") && buttons.keys.includes("differs:.buttons a:hover"), "the normal and hover rules are in the same decision");
  assert.match(buttons.linked.join(" "), /\.buttons a and \.buttons a:hover both set background colour/, "a button's colour and its hover colour belong together");
});

test("linking: no two decisions touch the same property of the same element, on any real page", () => {
  for (const dir of ["legacy", "legacy2", "legacy3"]) {
    const { p, steps } = review(dir);
    assert.deepEqual(crossDecisionLinks(steps, p.html), [], `${dir}: decisions are independent`);
  }
  // the check itself can fail: the same property on the same element in two different decisions is reported
  const fake = [
    { title: "A", lines: [{ where: "p", media: null, prop: "color" }] },
    { title: "B", lines: [{ where: ".x", media: null, prop: "color" }, { where: "p", media: "@media (max-width: 600px)", prop: "color" }] },
  ];
  assert.deepEqual(crossDecisionLinks(fake, '<p class="x">t</p>'), [{ a: "A", b: "B", key: "|color" }], "a different media query is not a clash");
});

// ---- the final report --------------------------------------------------------------------

const report = (dir, decide, options = {}) => {
  const { p, m, steps } = review(dir, options);
  const decisions = new Map(steps.map((s) => [s.id, decide(s)]));
  const keys = steps.filter((s) => decisions.get(s.id).choice === "keep").flatMap((s) => s.keys);
  const final = buildMigration(p, { reference, keepGroups: [...m.groups.filter((g) => g.kind === "custom").map((g) => g.key), ...keys] });
  return { steps, r: buildReport(final, steps, decisions, { date: "2026-11-20" }), final };
};
const keep = (reason, note = "") => ({ choice: "keep", reason, note });
const tpl = { choice: "template", reason: "", note: "" };

test("report: totals, the reasons for what was kept, and what the page takes from the template", () => {
  const { steps, r } = report("legacy2", (s) => (s.title === "Text and headings" ? keep("design", "bold is our house style") : s.title === "Your phone and tablet layout" ? keep("problem", "the contents list must come first on phones") : tpl));
  assert.deepEqual(r.totals, { differences: 21, decisions: 5, kept: 2, template: 3, components: 4, componentsKept: 4, htmlChanges: 2 });
  assert.deepEqual(r.kept.map((k) => [k.title, k.reason, k.note]), [
    ["Text and headings", "A deliberate design choice", "bold is our house style"],
    ["Your phone and tablet layout", "It fixes a problem (say which)", "the contents list must come first on phones"],
  ]);
  assert.deepEqual(r.template.map((t) => t.title), steps.filter((s) => !["Text and headings", "Your phone and tablet layout"].includes(s.title)).map((s) => s.title));
  assert.equal(r.theme, "Gwella");
  assert.equal(r.date, "2026-11-20");
});

test("report: Markdown a person can keep, with the reasons, the changes and what is still worth a look", () => {
  const { r } = report("legacy2", (s) => (s.title === "Text and headings" ? keep("design", "bold is our house style") : s.title === "Fixes that use !important" ? keep("unsure") : tpl));
  const md = reportMarkdown(r);
  assert.match(md, /^# Migration report\n\nMigrated to template version [\d.]+ · theme Gwella · 2026-11-20/);
  assert.match(md, /- \*\*Kept as your own: 2\.\*\* Following the template: 3\./);
  const kept = md.slice(md.indexOf("## Kept as your own"), md.indexOf("## Following the template"));
  assert.match(kept, /### Text and headings\n\n- \*\*Why:\*\* A deliberate design choice\. bold is our house style/);
  assert.match(kept, /- \*\*Affects:\*\* \d+ elements on this page/);
  assert.match(kept, /strong — text weight: yours `bold`, template `not set`/, "what it overrides, against the template");
  assert.match(kept, /### Fixes that use !important\n\n- \*\*Why:\*\* Not sure yet/);
  const following = md.slice(md.indexOf("## Following the template"), md.indexOf("## Your own components"));
  assert.match(following, /### Your phone and tablet layout/);
  assert.match(following, /On small screens: \.main-grid — gap between items: yours `1rem`, template `0`/);
  assert.match(md, /## Your own components \(4\)\n\n- inline-icon: carried over/);
  assert.match(md, /## Changes to your HTML\n\n- Added the Gwella theme class/);
  assert.match(md, /## Still worth a look\n\n- Revisit "Fixes that use !important": you kept it but weren't sure why\./);
});

test("report: everything that needs a second look is listed, and a clean migration says so", () => {
  const { r } = report("legacy3", (s) => (s.title === "Text and headings" ? keep("problem") : tpl));
  assert.ok(r.toCheck.some((c) => /"Text and headings" was kept to fix a problem, but no note says which/.test(c)));
  assert.ok(r.toCheck.some((c) => /problems? in the page's own HTML tags/.test(c)), "the page's own HTML faults");
  assert.ok(r.toCheck.some((c) => /older version of the Icon-toggle block/.test(c)), "the migration's own notes");
  const none = report("legacy2", () => tpl).r;
  assert.ok(none.toCheck.every((c) => !/Revisit|no note says which/.test(c)));
  assert.match(reportMarkdown({ ...none, toCheck: [] }), /## Still worth a look\n\nNothing flagged\./);
  assert.match(reportMarkdown(none), /## Kept as your own \(0\)\n\nNothing: the page follows the template everywhere\./);
  assert.match(reportMarkdown(report("legacy2", () => keep("design")).r), /## Following the template \(0\)\n\nThe page now takes these[\s\S]*Nothing: every difference was kept\./);
});

test("report: a component that was not carried is called out", () => {
  const { p, steps } = review("legacy2");
  const final = buildMigration(p, { reference, keepGroups: ["inline-icon"] });
  const r = buildReport(final, steps, new Map(), { date: "2026-11-20" });
  assert.equal(r.totals.componentsKept, 1);
  assert.match(reportMarkdown(r), /- resource-card: \*\*not carried\*\*/);
  assert.ok(r.toCheck.some((c) => /Not carried: resource-card\. Anything using it has lost its styling/.test(c)));
});
