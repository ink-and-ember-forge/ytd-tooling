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
| `detect` | `{ classes?: [...], ids?: [...] }`: how the upgrade tool recognises the block on a page (matched against the page's HTML). Required for any block with CSS or JS; a test checks it against the block's own output. |
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

- Every selector in the old CSS is judged on its own (comma lists are split) against the classes and ids the HTML uses: **base** (no class or id: replaced by the new base), **standard** (the new CSS styles it), **custom** (classes the page uses that nobody else styles: carried), **unused** (not in the HTML: dropped, listed so nothing vanishes silently).
- Custom rules are translated (old tokens become `--primary-colour` / `--secondary-colour`; the theme's own brand colour written as a literal becomes the token), merged by *original specificity then source order* (so a stronger selector still beats a weaker later one), nested under `#page-container`, and written **in their original order** into the same `PAGE-SPECIFIC OVERRIDES` region upgrades use. Order matters: a media rule hoisted above a later plain rule for the same selector would silently lose to it. After migrating, the page is an ordinary template page.
- HTML: only safe, itemised fixes: the version marker, the theme class (detected from the old brand colour, or chosen by the author) and the back-to-top `<img>` becoming the standard Font Awesome icon. Broken tags are reported with line numbers, never auto-fixed.
- Checks on the result (`lintPage`): classes with no styling, undefined CSS variables, unclosed or stray tags. The UI also shows the page before and after in sandboxed frames.
- Test fixture: `test/fixtures/legacy/` is a real legacy page (text shortened, structure and faults kept).

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
