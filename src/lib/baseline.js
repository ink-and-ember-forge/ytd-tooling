// Reads a frozen release from baseline/<version>/ (see scripts/release.js), in
// the browser (fetch) or Node (fs). Lets the tool answer "what did a page built
// on version X look like?", which is what the upgrade checks are verified
// against. A missing baseline is not an error: the loader returns null.
import { loadText } from "./assets.js";
import { BLOCK_LIST } from "../blocks/index.js";
import { assembleCSS, assembleJS } from "./assemble.js";

const fileUrl = (version, file) => new URL(`../../baseline/${version}/${file}`, import.meta.url);
const tryLoad = (url) => loadText(url).catch(() => null);

// { version, html, css, js, blocks: { <id>: { id, css, js } } } or null.
export async function loadBaseline(version) {
  const css = await tryLoad(fileUrl(version, "base.css"));
  if (css === null) return null;
  const [html, js] = await Promise.all([tryLoad(fileUrl(version, "base.html")), tryLoad(fileUrl(version, "base.js"))]);
  const blocks = {};
  await Promise.all(BLOCK_LIST.map(async (b) => {
    const [bcss, bjs] = await Promise.all([tryLoad(fileUrl(version, `blocks/${b.id}.css`)), tryLoad(fileUrl(version, `blocks/${b.id}.js`))]);
    if (bcss !== null || bjs !== null) blocks[b.id] = { id: b.id, css: bcss, js: bjs };
  }));
  return { version, html, css, js, blocks };
}

// A page's code as it would have been pasted from this baseline: the base plus
// the given blocks (default: every block the baseline has), in registry order.
// Returns { html, css, js } with the <style>/<script> wrappers the builder hands out.
export function baselinePage(baseline, { blockIds = null, theme = "gwella" } = {}) {
  const blocks = BLOCK_LIST.filter((b) => baseline.blocks[b.id] && (!blockIds || blockIds.includes(b.id))).map((b) => baseline.blocks[b.id]);
  return {
    html: baseline.html.replace("__THEME__", theme),
    css: `<style>\n${assembleCSS(baseline.css, blocks)}\n</style>`,
    js: `<script>\n${assembleJS(baseline.js, blocks).replace(/\n$/, "")}\n</script>`,
  };
}
