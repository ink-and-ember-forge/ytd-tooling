# Builder changelog schema (draft v0)

This design is version 3. Versions 1 and 2 are earlier page builds.

The changelog is data. Release notes, the upgrade report and the
"which pages are affected" list are all generated from `changelog.json`.

## Release

| Field      | Type   | Notes |
|------------|--------|-------|
| `version`  | string | Semver, e.g. `3.0.0`. The major number moves only for a page rebuild (see Versioning). Matches the base version marker. |
| `date`     | string | ISO date of release. |
| `summary`  | string | One sentence for the release notes header. |
| `changes`  | array  | One or more change entries (below). |
| `deprecations` | array | Optional. Names kept working for one version, then removed. |

## Change

| Field      | Type   | Notes |
|------------|--------|-------|
| `id`       | string | Unique, e.g. `CHG-3.0.0-01`. Never reused. |
| `type`     | enum   | See types below. |
| `scope`    | string | `base-css`, `base-js`, `base-html`, `block:<id>`, or `tool`. |
| `blocks`   | array  | Block ids affected. Empty for base or tool-only changes. |
| `summary`  | string | Plain English, written for the team. |
| `detect`   | object | `patterns`: regular expressions that find the feature on a page (whether current or outdated). Empty for changes with no page-level signature. |
| `outdated` | object | `present`: regular expressions that match only the OUTDATED form. `missing`: regular expressions that should appear on a current page; if the feature is on the page and none match, the page is outdated. A page is outdated if any `present` pattern matches, or any `missing` check fails. Required for `copy`, `hand-edit` and `rebuild` changes that have `detect` patterns. |
| `action`   | enum   | What a page needs. See actions below. |
| `page_rebuild` | boolean | `true` only if a page cannot be upgraded piece by piece and must be rebuilt from scratch in the tool. Requires `action: rebuild`. Default `false`. |
| `notes`    | string | Optional. Anything a reviewer must know. |

### Types

- `additive`: new blocks or options. Existing pages unaffected.
- `visual`: existing output looks different. Pages should be updated to match.
- `behaviour`: output changes without changing appearance (e.g. attributes). Updated pages behave correctly.
- `fix`: corrects broken output. Pages built with the bug should be updated.
- `breaking`: a name or contract changed. Pages may fail unless updated. Must have a deprecation entry or a note explaining why not.
- `tool-only`: changes to the builder form only. No page output changes, so no page action.

### Actions (map to the three report buckets)

- `none`: no page change needed. (Reports as "no action".)
- `copy`: replace the base CSS, JS or HTML as a whole. (Reports as "copy directly into the new base code".)
- `hand-edit`: a small change that can be made on the page by hand. Describe it in `notes`.
- `rebuild`: regenerate the block in the builder. (Reports as "rebuild in the tool".)

## Deprecation

| Field         | Notes |
|---------------|-------|
| `name`        | The old name, e.g. `--navy`. |
| `replacement` | The new name, e.g. `--primary-colour`. |
| `removed_in`  | Version in which the old name stops working. At least one minor version after introduction. |

Deprecated names stay in the base CSS, defined as aliases of the new names,
until `removed_in`.

## Reporting

A change is reported for a page only if:
1. the page is on a version older than the change's release, and
2. the page uses the feature (`detect`), and
3. the page is outdated (`outdated`).

Pages that use the feature but are already current are listed as "already current", so the team can see they were checked.

## Versioning

Version 3 is this design. Versions 1 and 2 are earlier page builds. The version is `major.minor.patch`.

### The rule

Look at the `type` of every change in the release. The release number is set by the **highest** of them.

| Number | Use it when | Change types | Examples |
|--------|-------------|--------------|----------|
| **Major** `4.0.0` | A page cannot be upgraded piece by piece and must be rebuilt from scratch. Rare: only when a change sets `page_rebuild: true`. A breaking change on its own is NOT a major. | `rebuild` with `page_rebuild: true` | The page structure changes so no old page can take the new CSS. |
| **Minor** `3.x.0` | Authors can do something new, or a page's design deliberately changes in a way a reader would notice. | `additive`, `visual`, `breaking` | A new block or option (the `tight-heading` class); H3s change colour; the contents column gets wider; a name is renamed (with a deprecation). |
| **Patch** `3.x.y` | Nothing new to use and no deliberate design change: the template is corrected, or tidied internally. Pages are updated by a copy or a small hand edit. | `fix`, `behaviour`, `tool-only` | `cursor: pointer` that was missing; a focus ring that did not show; a hard-coded colour replaced by a token with the same look; a builder-form-only change. |

### Deciding

Ask in order, and stop at the first yes:

1. Must an affected page be rebuilt from scratch? **Major.**
2. Can an author now do something they could not before (a new block, option, class or token they are meant to use), or would a reader notice a deliberate design change? **Minor.**
3. Otherwise (it fixes something broken, or changes the code without changing what a reader sees) **Patch.**

Rules of thumb:

- **A fix is always a patch**, however small or large the code change. A missing pointer cursor, a lost colour and a broken focus ring are all patches.
- **Internal tokens are a patch** when the page looks the same. A token that authors are expected to use in their own CSS is new for them, so it is a minor.
- `visual` means a reader would notice. A shade-for-shade tidy-up (a near-black becoming the same black as the text around it) is `behaviour`, not `visual`.
- Several changes in one release: the highest one wins. One `additive` change among five fixes makes the release a minor.
- Breaking changes do not move the major number by themselves. One that can be handled by copying or editing stays within 3.x (as a minor, with a deprecation entry).
- The number is never chosen by how big the diff is, or how many pages it touches.

`test/changelog.test.js` enforces the table: a release whose changes are only `fix`, `behaviour` or `tool-only` must be a patch, and one with any `additive`, `visual` or `breaking` change must be a minor.
