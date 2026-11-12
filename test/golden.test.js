// Golden snapshots: the builder's output must not change unless a change is intended.
// Snapshot taken from the original single-file builder before it was split into modules.
// To accept an intended change: npm run snapshot:update, then review the git diff.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { capture } from "./capture.js";
import { BLOCKS } from "../src/blocks/index.js";
import { BASE_JS, getBaseCSS, getBaseHTML } from "../src/base/index.js";
import { cleanQuillHTML, markFirstParagraphLarge } from "../src/lib/richtext.js";
import { slugify, escapeHTML, indentLines } from "../src/lib/html.js";
import { toYouTubeEmbed, linkIsExternal, newTabAttrs } from "../src/lib/links.js";
import { compareVersions } from "../src/lib/versions.js";
import { buildPreviewDoc } from "../src/lib/preview-doc.js";
import { BASE_CSS } from "../src/base/index.js";

const SNAPSHOT = new URL("./snapshots/golden.json", import.meta.url);

const api = {
  BLOCKS, getBaseCSS, getBaseHTML, BASE_JS,
  guideFor: (id) => BLOCKS[id].guide,
  cleanQuillHTML, markFirstParagraphLarge, slugify, toYouTubeEmbed, linkIsExternal, newTabAttrs, escapeHTML, indentLines, compareVersions,
  buildPreviewDoc: (block, html, css, js, theme) => buildPreviewDoc(block, html, css, js, theme, BASE_CSS),
};

const actual = capture(api);

if (process.env.UPDATE_SNAPSHOTS) {
  writeFileSync(SNAPSHOT, JSON.stringify(actual, null, 2) + "\n");
  console.log("snapshot updated");
}
const expected = JSON.parse(readFileSync(SNAPSHOT, "utf8"));

test("base HTML, CSS and JS", () => assert.deepEqual(actual.base, expected.base));
test("rich text cleaning", () => assert.deepEqual(actual.richtext, expected.richtext));
test("helpers", () => assert.deepEqual(actual.helpers, expected.helpers));
test("preview document", () => assert.equal(actual.preview, expected.preview));
test("same set of blocks, in the same order", () => assert.deepEqual(Object.keys(actual.blocks), Object.keys(expected.blocks)));
for (const id of Object.keys(expected.blocks)) {
  test(`block: ${id}`, () => assert.deepEqual(actual.blocks[id], expected.blocks[id]));
}
