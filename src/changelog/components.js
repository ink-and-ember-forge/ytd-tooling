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

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const CONTAINERS = new Set(["div", "section", "article", "aside", "nav", "header", "footer", "figure", "ul", "ol", "dl", "form", "details", "fieldset"]);
// An image or embed with a dropped class would be left at its natural size, unstyled: it is a component too.
const MEDIA = new Set(["img", "iframe", "video", "picture", "svg"]);
// Taking out an element that holds the page's own skeleton would take the page with it.
const SKELETON = /\bid="(?:page-container|table-of-contents|header-h1|breadcrumb-nav)"|\bclass="[^"]*\b(?:content-column|content-body|main-grid)\b/;

const classesOf = (openTag) => ((openTag.match(/\sclass\s*=\s*"([^"]*)"/) || [])[1] || "").split(/\s+/).filter(Boolean);
const idOf = (openTag) => (openTag.match(/\sid\s*=\s*"([^"]*)"/) || [])[1] || null;
const lineOf = (html, index) => html.slice(0, index).split("\n").length;

// Every element in the HTML: { tag, start, openEnd, end (null when it never closes), openTag }. Same recovery as migrate.js's
// tagProblems: a close tag shuts the nearest matching open tag, and anything left open above it is unclosed.
export function elementsOf(html) {
  const all = [], stack = [];
  const masked = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => " ".repeat(m.length));
  for (const m of masked.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)) {
    const [whole, closing, name, selfClosed] = m, tag = name.toLowerCase();
    if (!closing) {
      const el = { tag, start: m.index, openEnd: m.index + whole.length, end: null, openTag: html.slice(m.index, m.index + whole.length) };
      all.push(el);
      if (!VOID.has(tag) && !selfClosed) stack.push(el);
      else el.end = el.openEnd;
      continue;
    }
    const idx = stack.map((s) => s.tag).lastIndexOf(tag);
    if (idx === -1) continue;
    stack[idx].end = m.index + whole.length;
    stack[idx].closeStart = m.index;
    stack.length = idx; // the elements above it were never closed: their `end` stays null
  }
  return all;
}

// names: class names (without the dot) the page's own components are known by. Returns
//   { html, removed[], stripped[], unresolved[] }
//   removed     [{ name, classes[], tag, id, line, original }]  elements replaced by a placeholder; `classes` are all of the
//               dropped classes the removed markup used (nested components go with it)
//   stripped    [{ name, tag, count }]                          classes taken off elements that stay
//   unresolved  [{ name, tag, line, why }]                      containers that couldn't be removed safely (class stripped instead)
export function retireComponents(html, names) {
  const wanted = new Set(names);
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
    if (SKELETON.test(html.slice(el.start, el.end))) { classEdits.push({ el, classes }); unresolved.push({ name: classes[0], tag: el.tag, line: lineOf(html, el.start), why: "it holds the page's own structure, so it was not removed" }); continue; }
    removals.push({ el, classes });
    taken = el.end;
  }

  const inside = (el) => removals.find((r) => el.start >= r.el.start && el.end <= r.el.end);
  const removed = removals.map(({ el, classes }) => {
    const original = html.slice(el.start, el.end);
    const nested = [...new Set(candidates.filter((c) => c !== el && inside(c) === removals.find((r) => r.el === el)).flatMap(carries))];
    return { name: classes[0], classes: [...new Set([...classes, ...nested])], tag: el.tag, id: idOf(el.openTag), line: lineOf(html, el.start), original, el };
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
