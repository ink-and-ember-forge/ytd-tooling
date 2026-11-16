# Code validator

Status: **first slice built** (see "What exists" below). Cross-file JS checks and the template pack are still to do. Decisions marked *(decided)* were made in discussion; the rest are proposals to react to.

## What exists (first slice)

- `src/validate/`, pure (no DOM, apart from the `DOMParser` used to match selectors for the unused-CSS check): `locate.js` (offsets to line/column, the finding shape), `html-scan.js` (the tolerant scanner), `html-rules.js` (ids and what points at them), `css-scan.js` (a position-tracking CSS scanner that survives broken braces), `css-rules.js` (rules that look across CSS, HTML and JS), `index.js` (`validate({ html, css, js }, { packs })` returns `{ findings, counts }`, most serious first).
- `src/ui/validate-panel.js` + `styles/validate.css`: the **Validate code** tab. Paste the three languages; the report shows the code (tabs, line gutter, marked lines) beside the findings, linked both ways. Choosing a finding scrolls the code (and only the code) to it and highlights the exact text and the other places it names; choosing a marked line chooses its first finding, and again the next. Filter by severity; arrow keys move between tabs; it stacks on a phone.
- `src/changelog/components.js` (migration) now uses the same scanner (`elementsOf` is a thin wrapper), so what counts as "closed" is decided in one place.

| Finding id | Severity | What |
|---|---|---|
| `html/unclosed-tag` | error | Never closed; says where it stops and how much it swallowed, with the ending tag as a related place |
| `html/stray-close-tag` | error | A close tag with no open one; a heading closed at the wrong level says which it meant; a `</p>` after a list says the `<p>` was closed early by it |
| `html/void-close-tag` | error | `</br>` and friends |
| `html/unclosed-quote` | error | An unclosed quote, or a stray quote where an attribute name should be |
| `html/duplicate-attribute` | error | Written twice on one tag (the second is ignored) |
| `html/unclosed-comment` | error | Hides the rest of the page |
| `html/duplicate-id` | error | The second use, pointing at the first |
| `html/missing-target` | error / warning | `data-bs-target` with no such id is an error (the control does nothing); `href="#x"`, `data-bs-parent`, `aria-*` and `label for` are warnings |
| `html/missing-end-tag` | warning | **An omitted optional end tag** (`</li>`, `</p>`, `</td>`...). *(decided)* Valid HTML, but flagged: nothing marks where the element stops. The scanner still knows where it ends, so the containers around it are not blamed |
| `html/attribute-spacing` | warning | No space between attributes (`href="x"target=`) |
| `css/unbalanced-brace` | error | A `}` with nothing to close; points at an indented top-level close that may have closed a rule too early |
| `css/unclosed-brace`, `css/orphan-declaration`, `css/unclosed-comment` | error | |
| `css/unused-selector` | info | A selector that never matches anything in the HTML (shown as the selector it really is, with nested rules resolved); with the size in bytes. A rule that is wholly unused takes its nested rules with it |
| `css/unused-summary` | info | N of M rules, about X bytes and Y% of the CSS, never match anything |
| `css/unused-variable` | info | A custom property nothing uses (no `var()`, nothing in the HTML or JS) |

**Unused CSS** only reports what a static page can prove. It does not report: `:hover`, `:focus`, `::before` and other states and pseudo-elements; rules on the host page's `html`, `body` and `:root`; `:not(.collapsed)`-style rules on a state class Bootstrap toggles; selectors naming a class or id that a script mentions or that Bootstrap adds at runtime (`show`, `collapsing`, `active`...); selectors the engine can't parse. It is `info`, never a warning: it is hygiene, and the template's own CSS has some (unused theme classes).

**False positives are guarded by tests:** the template's own reference page and every block's generated HTML (every fixture variant) must produce no errors and no warnings. The four example pages are pinned fixtures (`test/fixtures/validate/`, `test/snapshots/validate.json`).

**Still to do:** cross-file JS checks (handlers the HTML calls that the JS doesn't define, selectors in JS that match nothing, classes with no CSS, undefined variables); the template pack (block contracts, theme clashes); calling `validate()` from build, rebuild and upgrade; triage reading its results; ignoring a finding.

## Scope (original draft)

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
| Syntax | Unclosed, stray and mismatched tags, **and omitted optional end tags** *(decided: flagged)*. Unclosed quotes. Duplicate attributes. Missing space between attributes. Void-element closers. CSS brace balance and orphan declarations. | `</br>`, `<h3>...</h4>`, repeated `class=`, `href="..."target=`, a stray `}` that closes `#page-container` early and leaks the rest of the CSS site-wide, a stray `</p>` |
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
