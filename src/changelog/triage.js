// How much of the migration wizard a legacy page deserves. Pure: no DOM, no file access.
//
//   easy     the page is already close to the template, with no components of its own to remove. One screen: the template's
//            answer for every difference, and a button to see the result. The wizard is still there on request.
//   guided   the ordinary migration wizard, one rule per slide.
//   rebuild  the tool can't produce a page it would stand behind. It says so and why, and offers no way past: the author
//            rebuilds the page in the builder. (Reasons are things the author can see and fix, so "fix it, then paste again"
//            is also an answer for the first two.)
//
// What makes a page `rebuild` is only ever a fact that makes the OUTPUT wrong, never how much work the review is. Review
// effort is what `easy` is for. Broken or stray tags (an unclosed quote included), older block markup and unstyled classes are deliberately NOT
// stops: the migration keeps the author's HTML as written and reports them, and the real legacy pages in test/fixtures have them.
// Thresholds are tuned against those fixtures (17-20 rules each), none of which is easy: see test/triage.test.js.

// At most this many rules to review for a page to be `easy`. A guess at "a few minutes of wizard", not a measurement.
export const EASY_MAX_RULES = 5;

const hasContainer = (html) => /<div\b[^>]*\bid="page-container"/.test(html);
// The template's own page structure (breadcrumb, contents list, content column...). A plain page of text and links has no BLOCKS
// but does have this, and the base CSS styles it all: that page migrates fine.
const hasSkeleton = (html) => /\b(?:id|class)="[^"]*\b(?:breadcrumb-nav|table-of-contents|content-column|main-grid|header-h1|content-body)\b/.test(html);

// migration: buildMigration()'s result. rules: how many rules buildReview() asks about. html: the page's HTML.
// Returns { tier, reasons[], rules }. `reasons` explain a `rebuild`, or what kept a page from being `easy`.
export function triageMigration(migration, rules, html) {
  const stops = [];
  if (!hasContainer(html)) {
    stops.push("There is no #page-container in the HTML, so there is nothing to put the template's page on.");
  }
  if (!migration.blocks.length && !hasSkeleton(html)) {
    stops.push("None of the builder's blocks, and none of the template's page structure (breadcrumb, contents list, content column), were found, so there is nothing to map onto the template.");
  }
  const dead = migration.lint.missingFunctions;
  if (dead.length) {
    stops.push(`The HTML calls ${dead.join(", ")} from onclick or similar, but the template's JS doesn't define ${dead.length === 1 ? "it" : "them"}, so those buttons would do nothing.`);
  }
  if (stops.length) return { tier: "rebuild", reasons: stops, rules };

  // Not a stop, but each of these needs a person's eye, so the page isn't `easy`.
  const needsEyes = [];
  if (!migration.ready) needsEyes.push("The page's theme couldn't be told from its CSS.");
  if (rules > EASY_MAX_RULES) needsEyes.push(`${rules} rules differ from the template (more than ${EASY_MAX_RULES}).`);
  if (migration.groups.some((g) => g.kind === "custom" && !g.kept)) needsEyes.push("The page has components of its own, which are removed and need rebuilding.");
  if (migration.lint.tagProblems.length) needsEyes.push("The HTML has tag problems.");
  if (migration.lint.unstyledClasses.length) needsEyes.push("Some classes lost their styling.");
  if (migration.lint.undefinedVars.length) needsEyes.push("The CSS uses variables that aren't defined.");
  if (migration.customJs.length) needsEyes.push("The page's own JS looks for things the template's JS doesn't.");
  if (migration.notes.length) needsEyes.push("There are notes about the page to read.");
  return { tier: needsEyes.length ? "guided" : "easy", reasons: needsEyes, rules };
}
