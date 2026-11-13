#!/usr/bin/env node
// Freezes the current base and block code into baseline/<version>/ so any later
// version can be compared with it (and so "what did 3.2.0 look like?" always has
// an answer). Run `npm run release` after bumping the changelog and `npm run build`.
//
//   baseline/<version>/base.html      Base HTML as pasted into a page ("__THEME__" is the theme class)
//   baseline/<version>/base.css       Base CSS (inner text, no <style> tags)
//   baseline/<version>/base.js        Base JS (inner text, no <script> tags)
//   baseline/<version>/blocks/<id>.css|.js
//   baseline/index.json               { "<version>": [files...] }, so the browser fetches only files that exist
//                                     (no 404s in the console). Rewritten on every release; `--reindex` rewrites it alone.
//
// A released version is frozen: this refuses to overwrite one unless --force.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
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

// { "<version>": ["base.css", "blocks/accordion.css", ...] } for every baseline on disk, versions in order.
export function buildBaselineIndex() {
  const root = fileURLToPath(here("../baseline/"));
  const walk = (dir, prefix = "") => readdirSync(dir).flatMap((name) =>
    statSync(dir + name).isDirectory() ? walk(`${dir}${name}/`, `${prefix}${name}/`) : [prefix + name]);
  const versions = readdirSync(root).filter((d) => statSync(root + d).isDirectory())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return Object.fromEntries(versions.map((v) => [v, walk(`${root}${v}/`).sort()]));
}

export const writeBaselineIndex = () =>
  writeFileSync(fileURLToPath(here("../baseline/index.json")), JSON.stringify(buildBaselineIndex(), null, 2) + "\n");

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes("--reindex")) {
  writeBaselineIndex();
  console.log("Rewrote baseline/index.json");
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
  writeBaselineIndex();
  console.log(`Released ${BUILDER_VERSION} to baseline/${BUILDER_VERSION}/`);
  // The migration tool is built on the template, so every release needs it checked (npm test fails until it has been).
  console.log(`\nNext: the MIGRATION CHECK. The migration tool depends on the template, so check what ${BUILDER_VERSION} did to it:\n  1. npm run snapshot:migration, then READ the diff of test/snapshots/migration.json\n  2. new or renamed tokens go in KNOWN_TOKENS / TOKEN_MAP (src/changelog/migrate.js); changed blocks need their old markup still detected\n  3. npm run test:e2e\nDetails: docs/RELEASING.md, "Migration check".`);
}
