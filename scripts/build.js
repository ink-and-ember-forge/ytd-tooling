#!/usr/bin/env node
// Generates template/template.css and template/template.js from the sources
// (src/base + src/blocks). Run `npm run build` after changing any base or block
// CSS/JS; `npm test` fails if template/ is out of date.
//
// template/index.html is NOT generated: it is the hand-written example page.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadText } from "../src/lib/assets.js";
import { assembleCSS, assembleJS } from "../src/lib/assemble.js";
import { BLOCK_LIST } from "../src/blocks/index.js";
import { BUILDER_VERSION } from "../src/changelog/index.js";

const here = (p) => new URL(p, import.meta.url);
const version = (s) => s.split("{{VERSION}}").join(BUILDER_VERSION);

export async function buildTemplateFiles() {
  const css = assembleCSS(version(await loadText(here("../src/base/base.css"))), BLOCK_LIST) + "\n";
  const js = assembleJS(version(await loadText(here("../src/base/base.js"))), BLOCK_LIST);
  return { "template/template.css": css, "template/template.js": js };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [file, text] of Object.entries(await buildTemplateFiles())) {
    writeFileSync(fileURLToPath(here("../" + file)), text);
    console.log("wrote", file);
  }
}
