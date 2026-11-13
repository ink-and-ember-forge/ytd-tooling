// The guided review: where a migrated page differs from the template, as a few decisions grouped by purpose.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILDER_VERSION } from "../src/changelog/index.js";
import { buildMigration } from "../src/changelog/migrate.js";
import { buildReview, affectedElements, cleanSelector, ledgerLine, REASONS } from "../src/changelog/review.js";
import { splitOverrides, ledgerComment } from "../src/changelog/local-edits.js";
import { upgradePage } from "../src/changelog/upgrade.js";
import { loadBaseline } from "../src/lib/baseline.js";

const page = (dir) => ({ html: readFileSync(new URL(`./fixtures/${dir}/page.html`, import.meta.url), "utf8"), css: readFileSync(new URL(`./fixtures/${dir}/page.css`, import.meta.url), "utf8"), js: readFileSync(new URL(`./fixtures/${dir}/page.js`, import.meta.url), "utf8") });
const reference = await loadBaseline("3.1.1");
const review = (dir, options = {}) => { const p = page(dir); const m = buildMigration(p, { reference, ...options }); return { p, m, steps: buildReview(m, p.html) }; };
const keysOf = (m) => m.groups.filter((g) => g.kind === "deviation").map((g) => g.key);

test("review: every difference is in exactly one decision, and there are far fewer decisions than differences", () => {
  for (const [dir, decisions, differences] of [["legacy", 5, 18], ["legacy2", 4, 21], ["legacy3", 5, 21]]) {
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
  assert.deepEqual(keys("Text and headings").sort(), ["#page-container", ".content-column h4", "h5", "ol", "ol li::marker", "strong"].sort(),
    "text rules, and the --heading-4 variable the h4 rule uses");
  assert.ok(keys("Your phone and tablet layout").includes(".main-grid") && keys("Your phone and tablet layout").includes("#table-of-contents") && keys("Your phone and tablet layout").length === 9,
    "the page's phone layout is one decision, not nine");
  assert.ok(keys("Fixes that use !important").includes("a") && keys("Fixes that use !important").includes("#breadcrumb-nav #breadcrumb-nav__list"));
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
