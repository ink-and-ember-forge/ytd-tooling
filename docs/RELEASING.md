# Releasing a change

Any change to base or block HTML/CSS/JS that could reach a published page is a release. The tests enforce this: once `baseline/<version>/` exists, the code must still match it.

## Steps

1. Make the change in `src/` (base file or block).
2. Add a release to the **top** of `changelog/changelog.json`. Pick the version by the rules in the **Versioning** section of `changelog/SCHEMA.md` (a fix, or a change nobody would notice, is a patch; something new to use, or a design change a reader would notice, is a minor; major only for a page rebuild). A test checks the number against the change types. Each change needs:
   - `type` and `action` (`none`, `copy`, `hand-edit` or `rebuild`),
   - `scope` (`base-css`, `base-js`, `base-html`, `block:<id>`, or `tool`),
   - `detect.patterns`: regexes that find the feature on a page,
   - `outdated.present` / `outdated.missing`: regexes that tell an old page from a current one.

   `test/changelog-baselines.test.js` checks every rule against the real frozen code in `baseline/`: the previous release's code must be reported as needing the change, and the code of the release that has it (and later ones) must not be. A rule that fails this does not recognise old code, or wrongly flags current code. Fix the rule; do not skip the test. (Changes with `action: none` or no `detect` patterns cannot be checked this way.)
3. Regenerate and freeze (then do the **Migration check** below):
   ```bash
   npm run build
   npm run snapshot:update   # only if block output changed on purpose; review the diff
   npm run release           # writes baseline/<version>/
   npm test
   ```
4. Commit everything together: sources, changelog, `template/`, `baseline/`, snapshots.

## Migration check (required for every template release)

The migration tool (`src/changelog/migrate.js`, `review.js`, `scan.js`) is built ON the template: it compares an old page's rules with the template's rules, knows the template's design tokens, and recognises the template's blocks in legacy markup. So a template change can quietly change what it does. Every release that touches base or block CSS, JS or HTML therefore includes a migration check, and `npm test` enforces it: `test/migration.test.js` pins the migration's output for the three real legacy pages (`test/fixtures/legacy*`) at the current template, and fails when the template version moves on without it being re-validated.

When it fails (or whenever you release):

1. Run `npm run snapshot:migration`, then read the diff of `test/snapshots/migration.json`. Ask of every line: is this the change the template change should cause? A rule that stops being a difference because the template now matches it is expected. A rule that appears, a block that stops being recognised, or a note that changes is a question to answer, not to accept.
2. **New or renamed design tokens** (`--panel-background`, `--divider-colour`...): add them to `KNOWN_TOKENS` in `migrate.js` (with their value), so a page's `var(--token)` and the literal compare as equal; old names go in `TOKEN_MAP`.
3. **New, renamed or removed selectors, classes or blocks**: check the block's `detect` (classes, ids, patterns) still recognises the OLD markup of that block as well as the new, and that `assessFit` still routes pages the right way.
4. **Changed values the author may have copied** (a size, a colour, a spacing): the migration reports a rule as a difference only while it differs from the template. Check the legacy pages' rows still make sense, and consider whether a kept override in a real migration report should now become part of the template (see 3.5.0, which did that for the icon toggle panel image).
5. **Previews**: if the change affects how a page renders (Bootstrap, Font Awesome, the base layout), open one migration in the browser and look at a rule slide, the quiet-rules slide and the Check slide.
6. Run `npm run test:e2e`. Scenarios 9b to 9e drive a real migration end to end.
7. A new legacy pattern the fixtures don't cover (a block's old markup, a new kind of override) deserves a new fixture under `test/fixtures/`, added to `test/migration.test.js`.

Say in the commit message that the migration was checked, and what you looked at. A snapshot that was only regenerated and never read is not a migration check.

## Tool-only changes

Changes to the builder interface (`src/ui/`, `styles/`) that do not alter generated output need no release. If you want it in the changelog anyway, add a `tool-only` change with action `none` (this does bump the version).

## What "frozen" means

`npm run release` refuses to overwrite an existing `baseline/<version>/`. If `npm test` says the code changed since a version was released, either the change needs a new version (the usual answer), or the version was never actually published and you can `npm run release -- --force`.

## History gap

Baselines start at 3.1.1. Versions 3.0.0 and 3.1.0 are described in the changelog, but their code was not stored. The upgrade checker still handles pages built on them, using the changelog's patterns.
