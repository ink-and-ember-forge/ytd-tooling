// Re-assembling a page's CSS and JS from its FINAL HTML. Pure.
//
// buildMigration / buildUpgrade assemble the stylesheet and script for the blocks found in the HTML as it was pasted. When the
// author then rebuilds placeholders with blocks (Nav cards, Buttons, Resource cards...), the page uses blocks the CSS and JS were
// never assembled for. Call this with the HTML as it stands now to get CSS and JS for exactly the blocks it uses. The page's own
// PAGE-SPECIFIC OVERRIDES region is carried over exactly as written.
import { BLOCK_LIST } from "../blocks/index.js";
import { getPageCSS, getPageJS } from "../base/index.js";
import { detectBlocks } from "./upgrade.js";
import { extractOverridesRegion } from "./local-edits.js";

// page: { html, css, js } as it is now. options: includeToc (default: read the HTML), blocks (the registry).
// Returns { blocks (ids now used), added (ids whose code was missing from the old CSS or JS), removed (ids whose code the page
// carried but no longer uses), includeToc, css, js, changed, overrides (true when a region was carried over) }.
export function reassembleAssets({ html = "", css = "", js = "" }, { includeToc = null, blocks = BLOCK_LIST } = {}) {
  // From the HTML alone: the old JS defining a block's functions says what the page USED to need, not what it needs now.
  const used = detectBlocks(html, blocks, "");
  const toc = includeToc ?? /\sid="table-of-contents"/.test(html);
  let outCss = getPageCSS(toc, used);
  const region = extractOverridesRegion(css);
  if (region) outCss = outCss.replace(/\n<\/style>$/, `\n\n${region}\n</style>`);
  const outJs = getPageJS(used);

  const before = new Set(detectBlocks("", blocks, js).map((b) => b.id)); // blocks whose JS the page already carries
  const cssHas = (b) => !b.css || squash(css).includes(squash(b.css));
  const jsHas = (b) => !b.js || squash(js).includes(squash(b.js));
  const added = used.filter((b) => !(cssHas(b) && jsHas(b))).map((b) => b.id);
  const removed = blocks.filter((b) => (before.has(b.id) || (b.css && cssHas(b))) && !used.includes(b)).map((b) => b.id);
  return { blocks: used.map((b) => b.id), added, removed, includeToc: toc, css: outCss, js: outJs, changed: squash(outCss) !== squash(css) || squash(outJs) !== squash(js), overrides: !!region };
}

const squash = (s) => s.replace(/\s+/g, " ").trim();
