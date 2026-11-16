# Code validator: scope (draft)

Status: **scope only, nothing built.** Decisions marked *(decided)* were made in discussion; the rest are proposals to react to.

The validator takes a page's HTML, CSS and JS and reports what is wrong with it, with line numbers, next to the code. It is **not part of the upgrade**: it is used throughout building, rebuilding and upgrading, and on its own.

## What it is

A pure function, `validate({ html, css, js }, { packs }) -> findings[]`. No DOM, no dependency on the upgrader, so it runs in Node tests and in the browser (the builder has no bundler: `src/` is loaded as ES modules).

A finding:

| Field | Meaning |
|---|---|
| `id` | Stable, such as `html/duplicate-id`. Lets later features refer to a rule (ignore it, link to docs, decide on it). |
| `severity` | `error` (the page breaks), `warning` (renders, but fragile or wrong), `info` (hygiene, deprecation). |
| `language`, `line`, `column`, `endLine`, `endColumn` | Where. |
| `message`, `why` | One sentence on what is wrong, and why it matters. |
| `related[]` | Other places involved: a duplicate id points at both sites, an unclosed `<div>` at where it should have closed. |

Errors must be near-certain. Anything a heuristic might get wrong is a warning.

## Scope *(decided)*

- **Core:** generic HTML, CSS and JS checks that work on any page.
- **Template pack:** an optional, switchable layer for Gwella-template rules (block contracts, theme clashes, deprecated tokens). The core stays reusable.
- **JS: cross-references only.** Handlers the HTML calls that the JS doesn't define, selectors that match nothing. No JS parser, so no syntax checking for now.
- **Report only.** No auto-fix; messages can suggest one.

## Checks

| Tier | Checks | Seen in the four example pages |
|---|---|---|
| Syntax | Unclosed, stray and mismatched tags. Unclosed quotes. Duplicate attributes. Missing space between attributes. Void-element closers. CSS brace balance and orphan declarations. | `</br>`, `<h3>...</h4>`, repeated `class=`, `href="..."target=`, a stray `}` that closes `#page-container` early and leaks the rest of the CSS site-wide, a stray `</p>` |
| Structure | Duplicate ids. **Containers that swallow content** (left open until an ancestor closes them; report the span swallowed). Nesting rules (`<p><ul>`). Link targets that don't exist (contents hrefs, `data-bs-target`, `aria-controls`). | Duplicate accordion ids (the second accordion toggles the first's panel), an unclosed accordion item swallowing later sections, an unclosed `content-body` |
| Cross-file | Classes with no CSS. Undefined CSS variables. Handlers the JS doesn't define. JS selectors that match nothing. | `--buttons` undefined, `.burgundy` never styled |
| Template pack | Block contracts (for example an `image-text-section` holds an image and one text `<div>`). Inline colours that clash with the chosen theme. Pre-3.1 tokens. Older block markup. | Items outside an image-text block's text column, 13 inline `#325083` in a Gwella page |

## Design decision: our own tolerant tokenizer

A spec-compliant HTML parser silently repairs broken markup, so it cannot say what was wrong. `elementsOf` in `src/changelog/components.js` already records every element's start, end and whether it closes, tolerating broken tags; the validator should build on it (lifted into a shared module, not imported from the migration code). The existing `parseCss` already survives broken braces. This also fits the no-bundler constraint.

## The view

Side-by-side, read-only:

- **Left:** the code, tabs for HTML / CSS / JS, a line gutter, marked ranges.
- **Right:** the findings list, grouped by severity, filterable.
- **Linked both ways:** selecting a finding scrolls to and highlights its range (and its related locations); selecting a marker in the code selects the finding.
- Stacks vertically on a phone. Fully keyboard-operable.

No squiggles inside an editable text area: that needs an editor component, which is a lot of weight for a read-only report.

## Where it plugs in

- Standalone "Validate" tab.
- **Build:** validate the generated output.
- **Rebuild:** validate what the author pastes over a `<!-- REBUILD: ... -->` placeholder (the migration leaves one wherever it removes a component; searching for `REBUILD` finds every unfinished one).
- **Upgrade:** validate the input ("fix these first") and the output ("confirm it is clean").
- **Triage** (`src/changelog/triage.js`): its refusal reasons that are really validator findings (no `#page-container`, handlers the JS does not define) become validator error ids that triage reads, so there is one source of truth. Do this once the validator's shape is settled.

## Existing code worth reusing

- `tagProblems`, `missingFunctions`, `lintPage` in `src/changelog/migrate.js`: lift into a shared module and return the finding format.
- `elementsOf` in `src/changelog/components.js`: the tolerant tokenizer.
- `parseCss`, `findNode` in `src/changelog/css-tree.js`.

## Testing

- The four example pages (HTML and CSS) become gold-standard fixtures, with their findings pinned by snapshot, like the existing golden tests.
- Each rule also gets its own small unit tests.
- Errors are tested for false positives against the template's own pages (a page generated by the builder must validate clean).

## Proposed first slice

The pure `validate()`, the shared tokenizer and the finding format; the structural and syntax checks the example pages prove; the fixtures; a minimal side-by-side view. Cross-file checks and the template pack follow as separate steps.

## Open questions

- Should severities ever **block** anything (for example, copying generated output), or are they purely advisory?
- Does the template pack validate against the block contracts in `src/blocks/*` directly (one source of truth), or from a separate rules list?
- Should a finding be ignorable ("I know, leave it"), and where would that be remembered?
