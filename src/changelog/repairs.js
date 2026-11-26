// Suggested repairs for unbalanced tags. Pure: text in, data out. Nothing is applied unless the caller asks.
//
// The validator's scanner says where the markup went wrong. This turns those findings into EDITS the author can accept or not:
// an element that is never closed gets its end tag, a stray end tag is deleted, `</br>` becomes `<br />`, a heading closed at the
// wrong level is closed at the right one. The author's HTML is never touched by suggesting.
//
// Where a missing end tag goes is decided by INDENTATION: the tag is put before the next line that is indented no deeper than the
// line the element was opened on (the way the author laid the page out is the best evidence of what they meant). If there is no such
// line it goes before the end tag that ended the element, or at the end of the page. After each round the page is scanned again, so
// the stray end tags that were only consequences of an element left open disappear, and the ones that remain are deleted. The
// result says whether the page then scans clean (`resolved`).
//
//   suggestRepairs(html) -> { repairs[], resolved, remaining }
//   repair  { id, action: "insert" | "delete" | "replace", at, length, text, line, tag, why, order }
//           `at` and `length` are in the ORIGINAL text (length 0 for an insert); `text` is what goes there.
//   applyRepairs(html, repairs, accept = null) -> the repaired html (accept: ids to apply; null applies all)
import { scanHtml } from "../validate/html-scan.js";

const lineStarts = (text) => { const s = [0]; for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) s.push(i + 1); return s; };
const offsetOf = (starts, line, column) => starts[line - 1] + column - 1;
const indentOf = (text, starts, line) => { const from = starts[line - 1]; const m = text.slice(from, starts[line] ?? text.length).match(/^[ \t]*/); return m[0]; };
const width = (indent) => indent.replace(/\t/g, "    ").length;
const ERRORS = new Set(["html/unclosed-tag", "html/stray-close-tag", "html/misnested-tag", "html/void-close-tag"]);

// The two orders to try. A page with an element left open AND an end tag that closes something too early can be fixed either way
// round; the result with fewer edits is the one that says less about what the author wrote, so that one is offered.
export function suggestRepairs(html) {
  const a = repairWith(html, "roots-first"), b = repairWith(html, "early-first");
  const pick = [a, b].filter((r) => r.resolved).sort((x, y) => x.repairs.length - y.repairs.length)[0];
  return pick || (a.remaining <= b.remaining ? a : b);
}

function repairWith(html, strategy) {
  // `origin[i]` = where character i of the working text came from in the original (-1: inserted by a repair).
  let text = html, origin = Array.from({ length: html.length + 1 }, (_, i) => i);
  const repairs = [];
  const toOriginal = (p) => origin[p];
  const splice = (at, len, ins) => { text = text.slice(0, at) + ins + text.slice(at + len); origin = [...origin.slice(0, at), ...Array(ins.length).fill(-1), ...origin.slice(at + len)]; };

  for (let round = 0; round < 6; round++) {
    const scan = scanHtml(text), starts = lineStarts(text);
    const found = scan.findings.filter((f) => ERRORS.has(f.id));
    if (!found.length) break;
    // Root causes first (an element left open, a bad `</br>`); strays are only dealt with when no root is left.
    const roots = found.filter((f) => f.id === "html/unclosed-tag" || f.id === "html/void-close-tag" || (f.id === "html/stray-close-tag" && /the heading opened on line \d+ is a <h\d>/.test(f.message)));
    // No root left: an element shut early by an end tag that belongs to something further out (a stray </div> that closes
    // .content-body inside a section). Deleting the early end tag fixes the element and its own end tag stops being a stray.
    const early = found.filter((f) => f.id === "html/misnested-tag");
    const strays = found.filter((f) => f.id === "html/stray-close-tag");
    const todo = (strategy === "early-first" ? [early, roots, strays] : [roots, early, strays]).find((l) => l.length) || [];
    if (!todo.length) break;
    const edits = [];
    const handledHeadings = new Set(todo.filter((f) => /is a <h\d>/.test(f.message)).map((f) => +f.message.match(/opened on line (\d+)/)?.[1]));
    for (const f of todo) {
      const at = offsetOf(starts, f.line, f.column);
      if (f.id === "html/void-close-tag") {
        const m = text.slice(at).match(/^<\/(\w+)\s*>/);
        if (m) edits.push({ at, len: m[0].length, ins: `<${m[1].toLowerCase()} />`, action: "replace", tag: m[1].toLowerCase(), line: f.line, why: `</${m[1].toLowerCase()}> is not allowed: <${m[1].toLowerCase()}> never has a closing tag. A browser treats it as a <${m[1].toLowerCase()}>, so it is written as one.` });
      } else if (f.id === "html/stray-close-tag" && /is a <h\d>/.test(f.message)) {
        const want = f.message.match(/is a <(h\d)>/)[1], m = text.slice(at).match(/^<\/(h\d)\s*>/);
        // The heading that should have been closed is reported as unclosed too; closing it here makes that one go away.
        if (m) edits.push({ at, len: m[0].length, ins: `</${want}>`, action: "replace", tag: m[1], line: f.line, why: `</${m[1]}> closes a <${want}>: it was meant to be </${want}>.` });
      } else if (f.id === "html/misnested-tag") {
        const shut = f.related.find((r) => /shuts it early/.test(r.note));
        if (!shut) continue;
        const sAt = offsetOf(starts, shut.line, shut.column), m = text.slice(sAt).match(/^<\/(\w+)\s*>/);
        if (m) edits.push({ at: sAt, len: m[0].length, ins: "", action: "delete", tag: m[1].toLowerCase(), line: shut.line, why: `</${m[1].toLowerCase()}> on line ${shut.line} ends the <${f.message.match(/^<(\w+)>/)[1]}> that started on line ${f.line} before its own end tag; the one further down is the real end of the outer element.` });
      } else if (f.id === "html/stray-close-tag") {
        const m = text.slice(at).match(/^<\/(\w+)\s*>/);
        if (m) edits.push({ at, len: m[0].length, ins: "", action: "delete", tag: m[1].toLowerCase(), line: f.line, why: f.message.replace(/\s*\(the.*$/, "") });
      } else { // unclosed
        const el = scan.elements.find((e) => e.start === at);
        if (!el) continue;
        if (/^h\d$/.test(el.tag) && handledHeadings.has(scan.loc.at(el.start).line)) continue; // the mismatched end tag is changed instead
        const open = scan.loc.at(el.start).line, indent = indentOf(text, starts, open), w = width(indent);
        let where = null, deeper = null;
        for (let l = scan.loc.at(el.openEnd).line + 1; l <= starts.length; l++) {
          const from = starts[l - 1], line = text.slice(from, starts[l] ?? text.length);
          if (!line.trim()) continue;
          const lw = width(line.match(/^[ \t]*/)[0]);
          // Contents indented deeper than the opening tag (a <ul> and its <li>s): it ends at the next line that is no deeper than
          // the opening tag. Contents at the SAME indent as the opening tag (a <div> whose paragraphs are not indented under it):
          // they belong inside, so it ends at the first line that is shallower.
          if (deeper === null) deeper = lw > w;
          if (deeper ? lw <= w : lw < w) { where = from; break; }
        }
        if (where === null) {
          const ender = f.related.find((r) => /ends it/.test(r.note));
          where = ender ? starts[ender.line - 1] : text.length;
        }
        const nl = where > 0 && text[where - 1] !== "\n" ? "\n" : "";
        edits.push({ at: where, len: 0, ins: `${nl}${indent}</${el.tag}>${where < text.length ? "\n" : ""}`, action: "insert", tag: el.tag, line: open, openedAt: el.start, why: `<${el.tag}> on line ${open} is never closed: its end tag goes before the next line indented no deeper than it.` });
      }
    }
    if (!edits.length) break;
    // Apply from the end of the text so earlier positions stay true; at one position the element opened LATER closes first.
    edits.sort((a, b) => b.at - a.at || (a.openedAt ?? 0) - (b.openedAt ?? 0));
    const seen = new Set();
    for (const e of edits) {
      const key = `${e.at}:${e.action}:${e.tag}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const orig = toOriginal(e.at);
      splice(e.at, e.len, e.ins);
      repairs.push({ action: e.action, at: orig === -1 ? null : orig, length: e.len, text: e.ins, line: e.line, tag: e.tag, why: e.why, openedAt: e.openedAt == null ? null : toOriginal(e.openedAt) ?? null, order: repairs.length });
    }
  }
  // Insertions made on top of earlier insertions have no original position; they sit just before the original character that follows.
  for (const r of repairs) if (r.at === null) { r.at = 0; }
  const after = scanHtml(text).findings.filter((f) => ERRORS.has(f.id));
  const out = repairs.map((r, i) => ({ id: `R${i + 1}`, ...r })).sort((a, b) => a.line - b.line || a.order - b.order);
  return { repairs: out.map((r, i) => ({ ...r, id: `R${i + 1}` })), resolved: after.length === 0, remaining: after.length, repaired: text };
}

// The repaired text. `accept`: ids to apply (null: all). Applied to the original, so a repair that was not accepted leaves its
// part of the page exactly as written. Accepting only some repairs can leave others' consequences in place.
export function applyRepairs(html, repairs, accept = null) {
  const chosen = repairs.filter((r) => !accept || accept.includes(r.id));
  const all = chosen.length === repairs.length;
  // Applying every repair is exactly what suggestRepairs already computed.
  if (all) return suggestRepairs(html).repaired;
  let out = html;
  for (const r of [...chosen].sort((a, b) => b.at - a.at || (a.openedAt ?? 0) - (b.openedAt ?? 0))) out = out.slice(0, r.at) + r.text + out.slice(r.at + r.length);
  return out;
}
