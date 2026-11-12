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
| `css` | From `block.css`. Nested inside `#page-container`. |
| `js` | Optional, from `block.js`. Pasted into the Base JS script. |
| `guide` | From `how-it-works.html`. Plain-English explanation under the tab. |

Because `generateHTML` is pure, it runs identically in the browser and in Node, which is what the golden tests rely on.

## The builder UI (`src/ui/`)

| File | Job |
|------|-----|
| `block-panel.js` | One block's tab: form on the left, sticky preview and code on the right. Updates as you type; autosaves; Reset with Undo. |
| `fields.js` | Builds each field type and reads its value back (`buildField` / `collectValue`). |
| `form-state.js` | Reads and restores a whole form **generically from the DOM**, so autosave, reset and undo work for any field type, including future ones. |
| `list-actions.js` | Move up/down, Duplicate and Remove-with-Undo on every list item. |
| `validation.js` | Live hints: bad web addresses, empty list items. Never blocks output. |
| `preview.js` / `output-panel.js` | The device-width preview (Desktop / Tablet / Phone), and the HTML/CSS/JS tabs with Copy buttons. The preview stays at true size so text is readable: Desktop shows the real ~600px page column (see `lib/preview-doc.js`) and only shrinks if the panel is narrower than that. |
| `splitter.js` | The draggable divider between form and preview (mouse, touch, arrow keys; double-click resets). Width is shared by all blocks and remembered. |
| `storage.js` | Autosave to `localStorage`, plus project save/load as a JSON file. All wrapped in try/catch. |
| `tabs.js` | Accessible tabs (roles, arrow keys) used for block tabs, code tabs and the Build / Upgrade / What's changed views. |
| `upgrade-panel.js`, `changelog-panel.js` | The Upgrade (three steps + checklist) and What's changed views. |
| `toast.js` | Non-blocking messages and Undo; replaces `alert()`. |

Blocks choose where they appear in the tab bar with `group` and `tabLabel` (display only: the registry order still decides CSS order).

## Version and changelog

`changelog/changelog.json` lists releases newest first. The first one is the current version; `{{VERSION}}` in the base files and `data-base-version` on pages come from it. Each change has `detect` / `outdated` patterns that the upgrade checker runs against a pasted page. Rules: `changelog/SCHEMA.md`.

## Upgrading an old page

1. Paste the page's HTML/CSS/JS into Tools → Upgrade page.
2. The checker reads `data-base-version` (or you pick the version) and walks every later release.
3. Each change the page is affected by is listed under *Rebuild*, *Copy directly*, *Hand edit* or *Check manually*. For "copy" changes a button copies the current replacement code (base CSS/JS/HTML, or the block's CSS).
4. Set `data-base-version` to the new version.

## Files and loading

Block and base text files are read through `src/lib/assets.js` (`fetch` in the browser, `fs` in Node). That is why modules use top-level `await`, and why the site must be served over http.

## Why no bundler

GitHub Pages serves the repo as-is and the code is small. If the codebase outgrows that, `src/` is already organised as modules; adding Vite later would mainly replace `loadText` with `?raw` imports.
