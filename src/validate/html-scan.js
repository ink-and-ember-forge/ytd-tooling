// A tolerant HTML scanner. Pure: text in, elements and findings out, no DOM.
//
// A spec-compliant parser silently repairs broken markup, so it can't say what was wrong. This one doesn't repair anything: it
// follows the same recovery a browser would (so it knows where an element really ends) and REPORTS where the markup needed it.
// It knows which end tags HTML lets you leave out (</li>, </p>, </td>...), so it still knows where those elements end; but leaving
// one out is REPORTED (html/missing-end-tag, a warning): it is valid HTML, yet it hides where an element stops.
//
// scanHtml(html) -> { elements[], findings[], loc }
//   element  { tag, start, openEnd, end (null: never closed), closeStart (explicit close tag only), openTag, attrs[], parent, children[] }
//   attr     { name, value, start, end, valueStart, valueEnd }
import { locator, makeFinding, relatedAt } from "./locate.js";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
// End tags HTML allows you to omit.
const OPTIONAL_END = new Set(["p", "li", "dt", "dd", "tr", "td", "th", "thead", "tbody", "tfoot", "option", "optgroup", "colgroup", "caption"]);
// Start tags that end an open <p> (so a <ul> inside a <p> closes the <p>).
const CLOSES_P = new Set(["address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "menu", "nav", "ol", "p", "pre", "section", "table", "ul"]);
const HEADING = /^h[1-6]$/;
const blank = (s) => s.replace(/[^\n]/g, " ");
const WS = /\s/;

// The attributes of one tag. `text` is everything between the tag name and the closing `>`; `base` is its offset in the page.
function parseAttrs(text, base) {
  const attrs = [], issues = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    while (i < n && WS.test(text[i])) i++;
    if (i >= n) break;
    if (text[i] === "/") { i++; continue; }
    const nameStart = i;
    while (i < n && !WS.test(text[i]) && text[i] !== "=" && text[i] !== "/") i++;
    const name = text.slice(nameStart, i);
    const attr = { name: name.toLowerCase(), value: null, start: base + nameStart, end: base + i, valueStart: null, valueEnd: null };
    if (/["']/.test(name)) issues.push({ kind: "stray-quote", at: base + nameStart, name });
    let j = i;
    while (j < n && WS.test(text[j])) j++;
    if (text[j] === "=") {
      j++;
      while (j < n && WS.test(text[j])) j++;
      const q = text[j];
      if (q === '"' || q === "'") {
        const close = text.indexOf(q, j + 1);
        if (close === -1) {
          issues.push({ kind: "unclosed-quote", at: base + j, name });
          attr.value = text.slice(j + 1); attr.valueStart = base + j + 1; attr.valueEnd = base + n; i = n;
        } else {
          attr.value = text.slice(j + 1, close); attr.valueStart = base + j + 1; attr.valueEnd = base + close; i = close + 1;
          if (i < n && !WS.test(text[i]) && text[i] !== "/") issues.push({ kind: "spacing", at: base + i, name });
        }
      } else {
        const s = j;
        while (j < n && !WS.test(text[j])) j++;
        attr.value = text.slice(s, j); attr.valueStart = base + s; attr.valueEnd = base + j; i = j;
      }
      attr.end = base + i;
    }
    attrs.push(attr);
  }
  return { attrs, issues };
}

export function scanHtml(html) {
  const loc = locator(html);
  const findings = [];
  const add = (id, severity, start, end, message, extra) => findings.push(makeFinding(loc, "html", id, severity, start, end, message, extra));

  // Comments and the CONTENT of <script>/<style> are not markup: blank them out (same length, so every offset stays true).
  let masked = html.replace(/<!--[\s\S]*?(?:-->|$)/g, (m, off) => {
    if (!m.endsWith("-->")) add("html/unclosed-comment", "error", off, off + 4, "This comment is never closed, so everything after it is hidden.", { why: "The browser treats the rest of the page as part of the comment." });
    return blank(m);
  });
  masked = masked.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (m, open, _t, body, close) => open + blank(body) + close);

  const all = [], stack = [], unclosed = [], omitted = [];
  const top = () => stack[stack.length - 1];
  let lastImplicitP = null;
  // An element whose end tag was left out: it ends here (`by`: the tag that ended it, or null at the end of the page).
  const endImplicitly = (el, at, by = null) => { el.end = at; el.implicit = true; omitted.push({ el, by }); };

  for (const m of masked.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g)) {
    const [whole, closing, name, attrText, selfClosed] = m, tag = name.toLowerCase(), start = m.index;

    if (!closing) {
      // An open tag that ends something still open, without an end tag: <li> after <li>, a block after a <p>, <td> after <td>...
      const by = { tag, start };
      if (CLOSES_P.has(tag) && top()?.tag === "p") { const p = stack.pop(); endImplicitly(p, start, by); if (tag !== "p") lastImplicitP = { p, by }; }
      if (tag === "li" && top()?.tag === "li") endImplicitly(stack.pop(), start, by);
      if ((tag === "dt" || tag === "dd") && /^d[td]$/.test(top()?.tag || "")) endImplicitly(stack.pop(), start, by);
      if (tag === "td" || tag === "th") while (/^t[dh]$/.test(top()?.tag || "")) endImplicitly(stack.pop(), start, by);
      if (tag === "tr") while (/^(td|th|tr)$/.test(top()?.tag || "")) endImplicitly(stack.pop(), start, by);
      if (/^t(head|body|foot)$/.test(tag)) while (/^(td|th|tr|thead|tbody|tfoot)$/.test(top()?.tag || "")) endImplicitly(stack.pop(), start, by);
      if (tag === "option" && top()?.tag === "option") endImplicitly(stack.pop(), start, by);

      const attrBase = start + 1 + tag.length;
      const { attrs, issues } = parseAttrs(attrText, attrBase);
      const el = { tag, start, openEnd: start + whole.length, end: null, openTag: html.slice(start, start + whole.length), attrs, parent: top() || null, children: [] };
      if (el.parent) el.parent.children.push(el);
      all.push(el);
      if (VOID.has(tag) || selfClosed) el.end = el.openEnd;
      else stack.push(el);

      const seen = new Map();
      for (const a of attrs) {
        if (seen.has(a.name)) add("html/duplicate-attribute", "error", a.start, a.end, `The attribute ${a.name} is written twice on this <${tag}>.`, { why: "The browser ignores the second one, so whatever it says has no effect.", related: [relatedAt(loc, "html", seen.get(a.name).start, `the first ${a.name}`)] });
        else seen.set(a.name, a);
      }
      for (const is of issues) {
        if (is.kind === "spacing") add("html/attribute-spacing", "warning", is.at, is.at + 1, `There is no space after the value of ${is.name} on this <${tag}>.`, { why: "Browsers cope, but it is invalid and easy to break when edited." });
        else add("html/unclosed-quote", "error", is.at, is.at + 1, is.kind === "unclosed-quote" ? `A quote opened here on this <${tag}> is never closed.` : `A stray quote sits where an attribute name should be on this <${tag}>.`, { why: "An earlier attribute value probably lost its closing quote, so it swallows the attributes after it." });
      }
      continue;
    }

    // A close tag.
    if (VOID.has(tag)) {
      add("html/void-close-tag", "error", start, start + whole.length, `</${tag}> is not allowed: <${tag}> never has a closing tag.`, { why: tag === "br" ? "Browsers read </br> as <br>, so it adds a stray line break." : "The closing tag is ignored or misread." });
      continue;
    }
    const idx = stack.map((s) => s.tag).lastIndexOf(tag);
    if (idx === -1) {
      let message = `</${tag}> has no matching <${tag}>.`, related = [], why = "The browser ignores it, but it usually means a tag above was closed too early or never opened.";
      if (HEADING.test(tag)) {
        const open = [...stack].reverse().find((s) => HEADING.test(s.tag));
        if (open) { message = `</${tag}> has no matching <${tag}>: the heading opened on line ${loc.at(open.start).line} is a <${open.tag}>.`; related = [relatedAt(loc, "html", open.start, `the <${open.tag}> it should close`)]; why = `Did you mean </${open.tag}>? Until it is closed, everything after the heading is inside it.`; }
      } else if (tag === "p" && lastImplicitP) {
        message = `</p> has no matching <p>: the <p> on line ${loc.at(lastImplicitP.p.start).line} was closed early by the <${lastImplicitP.by.tag}> on line ${loc.at(lastImplicitP.by.start).line}.`;
        related = [relatedAt(loc, "html", lastImplicitP.p.start, "the <p> that was closed early"), relatedAt(loc, "html", lastImplicitP.by.start, `the <${lastImplicitP.by.tag}> that closed it`)];
        why = `A <${lastImplicitP.by.tag}> can't sit inside a <p>, so the browser ends the <p> before it. This </p> then closes nothing, and the browser adds an empty <p>.`;
      }
      add("html/stray-close-tag", "error", start, start + whole.length, message, { why, related });
      continue;
    }
    for (const skipped of stack.splice(idx + 1)) {
      if (OPTIONAL_END.has(skipped.tag)) endImplicitly(skipped, start, { tag, start, closing: true });
      else unclosed.push({ el: skipped, closer: { tag, start } });
    }
    const el = stack.pop();
    el.end = start + whole.length;
    el.closeStart = start;
  }
  for (const el of stack) {
    if (OPTIONAL_END.has(el.tag)) endImplicitly(el, html.length);
    else unclosed.push({ el, closer: null });
  }

  for (const { el, by } of omitted.sort((a, b) => a.el.start - b.el.start)) {
    const ender = by ? `the ${by.closing ? "</" : "<"}${by.tag}> on line ${loc.at(by.start).line}` : "the end of the page";
    add("html/missing-end-tag", "warning", el.start, el.openEnd, `<${el.tag}> has no end tag.`, {
      why: `HTML allows leaving out </${el.tag}>, but without it nothing marks where the element stops: here it is ended by ${ender}. An explicit end tag makes the structure clear and safe to edit.`,
      related: by ? [relatedAt(loc, "html", by.start, `${by.closing ? "the closing" : "the opening"} <${by.tag}> that ends it`)] : [],
      data: { tag: el.tag, endedBy: by?.tag || null },
    });
  }

  for (const { el, closer } of unclosed.sort((a, b) => a.el.start - b.el.start)) {
    const until = closer ? closer.start : html.length;
    const inside = all.filter((e) => e.start >= el.openEnd && e.start < until);
    const span = inside.length ? `lines ${loc.at(el.openEnd).line}–${loc.at(until).line}` : null;
    add("html/unclosed-tag", "error", el.start, el.openEnd, `<${el.tag}> is never closed.`, {
      why: closer
        ? `It stays open until the </${closer.tag}> on line ${loc.at(closer.start).line}, so ${inside.length ? `everything in between (${inside.length} element${inside.length === 1 ? "" : "s"}, ${span}) ends up inside it` : "nothing is inside it, but it is left open"}, not after it.`
        : `It is still open at the end of the page, so everything after it ends up inside it.`,
      related: closer ? [relatedAt(loc, "html", closer.start, `the </${closer.tag}> that ends it`)] : [],
      data: { tag: el.tag, elementsInside: inside.length, closedBy: closer?.tag || null },
    });
  }

  return { elements: all, findings, loc };
}

export const attrOf = (el, name) => el.attrs.find((a) => a.name === name) || null;
