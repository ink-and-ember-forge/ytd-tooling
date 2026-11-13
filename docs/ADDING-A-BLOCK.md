# Adding a block

1. Scaffold it:
   ```bash
   npm run new-block -- my-block "My block"
   ```
   This creates `src/blocks/my-block/` (`index.js`, `block.css`, `how-it-works.html`) and adds it to `src/blocks/index.js`. Move it in that list if it should sit elsewhere (list order is tab order and CSS order).
2. Set `group` (Structure, Content, Interactive or Links) and a plain-English `tabLabel`: they decide where the block appears in the tab bar. Write `fields` and `generateHTML` in `index.js`. Reuse helpers from `src/lib/` (`escapeHTML`, `slugify`, `uniqueSlug`, `indentLines`, `newTabAttrs`, `mediaInner`...). Always escape user text.
3. Write `block.css`, indented as nested rules (it is placed inside `#page-container`). Use the theme variables (`--primary-colour`, `--secondary-colour`...).
4. If it needs script, add `block.js` and uncomment the `js:` line in `index.js`. It is appended to the base script, so keep functions global and idempotent.
5. Write `how-it-works.html`: plain-English HTML shown in the "ⓘ How it works" lightbox from the panel header. Layer it: a `<div class="guide-tldr">` "In 30 seconds" summary first, a `<div class="guide-try">` pointing at the Explain tab (if the block has one), short `<h4>` sections, then the developer detail inside a `<details><summary>Deep dive: …</summary>` fold. Use `<pre><code>` (with `&lt;` for angle brackets) for examples.
6. **Teach the code (recommended): add `explain.json`** and load it in `index.js` (`explain: JSON.parse(await loadBlockAsset(import.meta.url, "explain.json"))`). It turns on the **Explain** tab (the block's own generated code, annotated) and the **X-ray** on the preview. See [Writing an explain.json](#writing-an-explainjson) below.
7. Add fixtures to `test/fixtures.js`: several variants covering each branch of `generateHTML` (empty values, optional parts, special characters).
8. Add an example section to `template/index.html` (and a table-of-contents entry). Paste the builder's output, so the template shows exactly what the tool produces. A test fails if a block has no example.
9. Build and accept the new snapshot:
   ```bash
   npm run build
   npm run snapshot:update
   npm test
   ```
10. A new block is a release: see [RELEASING.md](RELEASING.md) (an `additive` change with action `none`).

## Writing an explain.json

The Explain tab shows the block's real generated code. Hover a line and it lights up in the preview and says what it does; hover an attribute and it explains it and highlights every identical value (so "these two ids must match" is something you can see). You supply the words; the tool does the linking.

```json
{
  "intro": "Shown when nothing is selected. One or two sentences.",
  "parts": [
    {
      "selector": ".my-block__title",
      "label": "The title",
      "what": "One plain sentence anyone can follow. Use `backticks` for code words.",
      "how": "Optional. How it is built: the layer for the curious.",
      "deep": "Optional. Developer detail."
    }
  ],
  "attributes": { "data-thing": "Optional notes for attributes specific to this block." }
}
```

- A **part** is a CSS `selector` matched against the block's *generated* HTML. Each element gets the **first** part that matches, so list specific selectors before general ones (`a i` before `a`).
- Layers: `what` is always shown; `how` ("How it's built") and `deep` ("Developer detail") sit in folds. Write `what` for a complete beginner.
- Attributes: common ones (`class`, `id`, `href`, `src`, `alt`, `aria-*`, `data-bs-*`...) are already explained in `src/explain/glossary.json`. Add to your own `attributes` only for ones specific to your block, or to override the glossary.
- **Tests keep it honest** (`test/explain.test.js`): every element your block can output must belong to a part, no selector may be stale, and every attribute needs a note. If you change a block's HTML and a test complains, update the `explain.json`.
- Not yet covered by the tests: the wording. Read it aloud as a beginner would.

## Colours

Never write a colour in a block's CSS. Use a token, and name tokens for **what the colour is for**, not for the colour: `--text-on-primary`, `--panel-background`, `--shadow-colour`, not `--white` or `--grey`. That way a change says what it will affect. The theme colours are `--primary-colour` and `--secondary-colour`; the neutral ones (`--page-background`, `--text-on-primary`, `--floating-button-background`, `--subheading-colour`, `--card-text-colour`, `--focus-ring-colour`, `--panel-background`, `--shadow-colour`, `--divider-colour`, `--secondary-text-colour`, `--hover-background`, `--tile-border-colour`) are defined once in `src/base/base.css`. If you need a new one, define it there and add a changelog entry (base and blocks must be upgraded together, because a block reading a token the base doesn't define gets no colour). Two tests enforce this: no hard-coded colour outside the token definitions, and every token a block uses is defined by the base. A shadow is `color-mix(in srgb, var(--shadow-colour) 25%, transparent)`. (`--light-grey`, `--mid-grey` and `--dark-grey` are deprecated aliases of `--hover-background`, `--tile-border-colour` and `--secondary-text-colour`, kept until 3.6.0. Do not use them in new code.)

## Telling the upgrade tool how to spot your block

Give the block a `detect` signature in `index.js`, using the class names or ids its generated HTML carries (`detect: { classes: ["my-block"] }` or `{ ids: ["my-block"] }`). If an older version of the block used different markup, add `patterns` (regexes tested against the page's HTML, e.g. an `onclick` handler) so those pages are still recognised; a page whose JS already defines your block's functions is recognised too. The upgrade tool uses it to work out which blocks a pasted page uses, so it can output CSS for exactly those blocks. A test (`test/upgrade.test.js`) fails if a block with CSS or JS has no signature, if the signature doesn't match the block's own output, or if it also matches a different block's output.

## New field types

If no existing field type fits, add one to **both** `buildField` and `collectValue` in `src/ui/fields.js`, and add its value shape to a fixture.

Existing simple types: `text`, `select`, and `checkbox` (`{ type: "checkbox", id, label, help?, default? }`; the label is the checkbox's own text, the value is `true`/`false`, and a project saved before the field existed reads as `undefined`, so treat missing as off).
