// Finds lines an author added to (or removed from) a page's JS, by comparing it with
// the standard JS of the version the page was built on. This is a plain line diff: the
// template's JS is small, so that is enough, and the result is shown to the author to
// re-add by hand (JS is not merged for them). Pure; used by buildUpgrade in upgrade.js.
import { assembleJS } from "../lib/assemble.js";
import { BLOCK_LIST } from "../blocks/index.js";

// Lines compared without their wrapper, indentation, blank lines or comments.
export function jsLines(text) {
  return text
    .replace(/^\s*<script[^>]*>/i, "").replace(/<\/script>\s*$/i, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
}

// Longest common subsequence of two line lists, then what is only in a (removed) and only in b (added).
export function diffLines(a, b) {
  const n = a.length, m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const removed = [], added = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) removed.push(a[i++]);
    else added.push(b[j++]);
  }
  while (i < n) removed.push(a[i++]);
  while (j < m) added.push(b[j++]);
  return { added, removed };
}

// pageJs: the page's script as pasted. baseline: for the page's version. blockIds: the blocks the page has.
// Returns { added: string[], removed: string[] } (empty arrays when the page's JS is the standard JS).
export function findJsEdits(pageJs, baseline, blockIds) {
  const blocks = BLOCK_LIST.filter((b) => blockIds.includes(b.id) && baseline.blocks[b.id]?.js).map((b) => baseline.blocks[b.id]);
  const pristine = assembleJS(baseline.js, blocks);
  const { added, removed } = diffLines(jsLines(pristine), jsLines(pageJs));
  return { added, removed };
}
