# YTD tools

Everything needed to build pages in the Gwella template style, and to bring older pages up to the latest version.

- **Builder** (`index.html`, *Build blocks*): a workbench with a block list on the left, the form in the middle, and a live preview and the code to paste on the right, all in view without scrolling the page. Click anything in the preview to jump to the field behind it, collapse list items to one line, and pop the preview out into its own window for a second screen. Your work autosaves in the browser and can be saved to / loaded from a file.
- **Upgrade a page** (developer mode only, see below): paste an old page's code and get the upgraded HTML, CSS and JS back, ready to paste over the old ones. It finds which blocks the page uses, lets you keep your own CSS tweaks, and shows anything it can't do for you. Pages built before 3.1.0 can't be upgraded piece by piece, so they are *migrated*: your HTML decides which of your old styles are kept, a guided review has you decide each place where the page differs from the template (the template is the default; keeping yours needs a reason), and a before/after view shows the result.
- **Validate code** (developer mode only): paste HTML, CSS and JS and get a report of what is wrong, with line numbers, beside the code. It finds tags that are never closed or left without an end tag, ids used twice, links and controls that point at nothing, CSS braces that don't balance, and CSS that is never used by the HTML. It only reports; see `docs/VALIDATOR.md`.
- **Tours and "what's new"**: the round **?** button in the header runs a short guided tour of whichever view is showing (the builder, or What's changed). On a first visit a toast offers the builder tour. The builder remembers the last version each browser opened, and shows a "What's new since your last visit" box when the changelog has releases newer than that.
- **Developer mode**: the Upgrade and Validate views are hidden by default. To show them, open the builder with `?dev` on the end of the address once (for example `https://<user>.github.io/<repo>/?dev`). The browser remembers it. To hide them again use *Project → Developer mode is on · turn off*, or open the page with `?dev=off`. (`#upgrade` and `#validate` links only work while it is on.)
- **Template** (`template/`): the reference page showing every block, using the current base code.
- **Changelog** (`changelog/changelog.json`): the version history, as data. The newest release *is* the current version.

Static site, hosted on GitHub Pages. The builder has no build step: the browser loads `src/` directly as ES modules.

## Run it

```bash
npm install     # only needed for the tests
npm run serve   # then open http://localhost:3000
```

**Windows:** the repo ships a `.gitattributes` that forces LF line endings, because the snapshot, baseline and template tests compare text byte-for-byte. If you cloned before it existed, or see CRLF-related failures (about 26 snapshot tests) with `core.autocrlf=true`, run `git config core.autocrlf false`, then `git rm --cached -r . && git reset --hard` to re-check-out the files. (Not verified on a Windows machine from this environment.)

The builder must be served over http(s) (browsers block ES modules and `fetch` on `file://`). GitHub Pages does this for you.

## Repo map

| Path | What it is |
|------|------------|
| `src/base/` | The base HTML, CSS and JS every page starts with (`base.html`, `base.css`, `base.js`). |
| `src/blocks/<id>/` | One folder per block: `index.js` (fields + HTML generator), `block.css`, optional `block.js`, `how-it-works.html`. |
| `src/blocks/index.js` | Block registry. Order = tab order = order in the template CSS/JS. |
| `src/lib/` | Shared helpers (HTML escaping, links, rich text cleaning, media markup, file loading). No DOM except `dom.js`. |
| `src/changelog/` | Changelog loader, validator, upgrade checker and guided-fix logic. No DOM. |
| `src/ui/` | The builder's interface: tabs, forms, live preview and code panel, autosave, the upgrade view. |
| `styles/` | The builder's own CSS, one file per area. |
| `changelog/` | `changelog.json` (the history) and `SCHEMA.md` (its rules). |
| `baseline/<version>/` | Frozen copy of the base and block code as released. |
| `template/` | Reference page. `template.css` / `template.js` are **generated**; `index.html` is hand-written. |
| `scripts/` | `build.js`, `release.js`, `new-block.js`. |
| `test/` | Golden snapshots of every block's output, template/baseline/changelog checks (`npm test`), and browser tests of the UI (`npm run test:e2e`). |
| `docs/` | How the pieces fit together, and the recipes below. |

## Everyday commands

| Command | Does |
|---------|------|
| `npm test` | Runs all checks. Run before and after any change. |
| `npm run test:e2e` | Browser tests of the builder UI (needs Playwright installed; not run in CI). |
| `npm run build` | Regenerates `template/template.css` and `template.js` from `src/`. |
| `npm run new-block -- my-block "My block"` | Scaffolds a block. See [docs/ADDING-A-BLOCK.md](docs/ADDING-A-BLOCK.md). |
| `npm run snapshot:update` | Accepts an intended change to a block's output. Review the git diff. |
| `npm run release` | Freezes the current version into `baseline/`. See [docs/RELEASING.md](docs/RELEASING.md). |

## Docs

- [Architecture](docs/ARCHITECTURE.md): how a block becomes a tab, a template section and an upgrade rule.
- [Adding a block](docs/ADDING-A-BLOCK.md)
- [Releasing a change](docs/RELEASING.md): changelog entry, version bump, baseline; how upgrades are detected.

## Publishing

1. Repository settings → Pages → "Deploy from a branch" → `main`, `/ (root)`.
2. The builder is at `https://<user>.github.io/<repo>/` and the template at `.../template/`.

The base HTML, CSS and JS the builder produces are pasted into thinqi pages by hand. `template/` must stay in step with `src/`; `npm test` checks that.
