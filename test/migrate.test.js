// Migrating a page built before 3.1.0. The fixture in test/fixtures/legacy/ is a real legacy page
// (flat CSS, --burgundy tokens, no marker, no theme class, <img> back-to-top, broken tags).
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS } from "../src/blocks/index.js";
import { getPageJS } from "../src/base/index.js";
import { FIXTURES } from "./fixtures.js";
import { BUILDER_VERSION } from "../src/changelog/index.js";
import { parseCss } from "../src/changelog/css-tree.js";
import { upgradePage } from "../src/changelog/upgrade.js";
import { loadBaseline, baselinePage } from "../src/lib/baseline.js";
import {
  assessFit, detectTheme, translateValue, flattenRules, specificity, splitList, tagProblems, migrateHtml, lintPage, customJs, buildMigration,
} from "../src/changelog/migrate.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/legacy/${name}`, import.meta.url), "utf8");
const legacy = () => ({ html: fixture("page.html"), css: fixture("page.css"), js: fixture("page.js") });
const fixture2 = (name) => readFileSync(new URL(`./fixtures/legacy2/${name}`, import.meta.url), "utf8");
const legacy2 = () => ({ html: fixture2("page.html"), css: fixture2("page.css"), js: fixture2("page.js") });
const reference = await loadBaseline("3.1.1"); // what the template said when it was first stored

// ---- is it a migration? ----------------------------------------------------

test("fit: the real legacy page is a migration, and says why", () => {
  const fit = assessFit(legacy());
  assert.equal(fit.legacy, true);
  assert.equal(fit.signals.length, 4);
  assert.ok(fit.signals.some((s) => /flat stylesheet/.test(s)));
  assert.ok(fit.signals.some((s) => /--burgundy/.test(s)));
  assert.ok(fit.signals.some((s) => /no version marker/.test(s)));
  assert.ok(fit.signals.some((s) => /no theme class/.test(s)));
});

test("fit: current pages, HTML-only pastes and 3.0.x token pages are classified correctly", async () => {
  const b = await loadBaseline("3.3.0");
  const current = baselinePage(b, { blockIds: ["accordion"] });
  assert.equal(assessFit(current).legacy, false, "a current page is not legacy");
  assert.equal(assessFit({ html: "<div id=\"page-container\"></div>", css: "" }).legacy, false, "no CSS pasted: nothing to judge");
  const v3 = { html: current.html, css: current.css.replace(/--primary-colour/g, "--navy") };
  assert.equal(assessFit(v3).legacy, true, "pages from before the token rename are migrated");
});

test("theme: detected from the old brand colour or token, never guessed when it is ambiguous", () => {
  assert.equal(detectTheme(":root { --burgundy: #a3195b; }"), "gwella");
  assert.equal(detectTheme(".a { color: #A3195B }"), "gwella");
  assert.equal(detectTheme(":root { --navy: #325083; }"), "ytydysgu");
  assert.equal(detectTheme(":root { --navy: #325083; } .a { color: #a3195b }"), null);
  assert.equal(detectTheme("p { color: red }"), null);
});

// ---- the pieces ------------------------------------------------------------

test("values: old tokens become theme tokens, and the theme's own colour follows the theme", () => {
  assert.deepEqual(translateValue("var(--burgundy)", "gwella"), { value: "var(--primary-colour)", changes: ["--burgundy → --primary-colour"] });
  assert.equal(translateValue("color-mix(in srgb, var(--burgundy), #000 15%)", null).value, "color-mix(in srgb, var(--primary-colour), #000 15%)");
  assert.equal(translateValue("var(--light-burgundy)", null).value, "var(--secondary-colour)");
  assert.equal(translateValue("#a3195b", "gwella").value, "var(--primary-colour)");
  assert.equal(translateValue("#a3195b", "ytydysgu").value, "#a3195b", "another theme's colour is left alone");
  assert.equal(translateValue("#a3195b", null).value, "#a3195b", "no theme chosen yet: no guessing");
  assert.equal(translateValue("var(--heading-1)", "gwella").value, "var(--heading-1)");
});

test("selectors: lists split on top-level commas, nesting resolves, specificity compares", () => {
  assert.deepEqual(splitList(":is(.a, .b) c, d"), [":is(.a, .b) c", "d"]);
  const rules = flattenRules(parseCss(".a, .b { color: red; &:hover { color: blue } .c { margin: 0; @media (max-width: 600px) { margin: 1px } } }"));
  assert.deepEqual(rules.map((r) => [r.items.join(" | "), r.media]), [
    [".a | .b", null], [".a:hover | .b:hover", null], [".a .c | .b .c", null], [".a .c | .b .c", "@media (max-width: 600px)"],
  ]);
  assert.ok(specificity("#page-container .x") > specificity(".x"));
  assert.ok(specificity(".x:hover") > specificity(".x"));
  assert.ok(specificity("p") < specificity(".x"));
  assert.equal(specificity("li:not(.z)"), specificity("li.z"));
});

// ---- the analysis of the real page -------------------------------------------

test("analysis: the old CSS sorts into what is replaced, what is dropped and the 12 groups of the page's own design", () => {
  const m = buildMigration(legacy(), { reference });
  assert.deepEqual(m.groups.filter((g) => g.kind === "custom").map((g) => g.key), [
    "cta-button", "intro-text", "journey-section", "journey-image", "journey-content", "important-label",
    "gwella-message", "burgundy-link", "desktop-image", "mobile-image", "info-section", "text",
  ]);
  assert.deepEqual(Object.fromEntries(Object.entries(m.dropped).map(([k, v]) => [k, v.length])), { base: 23, standard: 30, unused: 26 },
    "dropped = rules that match the template, plus rules for classes that are not on this page");
  const unused = m.dropped.unused.map((d) => d.selector).join(" | ");
  assert.match(unused, /#at-a-glance/);
  assert.match(unused, /\.lower-image-section/);
  assert.match(unused, /#further-resources \.card/);
  assert.equal(m.dropped.unused.some((d) => /journey|info-section/.test(d.selector) && !/lower-image/.test(d.selector)), false,
    "a comma list with one unused selector keeps its used selectors (e.g. '.lower-image-section, .journey-section')");
});

test("analysis: tokens translated, undefined variables flagged, duplicates merged by specificity", () => {
  const m = buildMigration(legacy());
  assert.equal(m.theme, "gwella");
  const region = m.css.slice(m.css.indexOf("/* ===== PAGE-SPECIFIC"));
  assert.doesNotMatch(region, /--burgundy|#a3195b/i, "no legacy token or literal brand colour in the carried styles (the base CSS defines the colour itself)");
  const cta = m.groups.find((g) => g.key === "cta-button");
  assert.ok(cta.notes.some((n) => /--burgundy → --primary-colour/.test(n)));
  assert.ok(cta.notes.some((n) => /--buttons is not defined anywhere/.test(n)));
  assert.ok(cta.notes.some((n) => /defined more than once/.test(n)));
  assert.equal(cta.rules.filter((r) => r.selector === ".cta-button").length, 1, "the three .cta-button definitions became one");
  const base = cta.rules.find((r) => r.selector === ".cta-button");
  assert.deepEqual(base.decls.get("color"), ["#fff"], "the more specific '#page-container .cta-button' wins over the later '.cta-button'");
  const info = m.groups.find((g) => g.key === "info-section");
  assert.deepEqual(info.rules.find((r) => !r.media).decls.get("gap"), ["3rem"], "the later duplicate wins when specificity is equal");
  assert.equal(m.lint.undefinedVars.join(), "--buttons");
});

test("cascade: a stronger selector keeps beating a weaker one that comes later", () => {
  const css = "#page-container .x { color: red; }\n.x { color: blue; margin: 0; }";
  const html = '<div id="page-container"><p class="x"></p></div>';
  const rule = buildMigration({ html, css, js: "" }).groups[0].rules[0];
  assert.deepEqual([rule.decls.get("color"), rule.decls.get("margin")], [["red"], ["0"]]);
});

test("output: the carried styles are nested under #page-container, media queries included, in the overrides region", () => {
  const m = buildMigration(legacy());
  const tree = parseCss(m.css);
  assert.equal(tree.unbalanced, false);
  assert.equal(m.css.split("PAGE-SPECIFIC OVERRIDES:").length, 2, "exactly one region");
  const region = m.css.slice(m.css.indexOf("/* ===== PAGE-SPECIFIC"));
  const carried = parseCss(region).children.find((c) => c.selector === "#page-container");
  assert.ok(carried.children.some((c) => c.selector === ".journey-image"));
  assert.ok(carried.children.some((c) => c.selector === "@media (max-width: 768px)" && c.children.some((r) => r.selector === ".mobile-image")));
  assert.ok(carried.children.some((c) => c.selector === "#intro-text p:first-of-type"));
  assert.doesNotMatch(region, /#page-container \./, "the prefix is stripped; the nesting supplies it");
});

test("cascade: a media rule stays after the plain rule it overrides, however the groups are ordered", () => {
  const m = buildMigration(legacy());
  const region = parseCss(m.css.slice(m.css.indexOf("/* ===== PAGE-SPECIFIC"))).children.find((c) => c.selector === "#page-container");
  const kids = region.children;
  const plain = kids.findIndex((c) => c.selector === ".desktop-image");
  const media = kids.findIndex((c) => c.selector.startsWith("@media") && c.children.some((r) => r.selector === ".desktop-image"));
  assert.ok(plain >= 0 && media >= 0, "both the plain and the media rule are carried");
  assert.ok(media > plain, "the media rule comes later, so it wins on a phone");
  assert.ok(media > kids.findIndex((c) => c.selector === ".mobile-image"), "...and after every plain rule it overrides");
  // Source order is kept in the other direction too: here the plain rule comes LAST in the old CSS, so it keeps winning.
  const html = '<div id="page-container"><p class="a"></p><p class="b"></p></div>';
  const css = "@media (max-width: 600px) { .a { color: red; } }\n.a { color: blue; }\n.b { margin: 0; }\n@media (max-width: 600px) { .b { margin: 1px; } }";
  const order = parseCss(buildMigration({ html, css, js: "" }).css.slice(buildMigration({ html, css, js: "" }).css.indexOf("/* ===== PAGE-SPECIFIC"))).children[0].children.map((c) => c.selector);
  assert.deepEqual(order, ["@media (max-width: 600px)", ".a", ".b", "@media (max-width: 600px)"], "two separate media blocks, because rules sit between them");
});

test("choices: keep only some groups, and a different or missing theme", () => {
  const some = buildMigration(legacy(), { keepGroups: ["cta-button"] });
  assert.deepEqual(some.groups.filter((g) => g.kept).map((g) => g.key), ["cta-button"]);
  assert.match(some.css, /\.cta-button/);
  assert.doesNotMatch(some.css, /\.journey-section/);
  const none = buildMigration(legacy(), { keepGroups: [] });
  assert.doesNotMatch(none.css, /PAGE-SPECIFIC/);

  const navy = buildMigration(legacy(), { theme: "ytydysgu" });
  assert.match(navy.html, /id="page-container" class="ytydysgu"/);
  assert.match(navy.css, /color: #a3195b|#a3195b/, "the Gwella literal stays when the theme is Y Tŷ Dysgu");

  const undecided = buildMigration({ ...legacy(), css: legacy().css.replace(/--burgundy: #a3195b;/, "").replace(/#a3195b/gi, "#123456").replace(/var\(--burgundy\)/g, "red") });
  assert.equal(undecided.theme, null);
  assert.equal(undecided.ready, false);
  assert.doesNotMatch(undecided.html, /class="(gwella|ytydysgu)"/);
  assert.equal(buildMigration(legacy(), { theme: "gwella" }).ready, true);
});

// ---- the HTML --------------------------------------------------------------

test("html: marker, theme class and back-to-top icon, each reported with before and after", () => {
  const m = buildMigration(legacy());
  assert.deepEqual(m.htmlChanges.map((c) => c.id), ["container", "back-to-top"]);
  assert.equal(m.htmlChanges[0].before, '<div id="page-container">');
  assert.equal(m.htmlChanges[0].after, `<div id="page-container" class="gwella" data-base-version="${BUILDER_VERSION}">`);
  assert.match(m.html, /<button class="back-to-top"[^>]*>\s*<i class="fa-solid fa-circle-chevron-up" aria-hidden="true"><\/i>\s*<span>Back to Top<\/span>/);
  assert.doesNotMatch(m.html, /back-to-top\.png/);
  const rest = (h) => h.replace(/<div id="page-container"[^>]*>/, "").replace(/<img[^>]*back-to-top[^>]*>|<i class="fa-solid fa-circle-chevron-up"[^>]*><\/i>/, "");
  assert.equal(rest(m.html), rest(legacy().html), "nothing else in the HTML was touched");
});

test("html: an existing class and an old marker are merged, not duplicated", () => {
  const r = migrateHtml('<div id="page-container" class="x gwella" data-base-version="3.0.0">', { theme: "ytydysgu" });
  assert.equal(r.html, `<div id="page-container" class="x ytydysgu" data-base-version="${BUILDER_VERSION}">`);
  assert.equal(migrateHtml("<p>no container</p>", { theme: "gwella" }).changes.length, 0);
});

test("html: broken tags are reported with line numbers, and clean HTML reports none", () => {
  const problems = tagProblems(legacy().html);
  assert.ok(problems.some((p) => /<ul> on line \d+ is never closed/.test(p)));
  assert.ok(problems.some((p) => /Stray <\/br>/.test(p)));
  assert.ok(problems.some((p) => /Stray <\/div>/.test(p)));
  assert.deepEqual(tagProblems("<!-- <div> --><div><p>a<br><img src=x></p></div><script>if (a<b) {}</script>"), []);
});

// ---- checking the result ----------------------------------------------------

test("lint: a page whose custom styles were not carried shows exactly the classes that lost their styling", () => {
  const dropped = buildMigration(legacy(), { keepGroups: [] });
  assert.deepEqual(dropped.lint.unstyledClasses.sort(), [
    "burgundy-link", "cta-button", "desktop-image", "gwella-message", "important-label", "info-section", "journey-content", "journey-image", "journey-section", "mobile-image", "text",
  ].sort());
  assert.deepEqual(buildMigration(legacy()).lint.unstyledClasses, [], "carrying them all leaves nothing unstyled");
  assert.deepEqual(lintPage({ html: '<p class="fa-solid accordion-item mine">', css: ".mine { color: red }" }).unstyledClasses, [], "icon and framework classes are not reported");
});

test("js: the standard JS replaces the old one; a selector it does not know is reported", () => {
  const standard = getPageJS([]);
  assert.deepEqual(customJs(legacy().js, standard), [], "the old base JS only looks for elements the new JS also handles");
  assert.deepEqual(customJs(legacy().js + '\ndocument.querySelector(".my-thing");', standard), [".my-thing"]);
  const m = buildMigration({ ...legacy(), js: legacy().js + '\ndocument.getElementById("mine");' });
  assert.ok(m.notes.some((n) => /mine/.test(n)));
});

// ---- after migrating, the page is an ordinary page ------------------------------

test("a migrated page is an ordinary current page: it needs no migration and an upgrade leaves it as it is", async () => {
  const m = buildMigration(legacy());
  const page = { html: m.html, css: m.css, js: m.js };
  assert.equal(assessFit(page).legacy, false);
  const r = await upgradePage(page);
  assert.equal(r.pageVersion, BUILDER_VERSION);
  assert.equal(r.upToDate, true);
  assert.deepEqual(r.edits, [], "the carried styles are in the overrides region, so they are not new edits");
  assert.equal(r.css.replace(/\s+/g, " "), m.css.replace(/\s+/g, " "), "the region is carried forward unchanged");
});


// ---- where the page differs from the template -------------------------------------
// The second real page: the template's own blocks plus many deliberate overrides of the standard. Sorting rules by
// the NAMES they use dropped all of those (strong, h4, h5, the page's mobile ordering...), so each declaration is
// now compared with what the template actually says.

const deviations = (m) => Object.fromEntries(m.groups.filter((g) => g.kind === "deviation").map((g) => [g.key.replace("differs:", ""), g.against]));

test("deviations: the page's own overrides of the template are found, each with what the template says instead", () => {
  const m = buildMigration(legacy2(), { reference });
  assert.equal(m.theme, "gwella");
  assert.deepEqual(m.blocks, ["at-a-glance", "accordion", "icon-toggle"]);
  assert.deepEqual(m.groups.filter((g) => g.kind === "custom").map((g) => g.key), ["inline-icon", "accordion-text", "resource-card-grid", "resource-card"]);
  const d = deviations(m);
  assert.deepEqual(d.strong, ["strong: font-weight: bold  (template: nothing)"], "a rule the template has no equivalent of");
  assert.deepEqual(d["#header-h1"], ["#header-h1: margin-block: 1.5rem 1rem  (template: 1.5rem)"], "a different value for a property the template sets");
  assert.deepEqual(d.h5, ["h5: color: var(--primary-colour)  (template: nothing)"], "an added property on a selector the template does style");
  assert.ok(d[".content-column h4"].some((l) => /font-weight: 600/.test(l)));
  assert.ok(d["#at-a-glance #at-a-glance-heading"].some((l) => /color: #000 !important  \(template: #a3195b\)/.test(l)), "the page's black heading beats the themed one, as the page intended");
  assert.ok(d.ol.some((l) => /list-style-type: decimal !important  \(template: decimal\)/.test(l)), "!important is a difference");
  assert.ok(d[".main-grid"].some((l) => /@media \(max-width: 768px\) \.main-grid: gap: 1rem  \(template: 0\)/.test(l)), "the page's own mobile layout");
  assert.ok(d["#table-of-contents"].some((l) => /order: 2  \(template: 3\)/.test(l)));
});

test("deviations: not noise: matches of the template, dead rules and legacy tokens are not carried", () => {
  const m = buildMigration(legacy2(), { reference });
  const keys = m.groups.filter((g) => g.kind === "deviation").map((g) => g.key.replace("differs:", ""));
  for (const matching of ["p", "ul", "li", ".standard-container", ".header", ".content-column h2", ".data-icon-card"]) assert.equal(keys.includes(matching), false, `${matching} matches the template`);
  assert.equal(keys.includes(".back-to-top > img"), false, "its image became the standard icon, so the rule that sized the image is dead");
  assert.equal(keys.includes("#data-icons-grid"), false, "an id the page does not have");
  const region = m.css.slice(m.css.indexOf("/* ===== PAGE-SPECIFIC"));
  assert.doesNotMatch(region, /--burgundy|--light-burgundy/, "legacy tokens are not redefined");
  assert.match(region, /--heading-4: 1rem/, "but a custom property that carried rules use is");
  assert.match(region, /font-size: var\(--heading-4\)/);
});

test("deviations: an old template value is not mistaken for the author's choice (that is what the stored version is for)", () => {
  const without = deviations(buildMigration(legacy2()));
  const withReference = deviations(buildMigration(legacy2(), { reference }));
  assert.ok(without[".main-grid"].some((l) => /grid-template-columns: 1fr 3fr  \(template: 1\.3fr 3fr\)/.test(l)), "alone, the old 1fr 3fr looks like a deviation");
  assert.deepEqual(withReference[".main-grid"].map((l) => l.replace(/\s+\(template:.*$/, "")), ["@media (max-width: 768px) .main-grid: gap: 1rem"], "it was the template's own old value, so only the real difference is left");
});

test("deviations: selectors written more simply than the template's still match, and var() fallbacks are not differences", () => {
  const css = ".x {} #breadcrumb-nav__list { display: flex; gap: 0.4rem; }\n#table-of-contents-heading { text-align: center; }\n#page-container { margin-top: var(--thinqi-navbar-height); }";
  const html = '<div id="page-container"><nav id="breadcrumb-nav"><ol id="breadcrumb-nav__list"></ol></nav><nav id="table-of-contents"><h3 id="table-of-contents-heading"></h3></nav></div>';
  const m = buildMigration({ html, css, js: "" }, { reference });
  assert.deepEqual(m.groups.filter((g) => g.kind === "deviation").map((g) => g.key), [], "all three match the template once ancestors and fallbacks are ignored");
});

test("deviations: they are carried like the custom styles, and can be left out", () => {
  const all = buildMigration(legacy2(), { reference });
  assert.match(all.css, /strong \{\s*font-weight: bold;/);
  assert.match(all.css, /#header-h1 \{\s*margin-block: 1\.5rem 1rem;/);
  const none = buildMigration(legacy2(), { reference, keepGroups: [] });
  assert.doesNotMatch(none.css, /PAGE-SPECIFIC/);
  const some = buildMigration(legacy2(), { reference, keepGroups: ["differs:strong"] });
  assert.match(some.css, /strong \{/);
  assert.doesNotMatch(some.css, /#header-h1 \{\s*margin-block/);
  assert.equal(some.groups.find((g) => g.key === "differs:strong").kept, true);
  assert.equal(some.groups.find((g) => g.key === "differs:h5").kept, false);
});

test("checks: what the migration lost is told apart from what was never styled, and Bootstrap classes are not reported", () => {
  const m = buildMigration(legacy2(), { reference });
  assert.deepEqual(m.lint.unstyledClasses, [], "nothing the old CSS styled has lost its styling");
  assert.deepEqual(m.lint.neverStyled, ["number-text"], "number-text had no rule in the old CSS either (and stretched-link is Bootstrap's)");
  const dropped = buildMigration(legacy2(), { reference, keepGroups: [] });
  assert.ok(dropped.lint.unstyledClasses.includes("resource-card") && dropped.lint.unstyledClasses.includes("inline-icon"), "unticked groups lose their styling, and the check says so");
  assert.equal(dropped.lint.unstyledClasses.includes("number-text"), false);
});

test("js: the selectors of the page's own blocks are standard, not the author's", () => {
  assert.deepEqual(buildMigration(legacy2(), { reference }).customJs, [], "the icon toggle's own JS looks for .data-icon-card and .content-display.active");
  assert.deepEqual(buildMigration({ ...legacy2(), js: legacy2().js + '\ndocument.querySelector(".mine")' }, { reference }).customJs, [".mine"]);
});

test("deviations: the old navbar-offset for anchors is replaced by the template's, not carried", () => {
  const section = buildMigration(legacy(), { reference }).groups.find((g) => g.key === "differs:section");
  assert.ok(section, "the page's own section padding is still a deviation");
  assert.equal(section.against.some((l) => /scroll-margin-top/.test(l)), false);
  assert.doesNotMatch(buildMigration(legacy(), { reference }).css.slice(buildMigration(legacy(), { reference }).css.indexOf("PAGE-SPECIFIC")), /scroll-margin-top: calc\(var\(--thinqi-navbar-height\)/);
});
