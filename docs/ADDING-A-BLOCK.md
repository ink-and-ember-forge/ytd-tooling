# Adding a block

1. Scaffold it:
   ```bash
   npm run new-block -- my-block "My block"
   ```
   This creates `src/blocks/my-block/` (`index.js`, `block.css`, `how-it-works.html`) and adds it to `src/blocks/index.js`. Move it in that list if it should sit elsewhere (list order is tab order and CSS order).
2. Set `group` (Structure, Content, Interactive or Links) and a plain-English `tabLabel`: they decide where the block appears in the tab bar. Write `fields` and `generateHTML` in `index.js`. Reuse helpers from `src/lib/` (`escapeHTML`, `slugify`, `uniqueSlug`, `indentLines`, `newTabAttrs`, `mediaInner`...). Always escape user text.
3. Write `block.css`, indented as nested rules (it is placed inside `#page-container`). Use the theme variables (`--primary-colour`, `--secondary-colour`...).
4. If it needs script, add `block.js` and uncomment the `js:` line in `index.js`. It is appended to the base script, so keep functions global and idempotent.
5. Write `how-it-works.html` for the box under the tab.
6. Add fixtures to `test/fixtures.js`: several variants covering each branch of `generateHTML` (empty values, optional parts, special characters).
7. Add an example section to `template/index.html` (and a table-of-contents entry). Paste the builder's output, so the template shows exactly what the tool produces. A test fails if a block has no example.
8. Build and accept the new snapshot:
   ```bash
   npm run build
   npm run snapshot:update
   npm test
   ```
9. A new block is a release: see [RELEASING.md](RELEASING.md) (an `additive` change with action `none`).

## New field types

If no existing field type fits, add one to **both** `buildField` and `collectValue` in `src/ui/fields.js`, and add its value shape to a fixture.
