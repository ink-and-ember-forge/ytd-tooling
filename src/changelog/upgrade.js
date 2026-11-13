// Builds an upgraded page from a pasted one: which blocks it uses, and the
// complete new HTML marker, CSS and JS for exactly those blocks. Pure (no DOM,
// no file access beyond the modules it imports), so it runs in Node tests.
import { BLOCK_LIST } from "../blocks/index.js";
import { CHANGELOG, BUILDER_VERSION } from "./index.js";
import { checkPage } from "./checker.js";
import { getPageCSS, getPageJS, BASE_CSS_SOURCE } from "../base/index.js";
import { loadBaseline } from "../lib/baseline.js";
import { suggestVersions } from "./sniff.js";
import { findLocalEdits, overridesRegion, splitOverrides } from "./local-edits.js";
import { parseCss } from "./css-tree.js";

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// An attribute whose value (a space-separated list for class) contains `token` as a whole word.
const attrHas = (name, token) => new RegExp(`\\s${name}="(?:[^"]*\\s)?${escapeRegExp(token)}(?:\\s[^"]*)?"`);

// The blocks (in registry order) whose declared `detect` signature appears in the page's HTML.
export function detectBlocks(html, blocks = BLOCK_LIST) {
  return blocks.filter((b) => b.detect && (
    (b.detect.classes || []).some((c) => attrHas("class", c).test(html)) ||
    (b.detect.ids || []).some((i) => attrHas("id", i).test(html))
  ));
}

const MARKER = /data-base-version="[\d.]+"/;

// page: { html, css, js } as pasted. options:
//   version   "auto" (read the marker), "legacy", or a version number
//   blockIds  override the detected blocks (e.g. after the author corrects them)
//   includeToc  override whether the page has a table of contents (default: read the HTML)
//   baseline  the loaded baseline (lib/baseline.js) for the page's version. With it, the page's own
//             CSS edits are found and kept in a PAGE-SPECIFIC OVERRIDES region. Without it, an existing
//             region is still carried forward, but new edits can't be detected. null means "looked up, none stored" (adds a note); undefined means "not looked up".
//   dropEdits ids of detected edits (E1, E2...) the author chose not to keep
// Returns { error } or:
//   pageVersion, toVersion, upToDate, blocks (ids), includeToc,
//   html, css, js   the upgraded code, ready to copy
//   edits           the page's own CSS edits (null when no baseline was given), each with
//                   kept (true/false) and, when not kept, why
//   notes           things the tool could not do for the author
//   report          the checkPage report (what changed, per change)
export function buildUpgrade(page, { version = "auto", blockIds = null, includeToc = null, baseline, dropEdits = [], changelog = CHANGELOG, blocks = BLOCK_LIST } = {}) {
  const { html = "", css = "", js = "" } = page;
  const report = checkPage([html, css, js].join("\n"), version, changelog);
  if (report.error) return { error: report.error };

  const used = blockIds ? blocks.filter((b) => blockIds.includes(b.id)) : detectBlocks(html, blocks);
  const toc = includeToc ?? /\sid="table-of-contents"/.test(html);
  const notes = [];

  // HTML: only the version marker is changed. Everything else is the author's.
  const marker = `data-base-version="${BUILDER_VERSION}"`;
  let outHtml = html;
  if (!html.trim()) {
    notes.push(`No HTML was pasted, so set ${marker} on #page-container yourself.`);
  } else if (MARKER.test(html)) {
    outHtml = html.replace(MARKER, marker);
  } else if (/<div\b[^>]*\bid="page-container"/.test(html)) {
    outHtml = html.replace(/(<div\b[^>]*\bid="page-container")/, `$1 ${marker}`);
    notes.push("The page had no version marker; one was added to #page-container.");
  } else {
    notes.push(`No #page-container was found in the HTML, so set ${marker} on it yourself.`);
  }
  if (blocks.length && !used.length) notes.push("No blocks were recognised on this page. Check the list of blocks and tick any that are used.");

  // CSS: the standard code for the blocks in use, then the author's kept edits in the overrides region.
  let outCss = getPageCSS(toc, used);
  let edits = null;
  const usedIds = used.map((b) => b.id);
  let kept = [];
  let carried = parseCss(splitOverrides(css).overrides);
  if (baseline && css.trim()) {
    const found = findLocalEdits(css, baseline, { includeToc: toc, currentBase: BASE_CSS_SOURCE });
    carried = found.carried;
    edits = found.edits.map((e) => {
      const why = !e.keepable ? "A removed property or rule can't be kept; the new standard applies."
        : e.blockId && !usedIds.includes(e.blockId) ? `The ${e.blockId} block is not used on this page.`
        : dropEdits.includes(e.id) ? "Dropped by the author."
        : null;
      return { ...e, kept: !why, why };
    });
    kept = edits.filter((e) => e.kept);
    if (found.unbalanced) notes.push("The pasted CSS has unmatched braces, so some of it may not have been read. Check the result.");
    if (found.differences > 30 && found.differences > found.total * 0.1) {
      notes.push(`This CSS differs from the standard ${report.pageVersion} code in ${found.differences} places. It may not really be version ${report.pageVersion}; check the version before keeping these edits.`);
    }
  } else if (css.trim() && baseline === null) { // looked up, and there is none
    notes.push(`There is no stored code for version ${report.pageVersion}, so edits made by hand to the CSS can't be detected. Any existing PAGE-SPECIFIC OVERRIDES region is kept.`);
  }
  const region = overridesRegion(kept, carried);
  if (region) outCss = outCss.replace(/\n<\/style>$/, `\n\n${region}\n</style>`);
  const removed = (edits || []).filter((e) => !e.keepable);
  if (removed.length) notes.push(`${removed.length} thing(s) removed from the standard CSS were not kept: ${removed.map((e) => e.summary).join("; ")}.`);

  return {
    pageVersion: report.pageVersion,
    toVersion: BUILDER_VERSION,
    upToDate: report.upToDate,
    blocks: used.map((b) => b.id),
    includeToc: toc,
    html: outHtml,
    css: outCss,
    js: getPageJS(used),
    edits,
    notes,
    report,
  };
}

// buildUpgrade, after loading the stored code for the page's version so its own CSS edits can be found.
// When the version can't be read from the page, or the CSS looks like a different version from the one
// claimed, the result also carries `suggestions`: the stored versions the CSS is closest to.
export async function upgradePage(page, options = {}) {
  const first = buildUpgrade(page, options);
  if (first.error) return { ...first, suggestions: await suggestVersions(page.css) };
  if (options.baseline !== undefined || first.pageVersion === "legacy") return first;
  const result = buildUpgrade(page, { ...options, baseline: await loadBaseline(first.pageVersion) });
  if (result.notes.some((n) => /may not really be version/.test(n))) {
    const suggestions = await suggestVersions(page.css);
    const best = suggestions[0];
    if (best && best.version !== result.pageVersion) {
      result.notes.push(`This CSS is closest to version ${best.version} (${best.differences} differences, against ${suggestions.find((x) => x.version === result.pageVersion)?.differences ?? "many"} for version ${result.pageVersion}).`);
    }
    return { ...result, suggestions };
  }
  return result;
}
