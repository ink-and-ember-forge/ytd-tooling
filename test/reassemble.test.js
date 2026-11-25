// Re-assembling CSS/JS from the final HTML (src/changelog/reassemble.js), and the validator rule that catches block markup
// whose CSS/JS is missing (src/validate/template-pack.js). Finding 4.1.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reassembleAssets } from "../src/changelog/reassemble.js";
import { buildMigration } from "../src/changelog/migrate.js";
import { getPageCSS, getPageJS, removeCssRule } from "../src/base/index.js";
import { BLOCKS, BLOCK_LIST } from "../src/blocks/index.js";
import { FIXTURES } from "./fixtures.js";
import { validate } from "../src/validate/index.js";
import { templatePack } from "../src/validate/template-pack.js";
import { OVERRIDES_START, OVERRIDES_END } from "../src/changelog/local-edits.js";

const read = (p) => readFileSync(new URL(`./fixtures/${p}`, import.meta.url), "utf8");
const first = (id) => BLOCKS[id].generateHTML(Object.values(FIXTURES[id])[0]);
const page = (...ids) => `<div id="page-container" data-base-version="3.4.0">\n${ids.map(first).join("\n")}\n</div>`;
const run = (p, packs = [templatePack]) => validate(p, { packs });
const ofId = (r, id) => r.findings.filter((f) => f.id === id);

test("reassemble: CSS and JS equal getPageCSS/getPageJS for the blocks the final HTML uses", () => {
  const html = page("nav-cards", "buttons", "resource-cards", "two-column", "flex-section", "icon-toggle");
  const r = reassembleAssets({ html, css: getPageCSS(true, []), js: getPageJS([]) });
  const used = BLOCK_LIST.filter((b) => ["nav-cards", "buttons", "resource-cards", "two-column", "flex-section", "icon-toggle"].includes(b.id));
  assert.deepEqual(r.blocks, used.map((b) => b.id));
  assert.equal(r.css, getPageCSS(false, used));
  assert.equal(r.js, getPageJS(used));
  assert.deepEqual(r.added.sort(), used.map((b) => b.id).sort());
  assert.equal(r.changed, true);
});

test("reassemble: nothing to do when the assets already match; page-specific overrides survive byte for byte", () => {
  const html = page("accordion");
  const used = [BLOCKS.accordion];
  const region = `${OVERRIDES_START}\n/* kept: Text: house style */\n#page-container {\n  .x { margin: 0 }\n}\n${OVERRIDES_END}`;
  const css = getPageCSS(false, used).replace(/\n<\/style>$/, `\n\n${region}\n</style>`);
  const r = reassembleAssets({ html, css, js: getPageJS(used) });
  assert.equal(r.changed, false);
  assert.deepEqual(r.added, []);
  assert.equal(r.overrides, true);
  assert.ok(r.css.includes(region), "the region is carried as written");
  // and when a block is added the region still survives
  const more = reassembleAssets({ html: page("accordion", "buttons"), css, js: getPageJS(used) });
  assert.ok(more.css.includes(region));
  assert.deepEqual(more.added, ["buttons"]);
});

test("reassemble: a block the page no longer uses is dropped, and listed", () => {
  const used = [BLOCKS.accordion, BLOCKS.buttons];
  const r = reassembleAssets({ html: page("accordion"), css: getPageCSS(false, used), js: getPageJS(used) });
  assert.deepEqual(r.blocks, ["accordion"]);
  assert.deepEqual(r.removed, ["buttons"]);
});

test("migration then rebuild then re-assemble: the real page's CSS and JS follow the blocks it ends up with", () => {
  const legacy = { html: read("legacy2/page.html"), css: read("legacy2/page.css"), js: read("legacy2/page.js") };
  const m = buildMigration(legacy, { theme: "gwella" });
  const rebuilt = m.html.replace(/<\/div>\s*$/, `${first("nav-cards")}\n${first("icon-toggle")}\n</div>`);
  const r = reassembleAssets({ html: rebuilt, css: m.css, js: m.js });
  assert.ok(r.blocks.includes("nav-cards") && r.blocks.includes("icon-toggle"));
  const used = BLOCK_LIST.filter((b) => r.blocks.includes(b.id));
  assert.ok(r.css.startsWith(getPageCSS(r.includeToc, used).replace(/\n<\/style>$/, "")), "the standard part is exactly getPageCSS for the blocks used");
  assert.equal(r.js, getPageJS(used));
});

// ---- the validator rule ----

test("template pack: block markup with no block CSS and JS is an error, and re-assembling fixes it", () => {
  const html = page("nav-cards", "icon-toggle");
  const bare = { html, css: getPageCSS(true, []), js: getPageJS([]) };
  const r = run(bare);
  assert.deepEqual(ofId(r, "template/block-css-missing").map((f) => f.data.block).sort(), ["icon-toggle", "nav-cards"]);
  assert.equal(ofId(r, "template/block-js-missing").length, 1);
  assert.ok(r.counts.error >= 3);
  const fixed = reassembleAssets(bare);
  const after = run({ html, css: fixed.css, js: fixed.js });
  assert.equal(after.findings.filter((f) => f.id.startsWith("template/block-")).length, 0);
});

test("template pack: a block missing only SOME of its rules is reported with the rule names; a missing nested rule is only a note", () => {
  const full = getPageCSS(false, [BLOCKS["nav-cards"]]);
  const css = removeCssRule(full, ".nav-card {");
  assert.notEqual(css, full, "the rule was removed");
  const f = ofId(run({ html: page("nav-cards"), css, js: getPageJS([]) }), "template/block-css-missing");
  assert.equal(f.length, 1);
  assert.match(f[0].message, /part of its CSS is missing \(\.nav-card\)/);
  const acc = getPageCSS(false, [BLOCKS.accordion]);
  const r = run({ html: page("accordion"), css: removeCssRule(acc, ".accordion-button {"), js: getPageJS([]) });
  assert.equal(ofId(r, "template/block-css-missing").length, 0);
  assert.equal(ofId(r, "template/block-css-outdated").length, 1);
});

test("template pack: CSS that differs from the current block code is info, not an error; an overrides region is not a difference", () => {
  const html = page("buttons");
  const css = getPageCSS(false, [BLOCKS.buttons]);
  const region = `${OVERRIDES_START}\n#page-container {\n  .buttons { gap: 3rem }\n}\n${OVERRIDES_END}`;
  const withRegion = css.replace(/\n<\/style>$/, `\n\n${region}\n</style>`);
  assert.equal(ofId(run({ html, css: withRegion, js: getPageJS([]) }), "template/block-css-outdated").length, 0);
  const edited = css.replace(/(\.buttons \{[^}]*?)(\n)/, "$1 /*x*/ margin-top: 9px;$2");
  const f = ofId(run({ html, css: edited, js: getPageJS([]) }), "template/block-css-outdated");
  assert.ok(f.length <= 1 && f.every((x) => x.severity === "info"));
});

test("template pack: every block's own output with its own CSS and JS has no block-code findings", () => {
  for (const b of BLOCK_LIST) {
    const html = page(b.id);
    const r = run({ html, css: getPageCSS(false, [b]), js: getPageJS([b]) });
    assert.deepEqual(r.findings.filter((f) => /^template\/block-/.test(f.id)).map((f) => `${b.id}: ${f.id}`), []);
  }
});
