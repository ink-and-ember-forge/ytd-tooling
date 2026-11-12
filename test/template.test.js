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
