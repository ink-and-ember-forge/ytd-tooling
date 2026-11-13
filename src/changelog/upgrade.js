// Builds an upgraded page from a pasted one: which blocks it uses, and the
// complete new HTML marker, CSS and JS for exactly those blocks. Pure (no DOM,
// no file access beyond the modules it imports), so it runs in Node tests.
import { BLOCK_LIST } from "../blocks/index.js";
import { CHANGELOG, BUILDER_VERSION } from "./index.js";
import { checkPage } from "./checker.js";
import { getPageCSS, getPageJS } from "../base/index.js";

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
// Returns { error } or:
//   pageVersion, toVersion, upToDate, blocks (ids), includeToc,
//   html, css, js   the upgraded code, ready to copy
//   notes           things the tool could not do for the author
//   report          the checkPage report (what changed, per change)
export function buildUpgrade(page, { version = "auto", blockIds = null, includeToc = null, changelog = CHANGELOG, blocks = BLOCK_LIST } = {}) {
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

  return {
    pageVersion: report.pageVersion,
    toVersion: BUILDER_VERSION,
    upToDate: report.upToDate,
    blocks: used.map((b) => b.id),
    includeToc: toc,
    html: outHtml,
    css: getPageCSS(toc, used),
    js: getPageJS(used),
    notes,
    report,
  };
}
