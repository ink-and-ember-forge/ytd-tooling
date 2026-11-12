// The base code every Gwella page starts with: HTML, CSS and JS.
// The sources are plain files next to this one (base.html / base.css / base.js).
// "{{VERSION}}" in them is replaced by the newest release in changelog.json.
import { loadText } from "../lib/assets.js";
import { BUILDER_VERSION } from "../changelog/index.js";

const read = async (name) => (await loadText(new URL(name, import.meta.url))).split("{{VERSION}}").join(BUILDER_VERSION);

export const BASE_HTML = await read("base.html");
export const BASE_CSS = `<style>\n${await read("base.css")}\n</style>`;
export const BASE_JS = `<script>\n${await read("base.js")}\n</script>`;

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

export function getBaseCSS(includeToc) {
  if (includeToc) return BASE_CSS;
  let css = BASE_CSS.replace("grid-template-columns: 1fr 3fr;", "grid-template-columns: 1fr;");
  css = removeCssRule(css, "#table-of-contents {");
  return css;
}
