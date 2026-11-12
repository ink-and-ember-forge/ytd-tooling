#!/usr/bin/env node
// Parity check: the builder (builder.js) and the reference template (template/)
// must describe the same base HTML, CSS and JS. Run: npm run check
//
// Zero dependencies. builder.js is not a module, so the pieces we need are
// cut out of the source text and evaluated in a sandbox (no DOM, no Quill).
// Comments and whitespace are ignored when comparing; code is not.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const builderSrc = read("builder.js");
const failures = [];
const fail = (msg) => failures.push(msg);

function slice(from, to) {
  const a = builderSrc.indexOf(from);
  const b = builderSrc.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`Cannot find "${from}" ... "${to}" in builder.js. Update scripts/check-sync.js.`);
  return builderSrc.slice(a, b);
}

// Evaluate the constants and helpers the builder uses to produce output.
const sandbox = { out: {} };
vm.createContext(sandbox);
vm.runInContext(
  slice("const BUILDER_VERSION", "function getBaseHTML") + // BASE_HTML / BASE_CSS / BASE_JS
    slice("const INTERNAL_HOSTS", "const QuillLink") +
    slice("function escapeHTML", "const HOW_IT_WORKS") + // helpers + BLOCKS
    ";out.v=BUILDER_VERSION;out.html=BASE_HTML;out.css=BASE_CSS;out.js=BASE_JS;out.blocks=BLOCKS;",
  sandbox
);
const { v: version, html, css, js, blocks } = sandbox.out;

const stripCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s+/g, "");

// 1. Versions agree everywhere.
const changelogVersion = (builderSrc.match(/const CHANGELOG = \{\s*"releases": \[\s*\{\s*"version": "([^"]+)"/) || [])[1];
const versions = {
  "builder.js BUILDER_VERSION": version,
  "builder.js CHANGELOG (newest release)": changelogVersion,
  "template.css header": (read("template/template.css").match(/Gwella base CSS · version (\S+)/) || [])[1],
  "template.js header": (read("template/template.js").match(/Gwella base JS · version (\S+)/) || [])[1],
  "template/index.html data-base-version": (read("template/index.html").match(/data-base-version="([^"]+)"/) || [])[1],
};
for (const [where, val] of Object.entries(versions)) {
  if (val !== version) fail(`Version mismatch: ${where} is ${val}, expected ${version}`);
}

// 2. Template CSS = base CSS with every block's CSS inserted at the marker.
const MARKER = /\n?\s*\/\* =+\s*PLACE NEW BLOCK CSS ABOVE THIS LINE/;
const marker = css.match(MARKER);
if (!marker) {
  fail("BASE_CSS has no 'PLACE NEW BLOCK CSS ABOVE THIS LINE' marker");
} else {
  const blockCss = Object.values(blocks).map((b) => b.css || "").join("\n");
  const assembled = css.slice(0, marker.index) + "\n" + blockCss + "\n" + css.slice(marker.index);
  const expected = stripCss(assembled.replace(/^<style>|<\/style>$/g, ""));
  const actual = stripCss(read("template/template.css"));
  if (expected !== actual) {
    let i = 0;
    while (expected[i] === actual[i]) i++;
    fail(`template.css differs from builder base CSS + block CSS (first difference at normalised char ${i}):\n    builder:  ...${expected.slice(i - 40, i + 60)}\n    template: ...${actual.slice(i - 40, i + 60)}`);
  }
}

// 3. Template JS = base JS plus every block's JS.
const blockJs = Object.values(blocks).map((b) => b.js || "").join("\n");
const jsBody = js.replace(/^<script>|<\\?\/script>$/g, "");
if (stripJs(jsBody + blockJs) !== stripJs(read("template/template.js"))) {
  fail("template.js differs from builder base JS + block JS");
}

// 4. Template HTML carries the same head-of-page includes as Base HTML.
const tplHtml = read("template/index.html");
for (const line of html.match(/<(link|script)[^>]+(cdn\.jsdelivr|cdnjs)[^>]+>/g) || []) {
  const url = line.match(/(?:href|src)="([^"]+)"/)[1];
  if (!tplHtml.includes(url)) fail(`template/index.html is missing the include ${url}`);
}

if (failures.length) {
  console.error("Sync check FAILED:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`Sync check OK: builder and template agree at version ${version} (${Object.keys(blocks).length} blocks).`);
