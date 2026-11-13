// The migration tool is built ON the template: it compares a legacy page with the template's rules, tokens and blocks. So any change
// to the template can change what the migration does (which of an author's rules still differ, which tokens are known, which blocks
// are recognised). This snapshot pins the migration's output for the three real legacy pages at the CURRENT template, and the test
// fails when the template moves on without anyone looking at it.
//
// When it fails: validate the migration (docs/RELEASING.md, "Migration check"), fix src/changelog/migrate.js or review.js if it is
// now wrong, then `npm run snapshot:migration` and read the diff of test/snapshots/migration.json. Do not just accept it.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { BUILDER_VERSION } from "../src/changelog/index.js";
import { buildMigration } from "../src/changelog/migrate.js";
import { buildReview } from "../src/changelog/review.js";
import { loadBaseline } from "../src/lib/baseline.js";

const SNAPSHOT = new URL("./snapshots/migration.json", import.meta.url);
const FIXTURES = ["legacy", "legacy2", "legacy3"];
const page = (dir) => Object.fromEntries(["html", "css", "js"].map((k) => [k, readFileSync(new URL(`./fixtures/${dir}/page.${k}`, import.meta.url), "utf8")]));
const sha = (text) => createHash("sha1").update(text).digest("hex").slice(0, 12);
const reference = await loadBaseline("3.1.1");

function capture(dir) {
  const p = page(dir), m = buildMigration(p, { reference }), steps = buildReview(m, p.html);
  return {
    fit: { legacy: m.fit.legacy, signals: m.fit.signals.length },
    theme: m.theme, themeDetected: m.themeDetected, blocks: m.blocks,
    groups: m.groups.map((g) => `${g.kind}: ${g.key}`),
    review: steps.flatMap((s) => s.rows.map((r) => `${s.title} > ${r.label} (${r.lines.length})`)),
    dropped: { base: m.dropped.base.length, standard: m.dropped.standard.length, unused: m.dropped.unused.length },
    htmlChanges: m.htmlChanges.map((c) => c.summary),
    notes: m.notes,
    lint: { unstyledClasses: m.lint.unstyledClasses, undefinedVars: m.lint.undefinedVars, missingFunctions: m.lint.missingFunctions || [], tagProblems: m.lint.tagProblems.length },
    output: { html: sha(m.html), css: sha(m.css), js: sha(m.js) },
  };
}

const actual = { version: BUILDER_VERSION, fixtures: Object.fromEntries(FIXTURES.map((d) => [d, capture(d)])) };
if (process.env.UPDATE_MIGRATION) {
  writeFileSync(SNAPSHOT, JSON.stringify(actual, null, 2) + "\n");
  console.log("migration snapshot updated");
}
const expected = JSON.parse(readFileSync(SNAPSHOT, "utf8"));

test("migration: it has been validated against the current template version", () => {
  assert.equal(expected.version, BUILDER_VERSION,
    `The template is at ${BUILDER_VERSION} but the migration was last validated at ${expected.version}. Validate the migration (docs/RELEASING.md, "Migration check"), then run npm run snapshot:migration and read the diff.`);
});

for (const dir of FIXTURES) {
  test(`migration: the output for the ${dir} page is unchanged`, () => {
    assert.deepEqual(actual.fixtures[dir], expected.fixtures[dir],
      `The migration's output for test/fixtures/${dir} changed. If you changed the template, check that the migration still does the right thing (docs/RELEASING.md, "Migration check"), then run npm run snapshot:migration and read the diff of test/snapshots/migration.json.`);
  });
}
