#!/usr/bin/env node
// Freezes the current base and block code into baseline/<version>/ so any later
// version can be compared with it (and so "what did 3.2.0 look like?" always has
// an answer). Run `npm run release` after bumping the changelog and `npm run build`.
//
//   baseline/<version>/base.html      Base HTML as pasted into a page ("__THEME__" is the theme class)
//   baseline/<version>/base.css       Base CSS (inner text, no <style> tags)
//   baseline/<version>/base.js        Base JS (inner text, no <script> tags)
//   baseline/<version>/blocks/<id>.css|.js
//
// A released version is frozen: this refuses to overwrite one unless --force.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadText } from "../src/lib/assets.js";
import { BLOCK_LIST } from "../src/blocks/index.js";
import { BUILDER_VERSION } from "../src/changelog/index.js";

const here = (p) => new URL(p, import.meta.url);
const version = (s) => s.split("{{VERSION}}").join(BUILDER_VERSION);

// The files that make up a release, as { relative path: text }.
export async function releaseFiles() {
  const files = {
    "base.html": version(await loadText(here("../src/base/base.html"))),
    "base.css": version(await loadText(here("../src/base/base.css"))),
    "base.js": version(await loadText(here("../src/base/base.js"))),
  };
  for (const b of BLOCK_LIST) {
    if (b.css) files[`blocks/${b.id}.css`] = b.css;
    if (b.js) files[`blocks/${b.id}.js`] = b.js;
  }
  return files;
}

export const baselineDir = (v = BUILDER_VERSION) => fileURLToPath(here(`../baseline/${v}/`));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = baselineDir();
  if (existsSync(dir) && !process.argv.includes("--force")) {
    console.error(`baseline/${BUILDER_VERSION} already exists and released versions are frozen.\nBump the version in changelog/changelog.json first (or pass --force if this version was never published).`);
    process.exit(1);
  }
  for (const [rel, text] of Object.entries(await releaseFiles())) {
    const p = dir + rel;
    mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
    writeFileSync(p, text + "\n");
  }
  console.log(`Released ${BUILDER_VERSION} to baseline/${BUILDER_VERSION}/`);
}
