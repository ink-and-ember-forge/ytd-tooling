// How much of the wizard a legacy page gets: easy / guided / rebuild (src/changelog/triage.js).
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildMigration } from "../src/changelog/migrate.js";
import { buildReview } from "../src/changelog/review.js";
import { triageMigration, EASY_MAX_RULES } from "../src/changelog/triage.js";
import { loadBaseline, baselinePage } from "../src/lib/baseline.js";
import { BLOCKS } from "../src/blocks/index.js";
import { FIXTURES } from "./fixtures.js";

const reference = await loadBaseline("3.1.1");
const fixture = (dir) => (name) => readFileSync(new URL(`./fixtures/${dir}/page.${name}`, import.meta.url), "utf8");
const real = (dir) => { const f = fixture(dir); return { html: f("html"), css: f("css"), js: f("js") }; };

// What migrate-view's start() does: count the rules to review, then triage the migration with its defaults (nothing of the
// page's own kept, its components removed, the template used for every rule).
function triage(page) {
  const first = buildMigration(page, { reference, keepGroups: [] });
  const rules = buildReview(first, page.html).flatMap((s) => s.rows).length;
  return triageMigration(buildMigration(page, { reference, keepGroups: [], retire: true }), rules, page.html);
}

// A page that is the current template with only the pre-3.1.0 colour tokens: legacy by token, but nothing to decide.
async function nearTemplate() {
  const b = await loadBaseline("3.3.0");
  const current = baselinePage(b, { blockIds: ["accordion"] });
  const accordion = BLOCKS.accordion.generateHTML(Object.values(FIXTURES.accordion)[0]);
  // The block's markup goes inside #page-container, the way a built page has it.
  const html = current.html.replace(/ data-base-version="[^"]*"/, "").replace(/(<div\b[^>]*\bid="page-container"[^>]*>)/, `$1\n${accordion}`);
  // A legacy stylesheet has one theme (the 3.3.0 template defines both), in the old token.
  const css = current.css.replace(/--primary-colour/g, "--burgundy").replace(/#325083/gi, "#a3195b");
  return { html, css, js: current.js };
}

test("triage: the three real legacy pages all get the wizard, not a shortcut and not a stop", () => {
  for (const dir of ["legacy", "legacy2", "legacy3"]) {
    const t = triage(real(dir));
    assert.equal(t.tier, "guided", `${dir}: ${t.reasons.join(" | ")}`);
    assert.ok(t.rules > EASY_MAX_RULES, `${dir} has ${t.rules} rules`);
  }
});

test("triage: tag problems (an unclosed quote among them) and older block markup are reported, never a stop: the real pages have them", () => {
  assert.ok(buildMigration(real("legacy"), { reference }).lint.tagProblems.length > 0);
  assert.ok(buildMigration(real("legacy3"), { reference }).lint.tagProblems.some((p) => /unclosed quote/.test(p)));
  assert.ok(buildMigration(real("legacy3"), { reference }).notes.some((n) => /older version/.test(n)));
  assert.notEqual(triage(real("legacy")).tier, "rebuild");
  assert.notEqual(triage(real("legacy3")).tier, "rebuild");
});

test("triage: a page already close to the template is easy", async () => {
  const t = triage(await nearTemplate());
  assert.equal(t.tier, "easy", t.reasons.join(" | "));
  assert.ok(t.rules <= EASY_MAX_RULES);
});

test("triage: easy needs a theme, and a page with a problem on it is guided instead", async () => {
  const page = await nearTemplate();
  const noTheme = triage({ ...page, css: page.css.replace(/--burgundy/g, "--accent").replace(/#a3195b/gi, "#123456") });
  assert.equal(noTheme.tier, "guided");
  assert.ok(noTheme.reasons.some((r) => /theme/.test(r)));
  const broken = triage({ ...page, html: page.html + "\n<div>never closed" });
  assert.equal(broken.tier, "guided");
  assert.ok(broken.reasons.some((r) => /tag problems/.test(r)));
});

test("triage: no #page-container is a stop", async () => {
  const page = await nearTemplate();
  const t = triage({ ...page, html: page.html.replace(/id="page-container"/, 'id="wrapper"') });
  assert.equal(t.tier, "rebuild");
  assert.ok(t.reasons.some((r) => /#page-container/.test(r)));
});

test("triage: a page with none of the builder's blocks is a stop", () => {
  const t = triage({ html: '<div id="page-container"><p>Hello</p></div>', css: "p { color: var(--burgundy); }\n.a{margin:0}\n.b{margin:0}\n.c{margin:0}\n.d{margin:0}\n.e{margin:0}", js: "" });
  assert.equal(t.tier, "rebuild");
  assert.ok(t.reasons.some((r) => /none of the template's page structure/.test(r)));
});

test("triage: a plain page of text and links has no blocks but has the template's page structure, so it is not refused", () => {
  const html = '<div id="page-container"><nav id="breadcrumb-nav"><ol id="breadcrumb-nav__list"><li>Home</li></ol></nav><main class="main-grid"><nav id="table-of-contents"><ul><li><a href="#a" class="toc-link">A</a></li></ul></nav><div class="content-column"><h1 id="header-h1">T</h1><div class="content-body"><section id="a"><h2>A</h2><p>Words and <a href="#">links</a>.</p></section></div></div></main></div>';
  const t = triage({ html, css: ":root { --burgundy: #a3195b; }\np { margin: 0 }", js: "" });
  assert.notEqual(t.tier, "rebuild", t.reasons.join(" | "));
});

test("triage: a page with components of its own is never easy, because they are removed and need rebuilding", async () => {
  const page = await nearTemplate();
  const t = triage({ html: page.html.replace("</div>", '<div class="promo-box"><h4>Promo</h4><p>Offer</p></div></div>'), css: page.css + "\n.promo-box { border: 1px solid red; padding: 1rem; }", js: page.js });
  assert.equal(t.tier, "guided");
  assert.ok(t.reasons.some((r) => /components of its own/.test(r)), t.reasons.join(" | "));
});

test("triage: buttons that would do nothing are a stop, and name the function", async () => {
  const page = await nearTemplate();
  const t = triage({ ...page, html: page.html.replace("</div>", '<button onclick="launchRocket()">Go</button></div>') });
  assert.equal(t.tier, "rebuild");
  assert.ok(t.reasons.some((r) => /launchRocket/.test(r)));
});

test("triage: the fixtures the browser tests paste in (legacy-easy, legacy-stop) land in the tiers they are for", () => {
  assert.equal(triage(real("legacy-easy")).tier, "easy");
  const stop = triage(real("legacy-stop"));
  assert.equal(stop.tier, "rebuild");
  assert.deepEqual(stop.reasons.length, 1);
});
