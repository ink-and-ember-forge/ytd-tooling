// Maps a block's generated HTML to its structure, for the Explain tab and X-ray.
//
// It splits the HTML string into tokens (tags, text, comments) WITHOUT changing a
// character, so the code can be shown exactly as it will be pasted, and it numbers
// every element in document order. That number is the glue: element N here is also
// the Nth element inside the preview's #page-container, so a line of code and the
// thing it draws can find each other.
//
// Pure (no DOM, no browser APIs), so it runs in Node tests against every block.
// It only needs to cope with the well-formed HTML our generators emit.

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const TOKEN_RE = /<!--[\s\S]*?-->|<\/[a-zA-Z][^>]*>|<[a-zA-Z][^>]*>|[^<]+|</g;

// Splits one opening tag into pieces that concatenate back to exactly the original text:
// { kind: "punct" | "tag" | "ws" | "attr" | "eq" | "val", text, name? }
function splitOpenTag(text) {
  const pieces = [];
  let i = 0;
  const push = (kind, t, extra) => { pieces.push({ kind, text: t, ...extra }); i += t.length; };
  push("punct", "<");
  push("tag", text.slice(i).match(/^[^\s/>]+/)[0]);
  let current = null; // the attribute a following value belongs to
  while (i < text.length) {
    const rest = text.slice(i);
    let m;
    if ((m = rest.match(/^\s+/))) push("ws", m[0]);
    else if (rest.startsWith("/>")) push("punct", "/>");
    else if (rest[0] === ">") push("punct", ">");
    else if (rest[0] === "=") push("eq", "=");
    else if ((m = rest.match(/^"[^"]*"|^'[^']*'|^[^\s"'=<>`]+/)) && current && pieces[pieces.length - 1].kind === "eq") {
      push("val", m[0], { name: current });
    } else if ((m = rest.match(/^[^\s"'=<>/]+/))) {
      current = m[0];
      push("attr", m[0], { name: m[0] });
    } else push("punct", rest[0]); // anything odd: keep the characters, never lose any
  }
  return pieces;
}

const unquote = (v) => v.replace(/^(["'])(.*)\1$/s, "$2");

// -> { tokens, elements }
//   tokens:   [{ type: "open"|"close"|"text"|"comment", text, el?, pieces? }]   (concatenate to the input)
//   elements: [{ index, tag, attrs, open, close, parent, depth }]  open/close are token positions
export function mapHTML(html) {
  const tokens = [];
  const elements = [];
  const stack = [];

  for (const m of html.matchAll(TOKEN_RE)) {
    const text = m[0];
    if (text.startsWith("<!--")) tokens.push({ type: "comment", text });
    else if (text.startsWith("</")) {
      const tag = text.slice(2).match(/^[a-zA-Z][^\s>]*/)[0].toLowerCase();
      // close the nearest matching open element (tolerates sloppy nesting)
      let k = stack.length - 1;
      while (k >= 0 && elements[stack[k]].tag !== tag) k--;
      const token = { type: "close", text, tag };
      if (k >= 0) {
        const idx = stack[k];
        stack.length = k;
        elements[idx].close = tokens.length;
        token.el = idx;
      }
      tokens.push(token);
    } else if (/^<[a-zA-Z]/.test(text)) {
      const pieces = splitOpenTag(text);
      const tag = pieces[1].text.toLowerCase();
      const attrs = {};
      pieces.forEach((p) => { if (p.kind === "attr") attrs[p.name] = ""; if (p.kind === "val") attrs[p.name] = unquote(p.text); });
      const index = elements.length;
      const el = { index, tag, attrs, open: tokens.length, close: null, parent: stack.length ? stack[stack.length - 1] : -1, depth: stack.length };
      elements.push(el);
      tokens.push({ type: "open", text, el: index, pieces });
      if (!VOID.has(tag) && !text.endsWith("/>")) stack.push(index);
    } else tokens.push({ type: "text", text });
  }
  return { tokens, elements };
}

// The token positions an element covers (its opening tag through its closing tag).
export function rangeOf(map, index) {
  const el = map.elements[index];
  return [el.open, el.close ?? el.open];
}

// Every element whose attribute value matches `value` (ignoring a leading #, so that
// data-bs-target="#x" and id="x" count as the same thing).
export function sameValue(map, value) {
  const norm = (v) => v.replace(/^#/, "");
  const target = norm(value);
  const hits = [];
  map.tokens.forEach((t, ti) => {
    if (t.type !== "open") return;
    t.pieces.forEach((p, pi) => { if (p.kind === "val" && norm(unquote(p.text)) === target) hits.push({ token: ti, piece: pi }); });
  });
  return hits;
}
