// Removing a page's own components from its HTML. Pure: strings in, strings out, no DOM.
//
// A migrated page follows the template. A class the page uses that the template has no equivalent of is a COMPONENT the template
// can't style, so it is not carried: the author rebuilds it however they choose (a block, new HTML, a new block) and pastes the
// result over a placeholder comment left where it was. The decision is the author's, not the tool's.
//
//   container   a block-level element with elements inside it (a div, section, ul...), or an image / embed   replaced by the placeholder
//   decoration  anything else (a link, a paragraph, an icon font glyph)                loses the class, and stays: removing it
//                                                                                        would take the author's words with it
//
// Only CLASSES are removed. An id names a place on the page (a contents link points at it), so it is never taken out; the
// placeholder says so when the element had one. The HTML is edited as text, never re-serialised, so everything else is exactly as
// the author wrote it. Where the tags are too broken to tell where an element ends, nothing is removed and the class is stripped
// instead, and the element is reported as `unresolved`.

import { scanHtml } from "../validate/html-scan.js";

const CONTAINERS = new Set(["div", "section", "article", "aside", "nav", "header", "footer", "figure", "ul", "ol", "dl", "form", "details", "fieldset"]);
// An image or embed with a dropped class would be left at its natural size, unstyled: it is a component too.
const MEDIA = new Set(["img", "iframe", "video", "picture", "svg"]);
// Taking out an element that holds the page's own skeleton would take the page with it.
const SKELETON = /\bid="(?:page-container|table-of-contents|header-h1|breadcrumb-nav)"|\bclass="[^"]*\b(?:content-column|content-body|main-grid)\b/;

const classesOf = (openTag) => ((openTag.match(/\sclass\s*=\s*"([^"]*)"/) || [])[1] || "").split(/\s+/).filter(Boolean);
const idOf = (openTag) => (openTag.match(/\sid\s*=\s*"([^"]*)"/) || [])[1] || null;
const lineOf = (html, index) => html.slice(0, index).split("\n").length;

// Every element in the HTML: { tag, start, openEnd, end (null when it never closes), closeStart, openTag, ... }. The tolerant scanner
// the validator uses (src/validate/html-scan.js), so what counts as "closed" is decided in one place.
export const elementsOf = (html) => scanHtml(html).elements;

// names: class names (without the dot) the page's own components are known by. Returns
//   { html, removed[], stripped[], unresolved[] }
//   removed     [{ name, classes[], tag, id, line, original }]  elements replaced by a placeholder; `classes` are all of the
//               dropped classes the removed markup used (nested components go with it)
//   stripped    [{ name, tag, count }]                          classes taken off elements that stay
//   unresolved  [{ name, tag, line, why }]                      containers that couldn't be removed safely (class stripped instead)
//
// options (all optional):
//   keep          class names of components that are KEPT. An element that holds one is never removed (that would take the kept
//                 component with it): its own class is stripped instead and it is reported as `unresolved`.
//   dispositions  { name: "strip" | "remove" }. "strip" takes only the class off, whatever the element holds (use it for an element
//                 that holds words, links or images). The default is "remove" for containers and media.
// A media element inside a link or button is never replaced (a comment inside a link leaves an empty link): its class is stripped.
// Every removed item also carries `holds` ({ words, links, images }), so a caller can see what a removal would take with it.
export function retireComponents(html, names, { keep = [], dispositions = {} } = {}) {
  const wanted = new Set(names);
  const kept = new Set(keep);
  if (!wanted.size) return { html, removed: [], stripped: [], unresolved: [] };
  const els = elementsOf(html);
  const carries = (el) => classesOf(el.openTag).filter((c) => wanted.has(c));
  const candidates = els.filter((el) => carries(el).length);

  const removals = [], classEdits = [], unresolved = [];
  let taken = -1; // end of the last removal: anything that starts inside it goes with it
  for (const el of candidates.sort((a, b) => a.start - b.start)) {
    if (el.start < taken) continue;
    const classes = carries(el), media = MEDIA.has(el.tag);
    if (!CONTAINERS.has(el.tag) && !media) { classEdits.push({ el, classes }); continue; }
    if (el.end === null) { classEdits.push({ el, classes }); unresolved.push({ name: classes[0], tag: el.tag, line: lineOf(html, el.start), why: "its closing tag can't be found (the tags around it are broken), so it was not removed" }); continue; }
    const inner = html.slice(el.openEnd, el.closeStart ?? el.end);
    if (!media && !/<[a-zA-Z]/.test(inner)) { classEdits.push({ el, classes }); continue; } // nothing inside: a styled box, not a component
    if (dispositions[classes[0]] === "strip" || classes.some((c) => dispositions[c] === "strip")) { classEdits.push({ el, classes }); continue; }
    if (media && el.parent && /^(a|button)$/.test(el.parent.tag)) { classEdits.push({ el, classes }); unresolved.push({ name: classes[0], tag: el.tag, line: lineOf(html, el.start), why: `it sits inside a <${el.parent.tag}>, so a placeholder would leave it empty; only its class was removed` }); continue; }
    if (kept.size && els.some((o) => o !== el && o.start >= el.openEnd && o.start < el.end && classesOf(o.openTag).some((c) => kept.has(c)))) { classEdits.push({ el, classes }); unresolved.push({ name: classes[0], tag: el.tag, line: lineOf(html, el.start), why: "it holds a component that is being kept, so it was not removed; only its class was taken off" }); continue; }
    if (SKELETON.test(html.slice(el.start, el.end))) { classEdits.push({ el, classes }); unresolved.push({ name: classes[0], tag: el.tag, line: lineOf(html, el.start), why: "it holds the page's own structure, so it was not removed" }); continue; }
    removals.push({ el, classes });
    taken = el.end;
  }

  const inside = (el) => removals.find((r) => el.start >= r.el.start && el.end <= r.el.end);
  const removed = removals.map(({ el, classes }) => {
    const original = html.slice(el.start, el.end);
    const nested = [...new Set(candidates.filter((c) => c !== el && inside(c) === removals.find((r) => r.el === el)).flatMap(carries))];
    const inner = original.replace(/<!--[\s\S]*?-->/g, "");
    const holds = { words: inner.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "").replace(/<[^>]*>/g, " ").split(/\s+/).filter((w) => /\w/.test(w)).length, links: (inner.match(/<a\b/gi) || []).length, images: (inner.match(/<img\b/gi) || []).length };
    return { name: classes[0], classes: [...new Set([...classes, ...nested])], tag: el.tag, id: idOf(el.openTag), line: lineOf(html, el.start), original, holds, el };
  });

  const edits = [];
  for (const r of removed) {
    const label = r.classes.map((c) => `.${c}`).join(", ");
    const keep = r.id ? ` It had id="${r.id}": give the rebuilt component the same id so links to it keep working.` : "";
    edits.push({ start: r.el.start, end: r.el.end, text: `<!-- REBUILD: ${label} ${r.classes.length > 1 ? "have" : "has"} no equivalent in the template, so ${r.classes.length > 1 ? "they were" : "it was"} removed. Rebuild it however you choose and paste it here.${keep} -->` });
  }
  const stripCounts = new Map();
  for (const { el, classes } of classEdits) {
    if (inside(el)) continue;
    const left = classesOf(el.openTag).filter((c) => !wanted.has(c));
    const next = left.length
      ? el.openTag.replace(/(\sclass\s*=\s*)"[^"]*"/, `$1"${left.join(" ")}"`)
      : el.openTag.replace(/\sclass\s*=\s*"[^"]*"/, "");
    edits.push({ start: el.start, end: el.openEnd, text: next });
    classes.forEach((c) => stripCounts.set(`${c}|${el.tag}`, (stripCounts.get(`${c}|${el.tag}`) || 0) + 1));
  }

  let out = html;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  const stripped = [...stripCounts].map(([k, count]) => { const [name, tag] = k.split("|"); return { name, tag, count }; });
  return { html: out, removed: removed.map(({ el, ...r }) => r), stripped, unresolved };
}

// Class names to take off wherever they appear, or rename, without touching anything else. Pure string edits on the opening tags.
//   strip   [names]           the class is removed; an empty class attribute goes with it
//   rename  { from: to }      the class keeps its place in the list under its new name
// Returns { html, stripped: [{ name, tag, count }], renamed: [{ from, to, tag, count }] }.
export function rewriteClasses(html, { strip = [], rename = {} } = {}) {
  const drop = new Set(strip), edits = [], counts = new Map();
  if (!drop.size && !Object.keys(rename).length) return { html, stripped: [], renamed: [] };
  for (const el of elementsOf(html)) {
    const classes = classesOf(el.openTag);
    if (!classes.some((c) => drop.has(c) || c in rename)) continue;
    const next = classes.filter((c) => !drop.has(c)).map((c) => rename[c] ?? c);
    const text = next.length ? el.openTag.replace(/(\sclass\s*=\s*)"[^"]*"/, `$1"${next.join(" ")}"`) : el.openTag.replace(/\sclass\s*=\s*"[^"]*"/, "");
    edits.push({ start: el.start, end: el.openEnd, text });
    for (const c of classes) if (drop.has(c) || c in rename) counts.set(`${c}|${el.tag}`, (counts.get(`${c}|${el.tag}`) || 0) + 1);
  }
  let out = html;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  const rows = [...counts].map(([k, count]) => { const [name, tag] = k.split("|"); return { name, tag, count }; });
  return { html: out, stripped: rows.filter((r) => drop.has(r.name)), renamed: rows.filter((r) => r.name in rename).map((r) => ({ from: r.name, to: rename[r.name], tag: r.tag, count: r.count })) };
}

// Older Icon toggle markup (a plain <div id="data-icons-grid">, tiles with an onclick="openAccordion(...)" but no .data-icon-trigger)
// has none of the classes the current CSS styles. Adding the two classes is mechanical and changes nothing else.
// Returns { html, changes: [{ id, summary }] }.
export function upgradeIconToggleHtml(html) {
  const changes = [];
  let out = html;
  const edits = [];
  let grids = 0, tiles = 0;
  for (const el of elementsOf(out)) {
    const cls = classesOf(el.openTag);
    const add = (name) => ({ start: el.start, end: el.openEnd, text: cls.length
      ? el.openTag.replace(/(\sclass\s*=\s*)"[^"]*"/, `$1"${[...cls, name].join(" ")}"`)
      : el.openTag.replace(/^<(\w+)/, `<$1 class="${name}"`) });
    if (el.tag === "div" && /^data-icons-grid/.test(idOf(el.openTag) || "") && !cls.includes("data-icons-grid")) { edits.push(add("data-icons-grid")); grids++; }
    else if (/\sonclick\s*=\s*["']\s*openAccordion\(/.test(el.openTag) && !cls.includes("data-icon-trigger")) { edits.push(add("data-icon-trigger")); tiles++; }
  }
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  if (grids) changes.push({ id: "icon-toggle-grid", summary: `Added the class data-icons-grid to ${grids} icon grid(s), which the current Icon toggle CSS styles.` });
  if (tiles) changes.push({ id: "icon-toggle-tiles", summary: `Added the class data-icon-trigger to ${tiles} icon tile(s), which the current Icon toggle CSS styles.` });
  return { html: out, changes };
}
