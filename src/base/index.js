// The base code every Gwella page starts with: HTML, CSS and JS.
// The sources are plain files next to this one (base.html / base.css / base.js).
// "{{VERSION}}" in them is replaced by the newest release in changelog.json.
import { loadText } from "../lib/assets.js";
import { BUILDER_VERSION } from "../changelog/index.js";
import { assembleCSS, assembleJS } from "../lib/assemble.js";

const read = async (name) => (await loadText(new URL(name, import.meta.url))).split("{{VERSION}}").join(BUILDER_VERSION);

export const BASE_HTML = await read("base.html");
// The raw sources (no <style>/<script> wrapper), for assembling a page's code.
export const BASE_CSS_SOURCE = await read("base.css");
export const BASE_JS_SOURCE = await read("base.js");
export const BASE_CSS = `<style>\n${BASE_CSS_SOURCE}\n</style>`;
export const BASE_JS = `<script>\n${BASE_JS_SOURCE}\n</script>`;

// The builder's "Base HTML" with the page's theme class filled in. The ToC
// variant is derived from the one source rather than kept as a second copy.
export function getBaseHTML(includeToc, theme) {
  const html = includeToc
    ? BASE_HTML
    : BASE_HTML.replace(/\n\s*<!-- Each ToC href[\s\S]*?<\/nav>\n/, "\n");
  return html.replace("__THEME__", theme);
}

/* Removes one top-level CSS rule (selector + its full, brace-balanced
   body) by counting braces rather than a naive regex — safe even
   though #table-of-contents contains several levels of nested rules. */
export function removeCssRule(css, selectorStart) {
  const idx = css.indexOf(selectorStart);
  if (idx === -1) return css;
  const braceStart = css.indexOf("{", idx);
  let depth = 1;
  let i = braceStart + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  let end = i;
  if (css[end] === "\n") end++;
  return css.slice(0, idx) + css.slice(end);
}

// The ToC variant is derived from the one source: one column, no ToC rule.
function forToc(css, includeToc) {
  if (includeToc) return css;
  // Match the property, not its current value, so changing the column ratio
  // can't silently break this variant. The first match is .main-grid's own
  // (desktop) columns; the mobile override comes later in the rule.
  const oneColumn = css.replace(/(\.main-grid \{[^}]*?grid-template-columns:\s*)[^;]+;/, (_, head) => `${head}1fr;`);
  return removeCssRule(oneColumn, "#table-of-contents {");
}

export function getBaseCSS(includeToc) {
  return includeToc ? BASE_CSS : `<style>\n${forToc(BASE_CSS_SOURCE, false)}\n</style>`;
}

// The CSS for a page that uses exactly these blocks: base CSS with each block's
// CSS nested inside #page-container, wrapped in <style>. `blocks` are block
// definitions (as in the registry); only their `css` is used.
export function getPageCSS(includeToc, blocks) {
  return `<style>\n${assembleCSS(forToc(BASE_CSS_SOURCE, includeToc), blocks)}\n</style>`;
}

// The JS for a page that uses exactly these blocks: base JS plus each block's JS.
export function getPageJS(blocks) {
  return `<script>\n${assembleJS(BASE_JS_SOURCE, blocks).replace(/\n$/, "")}\n</script>`;
}
