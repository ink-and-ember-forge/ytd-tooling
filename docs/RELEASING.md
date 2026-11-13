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
3. Regenerate and freeze:
   ```bash
   npm run build
   npm run snapshot:update   # only if block output changed on purpose; review the diff
   npm run release           # writes baseline/<version>/
   npm test
   ```
4. Commit everything together: sources, changelog, `template/`, `baseline/`, snapshots.

## Tool-only changes

Changes to the builder interface (`src/ui/`, `styles/`) that do not alter generated output need no release. If you want it in the changelog anyway, add a `tool-only` change with action `none` (this does bump the version).

## What "frozen" means

`npm run release` refuses to overwrite an existing `baseline/<version>/`. If `npm test` says the code changed since a version was released, either the change needs a new version (the usual answer), or the version was never actually published and you can `npm run release -- --force`.

## History gap

Baselines start at 3.1.1. Versions 3.0.0 and 3.1.0 are described in the changelog, but their code was not stored. The upgrade checker still handles pages built on them, using the changelog's patterns.
