#!/usr/bin/env node
// Scaffolds a new block: npm run new-block -- my-block "My block"
// Creates src/blocks/<id>/ and adds it to src/blocks/index.js. See docs/ADDING-A-BLOCK.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [id, label] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || !label) {
  console.error('Usage: npm run new-block -- <kebab-case-id> "Label"');
  process.exit(1);
}
const root = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const dir = root(`src/blocks/${id}/`);
if (existsSync(dir)) { console.error(`src/blocks/${id}/ already exists`); process.exit(1); }
mkdirSync(dir, { recursive: true });

const root_class = id;
writeFileSync(dir + "index.js", `import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML } from "../../lib/html.js";

export default {
  id: "${id}",
  label: ${JSON.stringify(label)},
  description: "One or two sentences for the block's tab: what it is for and when to use it.",
  // Field types: text, bullet-list, select, media-picker, rich-text, button-items, nav-card-items,
  // resource-card-items, icon-toggle-items, item-list (see src/ui/fields.js).
  fields: [
    { type: "text", id: "title", label: "Title", placeholder: "e.g. A title" }
  ],
  generateHTML: (values) => {
    return \`<div class="${root_class}">
  <h3>\${escapeHTML(values.title.trim())}</h3>
</div>\`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  // js: await loadBlockAsset(import.meta.url, "block.js"),   // only if the block needs script (add block.js)
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
`);
writeFileSync(dir + "block.css", `  .${root_class} {
    /* Block CSS is nested inside #page-container in the assembled template. */
  }
`);
writeFileSync(dir + "how-it-works.html", `<p>Plain-English explanation for the "How it works" box under this block's tab.</p>
`);

// register
const reg = root("src/blocks/index.js");
let s = readFileSync(reg, "utf8");
const name = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
s = s.replace(/\nexport const BLOCK_LIST = \[/, `\nimport ${name} from "./${id}/index.js";\n\nexport const BLOCK_LIST = [`);
s = s.replace(/\n\];/, `\n  ${name},\n];`);
writeFileSync(reg, s);
console.log(`Created src/blocks/${id}/ and registered it.\nNext: add fixtures in test/fixtures.js, an example in template/index.html, run npm run build && npm run snapshot:update.`);
