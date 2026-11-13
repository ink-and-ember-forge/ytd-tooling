# Architecture

## One source, many outputs

Each piece of template code lives in exactly one place. Everything else is derived from it.

```
src/base/*            ──┐
src/blocks/<id>/*     ──┼─►  builder tabs (live preview, copy buttons, downloads)
changelog/changelog.json ┘
                          ├─►  template/template.css + template.js   (npm run build)
                          ├─►  baseline/<version>/                   (npm run release)
                          └─►  upgrade checker + guided fixes        (reads the changelog)
```

Nothing is hand-copied between these. If two outputs disagree, a test fails (`npm test`).

## A block

`src/blocks/<id>/index.js` default-exports:

| Field | Purpose |
|-------|---------|
| `id`, `label`, `description` | Tab name and intro text. |
| `fields` | Form definition. Types are handled in `src/ui/fields.js` (`buildField` / `collectValue`). |
| `generateHTML(values)` | Pure function: form values in, HTML string out. No DOM. |
| `warnings(values)` | Optional. Messages shown when output is empty/incomplete. |
| `secondaryHTML` | Optional second output (the Section block's table-of-contents entry). |
| `htmlOutputLabel` | Optional heading for the output box. |
| `detect` | `{ classes?: [...], ids?: [...], patterns?: [...] }`: how the upgrade tool recognises the block on a page (matched against the page's HTML; `patterns` are regexes, e.g. the `onclick` handler an older version of the block used). A block whose JS functions the page already defines also counts as used. Required for any block with CSS or JS; a test checks it against the block's own output. |
| `css` | From `block.css`. Nested inside `#page-container`. |
| `js` | Optional, from `block.js`. Pasted into the Base JS script. |
| `guide` | From `how-it-works.html`. Plain-English explanation under the tab. |

Because `generateHTML` is pure, it runs identically in the browser and in Node, which is what the golden tests rely on.

## The builder UI (`src/ui/`)

The Build view is a **workbench** that fills the window under a one-row header: a block rail on the left, then the selected block's panel (form | divider | preview and code). Each pane scrolls on its own, so the preview and the code never scroll out of view while you work on a long form. Below 1000px it stacks, the rail becomes a row, and the page scrolls. (Layout: `styles/tabs.css`.)

| File | Job |
|------|-----|
| `block-panel.js` | One block's panel: form on the left; preview and code on the right. Updates as you type; autosaves; Reset with Undo. |
| `fields.js` | Builds each field type and reads its value back (`buildField` / `collectValue`). |
| `form-state.js` | Reads and restores a whole form **generically from the DOM**, so autosave, reset and undo work for any field type, including future ones. |
| `list-actions.js` | Every list item: collapses to a one-line summary (one open at a time), moves up/down, duplicates, and removes with Undo. Generic: a new list block gets all of it for free. |
| `pick.js` | **Click-to-edit.** Clicking something in the preview finds the form field that produced it (by comparing what was clicked with what is in the form, so no block needs special markup) and opens, scrolls to and focuses it. |
| `validation.js` | Live hints: bad web addresses, empty list items. Never blocks output. |
| `preview.js` / `output-panel.js` | The device-width preview (Desktop / Tablet / Phone) with hover/click-to-edit, and the HTML/CSS/JS tabs. The header keeps **Copy HTML** in view, and the code card collapses to give the preview the room. **The preview is never scaled: text is always its true size.** Desktop shows the real ~600px page column (see `lib/preview-doc.js`); if the pane is narrower than the page being shown, the preview scrolls sideways (and says so) instead of shrinking. Do not reintroduce `transform: scale()` or `zoom` here; the browser tests check for it. |
| `popout.js` + `preview.html` | **Pop out preview**: the preview in its own window (second screen, or resize it to test real responsive behaviour). The builder sends the active block's preview over a `BroadcastChannel`; the window follows live edits and block switches. |
| `splitter.js` | The draggable divider between form and preview (mouse, touch, arrow keys; double-click resets). Width is shared by all blocks and remembered. |
| `storage.js` | Autosave to `localStorage`, plus project save/load as a JSON file. All wrapped in try/catch. |
| `tabs.js` | Accessible tabs (roles, arrow keys) used for the block rail, code tabs and the Build / Upgrade / What's changed views. |
| `upgrade-panel.js`, `changelog-panel.js` | The Upgrade and What's changed views. Upgrade is one page whose sections unlock after "Check my page": what was found (version, blocks), the author's own CSS tweaks (opt-in), what is changing, and the upgraded HTML / CSS / JS to copy with an automatic self-check. It only displays what `src/changelog/upgrade.js` returns. A page built before 3.1.0 is routed to `migrate-view.js` instead (see below). `upgrade-parts.js` holds what both flows share: the copy cards, the problems list and the before/after frame. |
| `guide-dialog.js` | The "How it works" lightbox: one shared native `<dialog>` that shows a block's `how-it-works.html` (focus trap, Esc, click-outside and ✕ to close, focus returns to the button). Opened from the "ⓘ How it works" button in each panel header. For blocks with an Explain tab it ends with "Explore it on my block →". |
| `explain-panel.js` | The **Explain** tab: the block's own generated code, annotated. Hovering a line lights it up in the preview and explains it; hovering an attribute explains it and highlights every identical value; clicking pins. Numbered badges match the X-ray chips. |
| `preview.js` (X-ray) | The **X-ray** toggle: numbered chips and outlines over every explained part of the preview. It switches on with the Explain tab and off when you leave it. |
| `toast.js` | Non-blocking messages and Undo; replaces `alert()`. |

Blocks choose where they appear in the tab bar with `group` and `tabLabel` (display only: the registry order still decides CSS order).

### How the Explain tab links code to preview

Nothing is added to the generated HTML. Instead:

1. `lib/code-map.js` splits the HTML string into tokens without changing a character and numbers every element in document order. That number N is also the Nth element inside the preview's `#page-container`, so a line of code and the thing it draws can find each other. It is pure (no DOM) and is tested against every block's fixtures to prove the mapping is 1:1.
2. `explain/engine.js` parses the same HTML and gives each element the first part from the block's `explain.json` whose selector matches (`partOf[N]`). Attribute notes come from the block's own list, then the shared `explain/glossary.json`.
3. `explain-panel.js` renders the tokens as annotated code and `preview.js` draws the X-ray chips, both from that one model, and they pass hover/click events to each other by element number.

Only blocks with an `explain.json` have the tab (currently Accordion and Text around media). See [ADDING-A-BLOCK.md](ADDING-A-BLOCK.md#writing-an-explainjson).

## Version and changelog

`changelog/changelog.json` lists releases newest first. The first one is the current version; `{{VERSION}}` in the base files and `data-base-version` on pages come from it. Each change has `detect` / `outdated` patterns that the upgrade checker runs against a pasted page. Rules: `changelog/SCHEMA.md`.

## Upgrading an old page

1. Paste the page's HTML, CSS and JS into **Upgrade a page** and press *Check my page*.
2. The version is read from `data-base-version` (if it is missing, or the CSS looks like a different version, the closest stored versions are offered). Blocks are detected from the HTML; the author can correct the list.
3. The author's own CSS tweaks are listed. **Nothing is kept unless ticked**; ticked tweaks go in a labelled `PAGE-SPECIFIC OVERRIDES` block at the end of the new CSS and are carried forward next time. Differences in the page's JS are shown, not merged.
4. The upgraded HTML (only the version marker changes), CSS and JS are copied back over the old ones. The tool re-checks its own output and lists anything that still needs doing by hand.

### Migrating a page built before 3.1.0 (`src/changelog/migrate.js`, UI in `src/ui/migrate-view.js`)

A flat stylesheet with `--burgundy` tokens can't be diffed against a stored baseline (comparing the real example with 3.1.1 gave 114 meaningless differences), so the page's **HTML** decides what matters. `assessFit` routes a page here when its CSS is flat or uses pre-3.1.0 tokens; the author can still choose the normal upgrade.

- Every selector in the old CSS is judged on its own (comma lists are split) against the classes and ids the HTML uses (a `#x` and a `.x` are different things): **custom** (classes the page uses that the template doesn't style: carried), **unused** (not in the HTML: dropped, listed so nothing vanishes silently), and for selectors the template DOES style, a **declaration-level comparison** with what the template says. Sorting those by *name alone* was the first version's mistake: a rule for `strong` or `.content-column h4` looked "covered by the template" when the template has no such rule, so the page's own overrides (bold weights, header margin, its mobile layout) were silently dropped. Now a declaration that differs from the current template **and** from an older stored version (`reference`, 3.1.1: an old template value is not the author's choice) is a **deviation**: carried, and shown with what the template says instead. Selectors written more simply than the template's (`#table-of-contents-heading` for `#table-of-contents #table-of-contents-heading`) still match, `var()` fallbacks and known grey tokens are ignored when comparing, and the old navbar-offset for anchors is treated as replaced by `--anchor-section-offset`.
- Custom rules are translated (old tokens become `--primary-colour` / `--secondary-colour`; the theme's own brand colour written as a literal becomes the token), merged by *original specificity then source order* (so a stronger selector still beats a weaker later one), nested under `#page-container`, and written **in their original order** into the same `PAGE-SPECIFIC OVERRIDES` region upgrades use. Order matters: a media rule hoisted above a later plain rule for the same selector would silently lose to it. After migrating, the page is an ordinary template page.
- HTML: only safe, itemised fixes: the version marker, the theme class (detected from the old brand colour, or chosen by the author) and the back-to-top `<img>` becoming the standard Font Awesome icon. Broken tags are reported with line numbers, never auto-fixed.
- **Rules that make no visible difference are decided for the author (`scan.js`)**: before the review starts, every rule is measured at once with two hidden pairs of frames (the template and the page as written, at desktop and at phone width; `summariseScan` is pure and unit-tested). A rule whose measured styles are identical either way, or that matches nothing on this page, is *quiet*: keeping it would only make the page differ from the others, so it uses the template without a question. Rules can hide each other (a weight on a parent hides the same weight on its child when both are on), so each quiet rule is measured again with every OTHER rule kept, and only the ones still quiet are decided for the author. The review opens on one slide listing them ("Nothing to decide here ... They already use the template"), with a switch to be asked about them one by one; the per-rule slides then cover only what changes something. Rules that only apply on hover or focus can't be measured and are always asked about, and if the scan fails or times out every rule is asked about, as before. The scan also gives the report a measurement for every rule.
- **The migration is a wizard (`migrate-view.js`)**: one thing at a time, each on its own slide with Back / Next along a sticky bottom bar and the steps (What we found, Your components, Review n/N, Theme and HTML, Check, Copy, Report) clickable along the top. The slides are the same section elements the ordinary upgrade uses; `layout()` shows only the current one, and the paste step is hidden while the wizard is open ("Edit the pasted code" brings it back). The review is **one rule per slide**: a large preview on the left, the rule's hint, what it sets and the decision on the right, so a slide fits the screen with no scrolling. Preview preferences (stacked or flip) are shared by every slide. Shortcuts only ever choose the template, and only for the rules after the current one.
- **The review (`review.js`, UI in `migrate-view.js`)**: the goal is to conform to the template, so where the page differs from it the author makes a *guided, one-at-a-time decision* instead of ticking a long list. The deviations are grouped by purpose into a handful of GROUPS (your phone layout, text and headings, fixes that use `!important`, the page header, one per component), biggest first, so the author sees them in a sensible order. **The choice is made per RULE**, inside each group: a group is a list of rows, one per rule of the author's (or per set of rules that depend on each other, see below). A row shows the rule, what the template says instead, how many elements of this page it touches (counted from the real HTML) and a one-sentence hint (`rowHint`: what is true of the rule, such as that it is written with `!important`, only changes phones, or that the template doesn't set it. A hint informs and never picks; a test forbids advice words). Each rule's **preview** (`src/ui/closeup.js`): the template's version above and yours below, or one at a time with a flip switch, each frame as tall as the slide has room for (`roomFor`/`frameHeight`) with ONE element the rule touches centred in it (the frame scrolls itself), the other elements outlined dashed. **The frame opens whatever hides the element** (a collapsed accordion panel and its button, an icon card's panel, a closed `<details>`, or any `display: none` ancestor) and puts it back when it moves on, and the slide says so; the icon card's panel is opened by hand because the page's own `openAccordion` calls `scrollIntoView`, which would scroll the builder. Each frame is a sandboxed copy of the page with a probe script (`probeMarkup` in `upgrade-parts.js`) that measures the computed style of every element the rule touches and reports it with `postMessage`; `compareReports()` (pure, unit-tested) then says how many elements really look different, steps Previous/Next through only those, writes a one-sentence 'looking at the <element>: text weight, the template gives 400, yours gives 700' caption, and says plainly when a rule changes nothing visible (or matches nothing, or only applies on hover or focus, which a static page cannot show). Each preview compares ONE rule with the template, so it does not depend on the other choices. A 'See the whole page for this group' fold keeps the old whole-page pair. Shortcuts: use the template for all, keep all, and one reason for every kept rule. **The template is pre-selected**; keeping a rule needs a reason (a short list plus a note) and Next stays disabled until each kept rule has one. Decisions are keyed by row id. The reasons are written into the CSS as a ledger, one line per kept rule under its group (`/* kept: Text and headings › strong: A deliberate design choice, bold is our house style */`), which travels with the overrides block through every later upgrade. The copy buttons stay locked until every decision has been made. **Decisions are independent by construction.** Rules that set the same property on the same element in the same media query depend on each other (the page's `ol { list-style-type: decimal !important }` numbers the breadcrumb list too, and a separate `!important` rule on the breadcrumb undoes it), so deciding them apart could leave a state nobody chose. They are detected from the page's real HTML and decided together as ONE ROW (so they cannot be split): inside the same group when they would land in the same one anyway (a button's colour and its hover colour), otherwise in a group of their own, "Rules that work together: …", which names the rules and what they share. `crossDecisionLinks()` checks the guarantee and a test asserts it on every fixture.
- **The report (`report.js`)**: once every decision is made, a report says what was decided about each difference and why: totals, each kept decision with its reason, note, the number of elements it affects and exactly what it overrides against the template's value, what the page now takes from the template, the components carried over, the HTML changes, and a "still worth a look" list (a decision kept as "not sure", or "fixes a problem" with no note saying which; components that were not carried; the checks' findings). It can be downloaded as Markdown or copied. The reasons in it are the same ones written into the CSS, so they outlive the report. **It also says what you will actually SEE.** Each preview measures the real rendered styles in both versions (`measuredSummary` in `closeup.js`) and the wizard keeps the result per rule; the report uses it to put the rules that change how the page looks first ("Changes you will see"), list the ones that make no visible difference, and say which could not be checked (not previewed, hover-only, another screen size). It quotes the measured values ("the template gives `900`, yours gives `700`"), because the static "template: not set" only means the template has no rule for that exact selector; it may style the same elements through a differently written one. A kept rule with no note is listed under "Still worth a look".
- Checks on the result (`lintPage`): **functions the HTML calls from `onclick` and similar that the JS does not define** (a page that looks right but whose buttons are dead), classes that lost their styling (a class that had none in the old CSS either is reported as that, and Bootstrap's are ignored), undefined CSS variables, unclosed or stray tags and attributes with an unclosed quote. The UI also shows the page before and after in sandboxed frames.
- Blocks are recognised not only by their current classes: a page with an OLDER version of a block (the third fixture's icon toggle has `<div id="data-icons-grid">` and `onclick="openAccordion(...)"` tiles but none of the current classes) is recognised from those handlers or from the JS it already defines. Missing this once left the standard JS without `openAccordion`, so every tile threw; the migration now also tells the author when it is applying the current version of a block to older markup.
- Test fixtures: `test/fixtures/legacy/` (a flat-CSS page), `legacy2/` (nested CSS, `--burgundy`, the template's own blocks plus many overrides) and `legacy3/` (an older icon toggle, an unclosed attribute quote). Real pages with the text shortened. A migration is judged two ways, both in the browser tests: by rendering the original and the migrated page and comparing computed styles (everything the author wrote should look identical; the only differences should be the template's own deliberate changes: black sub-headings, bordered contents items, the wider contents column), and by **using** the page (clicking the icon tiles, in the original and the migrated page) because a page can look right and not work.

### The upgrade engine (`src/changelog/`; the UI is `src/ui/upgrade-panel.js`)

- `upgrade.js`: `detectBlocks(html)` finds which blocks a pasted page uses (from each block's `detect`); `buildUpgrade({ html, css, js })` returns the complete upgraded CSS and JS for exactly those blocks, the HTML with only its version marker changed, notes for anything it could not do, and the checker's report.
- `css-tree.js` + `local-edits.js`: find the changes an author made by hand to a page's CSS. The page's CSS and the pristine CSS of its version (rebuilt from `baseline/`, for the blocks the page has) are both parsed into rule trees and compared by meaning (rule path, property, value), so whitespace, comments and formatting never count. Changed and added properties and the author's own rules are **kept**, in a labelled `PAGE-SPECIFIC OVERRIDES` region at the end of the stylesheet, which is recognised and carried forward on every later upgrade. Removed properties or rules can't be expressed as overrides, so they are reported, not kept. Each edit also says whether the *new* standard changed the same thing (`standardChanged`) or no longer has the rule (`obsolete`). `upgradePage()` loads the baseline for the page's version and calls `buildUpgrade`.
- `sniff.js`: `suggestVersions(css)` ranks the stored versions by how few differences the page's CSS has from each. `upgradePage()` attaches it when the version marker is missing or the CSS looks like a different version from the one claimed. Versions whose base CSS is identical tie (3.2.0 and 3.3.0 can't be told apart without an At a glance block), and the ranking says so by listing them together.
- `js-edits.js`: a line diff of the page's JS against the standard JS for its version (shown to the author, never merged).
- `verify.js` + `lib/baseline.js`: check every changelog rule against the frozen code in `baseline/` (see [RELEASING.md](RELEASING.md)). `baseline/index.json` lists each version's files so the browser fetches only files that exist; `npm run release` rewrites it (`npm run release -- --reindex` rewrites it alone) and a test keeps it in sync.

## Files and loading

Block and base text files are read through `src/lib/assets.js` (`fetch` in the browser, `fs` in Node). That is why modules use top-level `await`, and why the site must be served over http.

## Why no bundler

GitHub Pages serves the repo as-is and the code is small. If the codebase outgrows that, `src/` is already organised as modules; adding Vite later would mainly replace `loadText` with `?raw` imports.
