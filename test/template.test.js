// template/template.css and template.js are generated; they must match the sources.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTemplateFiles } from "../scripts/build.js";
import { BUILDER_VERSION } from "../src/changelog/index.js";
import { BLOCK_LIST } from "../src/blocks/index.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("template CSS/JS are up to date (run `npm run build`)", async () => {
  for (const [file, text] of Object.entries(await buildTemplateFiles())) {
    assert.equal(read(file), text, `${file} is out of date: run npm run build`);
  }
});

test("template page carries the current base version", () => {
  assert.match(read("template/index.html"), new RegExp(`data-base-version="${BUILDER_VERSION.replace(/\./g, "\\.")}"`));
});

test("template page uses the CDN includes from the base HTML", async () => {
  const { BASE_HTML } = await import("../src/base/index.js");
  const page = read("template/index.html");
  for (const m of BASE_HTML.matchAll(/(?:href|src)="(https:\/\/cdn[^"]+)"/g)) {
    assert.ok(page.includes(m[1]), `template/index.html is missing ${m[1]}`);
  }
});

test("every block's CSS class root appears in the template page", () => {
  const page = read("template/index.html");
  for (const b of BLOCK_LIST) {
    if (!b.css) continue;
    const root = b.css.match(/^\s*[.#]([\w-]+)/)[1];
    assert.ok(page.includes(root), `block "${b.id}" (.${root}) has no example in template/index.html`);
  }
});

test("no-ToC base CSS: single column, no ToC rule, whatever the ToC column ratio is", async () => {
  const { getBaseCSS } = await import("../src/base/index.js");
  const css = getBaseCSS(false);
  const grid = css.match(/\.main-grid \{[\s\S]*?\n  \}/)[0];
  assert.match(grid, /grid-template-columns:\s*1fr;/);
  assert.doesNotMatch(grid, /\bfr 3fr/);
  assert.doesNotMatch(css, /#table-of-contents/);
});

test(".tight-heading beats the content-column H2 margin without !important", async () => {
  const { BASE_CSS } = await import("../src/base/index.js");
  const tight = BASE_CSS.indexOf("h2.tight-heading");
  assert.ok(tight > BASE_CSS.indexOf(".content-column {"), "must come after .content-column so equal specificity resolves in its favour");
  assert.doesNotMatch(BASE_CSS.slice(tight, tight + 60), /!important/);
});

test("Section: the tight-heading option is off by default and only adds the class when ticked", async () => {
  const { BLOCKS } = await import("../src/blocks/index.js");
  const s = BLOCKS.section;
  assert.equal(s.fields.find((f) => f.id === "tightHeading").type, "checkbox");
  assert.ok(!s.generateHTML({ title: "A" }).includes("tight-heading"), "undefined (older saved projects) means off");
  assert.ok(!s.generateHTML({ title: "A", tightHeading: false }).includes("tight-heading"));
  assert.match(s.generateHTML({ title: "A", tightHeading: true }), /<h2 class="tight-heading">A<\/h2>/);
});

// ---- the template's colours are tokens ------------------------------------------------
// Every colour is a custom property named for what it is used for (--primary-colour, --text-on-primary, --panel-background...).
// A hard-coded colour in a rule hides what a change would affect, so none is allowed outside the token definitions.

const sources = async () => {
  const { loadText } = await import("../src/lib/assets.js");
  const { BLOCK_LIST } = await import("../src/blocks/index.js");
  const files = [["base.css", await loadText(new URL("../src/base/base.css", import.meta.url))]];
  for (const b of BLOCK_LIST) if (b.css) files.push([`${b.id}/block.css`, b.css]);
  return files;
};
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

test("no hard-coded colour in the template's CSS, outside the token definitions", async () => {
  const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black|red|green|blue|grey|gray)\b/;
  const found = [];
  for (const [file, css] of await sources()) {
    withoutComments(css).split("\n").forEach((text, i) => {
      if (/^\s*--[\w-]+:/.test(text)) return;                                   // a token definition
      const line = text
        .replace(/var\(\s*--[\w-]+\s*\)/g, "") // a plain token reference (its NAME may contain a colour word; a var() with a hard-coded fallback is still checked)
        .replace(/color-mix\(in srgb, ,? ?black 15%\)/g, "").replace(/color-mix\(in srgb, black 15%\)/g, ""); // darkening a button on hover: a mixing instruction, not a design colour
      if (COLOUR.test(line)) found.push(`${file}: ${text.trim()}`);
    });
  }
  assert.deepEqual(found, [], "use a token named for what the colour is for, and define it in base.css");
});

test("every token a block uses is defined by the base CSS", async () => {
  const files = await sources();
  const defined = new Set([...withoutComments(files[0][1]).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const setByJs = /^--(thinqi-navbar-height|anchor-section-offset|bs-[\w-]+)$/;
  const missing = [];
  for (const [file, css] of files) {
    const own = new Set([...withoutComments(css).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    for (const m of withoutComments(css).matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!defined.has(m[1]) && !own.has(m[1]) && !setByJs.test(m[1])) missing.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], "a block that reads a token the base never defines gets no colour when the two versions are mixed");
});
