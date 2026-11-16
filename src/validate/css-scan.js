// A position-tracking CSS scanner that copes with nesting and with broken braces. Pure.
//
// scanCss(css) -> { root, findings[], text, loc }
//   node  { kind: "rule" | "at" | "root", prelude, name (at-rules), start, end, openAt, children[], decls[], parent }
//   decl  { prop, value, start, end }
// `text` is the CSS with comments and <style> tags blanked out (same length, so every offset is true).
import { locator, makeFinding, relatedAt } from "./locate.js";

const blank = (s) => s.replace(/[^\n]/g, " ");

export function scanCss(source) {
  const loc = locator(source);
  const findings = [];
  const add = (id, severity, start, end, message, extra) => findings.push(makeFinding(loc, "css", id, severity, start, end, message, extra));

  const text = source
    .replace(/\/\*[\s\S]*?(?:\*\/|$)/g, (m, off) => {
      if (!m.endsWith("*/")) add("css/unclosed-comment", "error", off, off + 2, "This comment is never closed, so everything after it is ignored.", { why: "The browser treats the rest of the stylesheet as part of the comment." });
      return blank(m);
    })
    .replace(/<\/?style\b[^>]*>/gi, blank);

  const root = { kind: "root", prelude: "", start: 0, end: text.length, openAt: 0, children: [], decls: [], parent: null };
  const stack = [root];
  let segStart = 0, quote = null, paren = 0;
  const cur = () => stack[stack.length - 1];

  // The text since the last ; { or } is a declaration (or, at the top level, stray text).
  const flush = (end) => {
    const raw = text.slice(segStart, end), trimmed = raw.trim();
    if (!trimmed) return;
    const start = segStart + raw.indexOf(trimmed[0]);
    const node = cur();
    if (node.kind === "root") {
      if (trimmed.startsWith("@")) return; // @import, @charset
      add("css/orphan-declaration", "error", start, start + trimmed.length, `"${trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed}" is not inside any rule.`, { why: "Declarations outside a rule are ignored. A { or } above is probably missing or misplaced." });
      return;
    }
    const colon = trimmed.indexOf(":");
    if (colon > 0) node.decls.push({ prop: trimmed.slice(0, colon).trim(), value: trimmed.slice(colon + 1).trim(), start, end: start + trimmed.length });
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote || ch === "\n") quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "(") { paren++; continue; }
    if (ch === ")") { paren = Math.max(0, paren - 1); continue; }
    if (paren) continue;
    if (ch === "{") {
      const raw = text.slice(segStart, i), prelude = raw.trim();
      const start = segStart + (prelude ? raw.indexOf(prelude[0]) : 0);
      const node = { kind: prelude.startsWith("@") ? "at" : "rule", prelude, name: prelude.startsWith("@") ? prelude.split(/[\s(]/)[0].toLowerCase() : null, start, end: null, openAt: i, children: [], decls: [], parent: cur() };
      cur().children.push(node);
      stack.push(node);
      segStart = i + 1;
    } else if (ch === "}") {
      flush(i);
      if (stack.length === 1) {
        findings.push({ pending: "stray-brace", at: i });
      } else {
        stack.pop().end = i + 1;
      }
      segStart = i + 1;
    } else if (ch === ";") {
      flush(i);
      segStart = i + 1;
    }
  }
  flush(text.length);

  // A } with nothing to close. The real fault is usually EARLIER: a rule closed too soon. A top-level rule whose closing brace is indented
  // (as if it were nested) and which is followed by more rules is the likely culprit, so point at it.
  const strays = findings.filter((f) => f.pending);
  findings.splice(0, findings.length, ...findings.filter((f) => !f.pending));
  const suspect = root.children.find((n, idx) => {
    if (n.end === null || idx === root.children.length - 1) return false;
    const brace = n.end - 1, lineStart = text.lastIndexOf("\n", brace) + 1;
    return /^[ \t]+$/.test(text.slice(lineStart, brace)) && loc.at(n.end).line > loc.at(n.start).line;
  });
  for (const s of strays) {
    add("css/unbalanced-brace", "error", s.at, s.at + 1, "This } closes nothing: the stylesheet has one more } than {.", {
      why: suspect
        ? `Somewhere above, a rule was closed too early. Everything after that point is no longer inside the rule it was written in: if it was meant to be scoped (to #page-container, say) it now applies to the whole site.`
        : "A rule above was probably closed twice, or a { is missing.",
      related: suspect ? [relatedAt(loc, "css", suspect.end - 1, `this } is indented as if it were nested, but it closes the top-level rule "${suspect.prelude.length > 40 ? suspect.prelude.slice(0, 37) + "…" : suspect.prelude}" while more rules follow: it may be closing it too early`)] : [],
    });
  }
  for (const node of stack.slice(1)) {
    add("css/unclosed-brace", "error", node.openAt, node.openAt + 1, `The { of "${node.prelude.length > 50 ? node.prelude.slice(0, 47) + "…" : node.prelude}" is never closed.`, { why: "Everything after it is read as part of this rule, so later rules don't apply as written." });
  }
  return { root, findings, text, loc };
}

// Top-level comma split (not inside parentheses or brackets).
export function splitList(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if ("([".includes(ch)) depth++;
    if (")]".includes(ch)) depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}
