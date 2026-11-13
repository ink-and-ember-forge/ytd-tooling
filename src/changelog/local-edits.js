// Finds the changes an author made to a page's CSS by hand, by comparing it (by
// meaning, see css-tree.js) with the pristine CSS of the version the page was
// built on, and writes the ones worth keeping into a labelled overrides region
// at the end of the stylesheet. Because that region is recognised on the next
// upgrade, kept edits are carried forward instead of being treated as damage.
// Pure; used by buildUpgrade in upgrade.js.
import { assembleCSS } from "../lib/assemble.js";
import { BLOCK_LIST } from "../blocks/index.js";
import { forToc } from "../base/index.js";
import { parseCss, serializeCss, keyedChildren, findNode, mergeTrees, cloneNode, countDecls, summariseNode } from "./css-tree.js";

export const OVERRIDES_START = "/* ===== PAGE-SPECIFIC OVERRIDES: kept by the upgrade tool. Add or edit rules here; they are carried forward when the page is upgraded. ===== */";
export const OVERRIDES_END = "/* ===== END PAGE-SPECIFIC OVERRIDES ===== */";
const REGION = /\n*\/\* =+ PAGE-SPECIFIC OVERRIDES:[\s\S]*?=+ \*\/\s*([\s\S]*?)\s*\/\* =+ END PAGE-SPECIFIC OVERRIDES =+ \*\//;

// { css: the stylesheet without its overrides region, overrides: the region's rules (text) or "" }
export function splitOverrides(css) {
  const m = css.match(REGION);
  return m ? { css: css.replace(REGION, ""), overrides: m[1] } : { css, overrides: "" };
}

const rootsOf = (blockCss) => parseCss(blockCss).children.map((c) => c.selector);
const CONTAINER = "#page-container";

// Which blocks' rules appear in the page's stylesheet (a block is present if any of its top-level rules do).
export function blocksInCss(pageTree, blocks) {
  const container = findNode(pageTree, [CONTAINER]);
  const have = new Set((container ? container.children : []).map((c) => c.selector));
  return Object.values(blocks).filter((b) => b.css && rootsOf(b.css).some((r) => have.has(r))).map((b) => b.id);
}

// The standard CSS for these blocks, as a tree. `base` is the base CSS source, `blocks` an array of { css }.
function standardTree(base, blocks, includeToc) {
  return parseCss(assembleCSS(forToc(base, includeToc), blocks));
}

const keyOf = (path) => path.join(" › ");

function diffNode(pristine, page, path, out) {
  for (const [prop, values] of page.decls) {
    const was = pristine.decls.get(prop);
    if (!was) out.push({ kind: "added-decl", path, prop, to: values });
    else if (was.join("\n") !== values.join("\n")) out.push({ kind: "changed-decl", path, prop, from: was, to: values });
  }
  for (const [prop, was] of pristine.decls) if (!page.decls.has(prop)) out.push({ kind: "removed-decl", path, prop, from: was });
  const had = keyedChildren(pristine), has = keyedChildren(page);
  for (const [key, child] of has) {
    if (!had.has(key)) out.push({ kind: "added-rule", path, selector: child.selector, node: child });
    else diffNode(had.get(key), child, [...path, child.selector], out);
  }
  for (const [key, child] of had) if (!has.has(key)) out.push({ kind: "removed-rule", path, selector: child.selector });
}

const show = (v) => v.join(" / ");
function describe(e) {
  const where = keyOf(e.kind === "added-rule" || e.kind === "removed-rule" ? [...e.path, e.selector] : e.path) || "(top level)";
  switch (e.kind) {
    case "changed-decl": return `${where}: ${e.prop} is ${show(e.to)} (standard: ${show(e.from)})`;
    case "added-decl": return `${where}: adds ${e.prop}: ${show(e.to)}`;
    case "removed-decl": return `${where}: removes ${e.prop} (standard: ${show(e.from)})`;
    case "added-rule": return `${where}: a rule of your own — ${summariseNode(e.node)}`;
    case "removed-rule": return `${where}: rule removed`;
  }
}
// A removed property or rule can't be expressed as an override, so it can't be kept.
const KEEPABLE = new Set(["changed-decl", "added-decl", "added-rule"]);

// pageCss: the page's stylesheet as pasted.
// baseline: a loaded baseline (lib/baseline.js) for the version the page was built on.
// current:  { blocks } the registry to compare the NEW standard against (default: BLOCK_LIST), with `base` the current base CSS source.
// Returns {
//   edits[]   { id, kind, path, prop?, from?, to?, selector?, summary, blockId, keepable, standardChanged, obsolete }
//   carried   the page's existing overrides region, as a tree
//   blockIds  the blocks whose CSS is in the page
//   unbalanced true if the pasted CSS has unmatched braces
// }
export function findLocalEdits(pageCss, baseline, { includeToc = true, currentBase, currentBlocks = BLOCK_LIST } = {}) {
  const { css, overrides } = splitOverrides(pageCss);
  const page = parseCss(css);
  const blockIds = blocksInCss(page, baseline.blocks);
  const used = BLOCK_LIST.filter((b) => blockIds.includes(b.id)).map((b) => baseline.blocks[b.id]);
  const pristine = standardTree(baseline.css, used, includeToc);
  const raw = [];
  diffNode(pristine, page, [], raw);

  // Where possible, say whether the NEW standard also touches the same thing.
  const nowBlocks = currentBlocks.filter((b) => blockIds.includes(b.id));
  const current = currentBase ? standardTree(currentBase, nowBlocks, includeToc) : null;
  const rootToBlock = new Map();
  for (const b of Object.values(baseline.blocks)) if (b.css) rootsOf(b.css).forEach((r) => rootToBlock.set(r, b.id));

  const edits = raw.map((e, n) => {
    const isRule = e.kind === "added-rule" || e.kind === "removed-rule";
    const location = isRule ? [...e.path, e.selector] : e.path;
    // Under #page-container, the first selector below it says which block (if any) the rule belongs to.
    const blockId = location[0] === CONTAINER && location.length > 1 ? rootToBlock.get(location[1]) ?? null : null;
    const holder = current && !isRule ? findNode(current, e.path) : null; // the rule in the NEW standard that holds this property
    const standardChanged = !!holder && e.kind !== "removed-decl" && (holder.decls.get(e.prop) || []).join("\n") !== (e.from || []).join("\n");
    const obsolete = !!current && !isRule && !holder; // the rule no longer exists in the new standard
    return { id: `E${n + 1}`, ...e, summary: describe(e), blockId, keepable: KEEPABLE.has(e.kind), standardChanged, obsolete };
  });
  return { edits, carried: parseCss(overrides), blockIds, unbalanced: page.unbalanced, differences: edits.length, total: countDecls(page) };
}

// The text of the overrides region for these edits plus whatever the page already carried. "" if there is nothing to write.
export function overridesRegion(edits, carried) {
  const tree = { selector: "", decls: new Map(), children: [] };
  for (const e of edits) {
    let node = tree;
    for (const sel of e.path) {
      let next = node.children.find((c) => c.selector === sel);
      if (!next) { next = { selector: sel, decls: new Map(), children: [] }; node.children.push(next); }
      node = next;
    }
    if (e.kind === "added-rule") node.children.push(cloneNode(e.node));
    else node.decls.set(e.prop, [...e.to]);
  }
  const merged = mergeTrees(carried || { selector: "", decls: new Map(), children: [] }, tree);
  const body = serializeCss(merged).trimEnd();
  return body ? `${OVERRIDES_START}\n${body}\n${OVERRIDES_END}` : "";
}
