// A small, tolerant parser for the nested CSS this template uses (rules inside
// rules, @media inside rules, "&" selectors), plus a serializer. It exists so two
// stylesheets can be compared by *meaning* (which rule, which property, which
// value) rather than by line, so reformatting, comments and whitespace never show
// up as differences. Pure; not a general CSS parser (no @import/@font-face handling
// beyond keeping such statements as they are).
//
// A node is { selector, decls: Map<prop, string[]>, children: node[] }.
// The root node has selector "". A property can repeat (fallbacks), hence string[].

const collapse = (s) => s.replace(/\s+/g, " ").trim();

// Applies `fn` to the parts of `text` that are not inside a quoted string or a url(...), which must stay exactly as written.
function outsideLiterals(text, fn) {
  let out = "", plain = "", quote = null, depth = 0;
  const flush = () => { out += fn(plain); plain = ""; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { out += ch; if (ch === "\\") out += text[++i] ?? ""; else if (ch === quote) quote = null; continue; }
    if (depth) { out += ch; if (ch === "(") depth++; else if (ch === ")") depth--; continue; }
    if (ch === '"' || ch === "'") { flush(); quote = ch; out += ch; continue; }
    if (/^url\($/i.test((plain + ch).slice(-4))) { flush(); depth = 1; out += ch; continue; }
    plain += ch;
  }
  flush();
  return out;
}

function normaliseSelector(s) {
  const out = outsideLiterals(collapse(s), (t) => t.replace(/\s*,\s*/g, ", "));
  return out.startsWith("@") ? out.replace(/\s*:\s*/g, ": ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")") : out;
}

const normaliseValue = (v) => outsideLiterals(collapse(v), (t) => t.replace(/\s*,\s*/g, ", ")).replace(/\s*!\s*important/i, " !important");

function addDecl(node, text) {
  if (text.startsWith("@")) { // a statement such as @import url(...): kept as written
    node.decls.set("@statement", [...(node.decls.get("@statement") || []), collapse(text)]);
    return;
  }
  const colon = text.indexOf(":");
  if (colon < 1) return; // not a declaration; ignore rather than guess
  let prop = text.slice(0, colon).trim();
  if (!prop.startsWith("--")) prop = prop.toLowerCase();
  node.decls.set(prop, [...(node.decls.get(prop) || []), normaliseValue(text.slice(colon + 1))]);
}

// Removes /* comments */ while leaving string contents alone.
function stripComments(text) {
  let out = "", quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { out += ch; if (ch === "\\") out += text[++i] ?? ""; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; continue; }
    if (ch === "/" && text[i + 1] === "*") { const end = text.indexOf("*/", i + 2); i = end === -1 ? text.length : end + 1; continue; }
    out += ch;
  }
  return out;
}

export const stripStyleTags = (text) => text.replace(/^\s*<style[^>]*>/i, "").replace(/<\/style>\s*$/i, "");

export function parseCss(text) {
  const src = stripComments(stripStyleTags(text));
  let i = 0;
  let unbalanced = false;

  function readBlock(nested) {
    const node = { selector: "", decls: new Map(), children: [] };
    while (i < src.length) {
      const start = i;
      let depth = 0, quote = null;
      for (; i < src.length; i++) {
        const ch = src[i];
        if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; continue; }
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (depth <= 0 && (ch === ";" || ch === "{" || ch === "}")) break;
      }
      const prelude = src.slice(start, i).trim();
      const ch = src[i];
      if (ch === "{") {
        i++;
        const child = readBlock(true);
        child.selector = normaliseSelector(prelude);
        node.children.push(child);
      } else {
        if (prelude) addDecl(node, prelude);
        if (ch === "}") { i++; if (nested) return node; unbalanced = true; } // a stray } at the top level
        else if (ch === ";") i++;
      }
    }
    if (nested) unbalanced = true; // ran out of text inside a block
    return node;
  }

  const root = readBlock(false);
  root.unbalanced = unbalanced;
  return root;
}

// Rules can legitimately repeat a selector under one parent; the nth repeat gets a #n suffix so each has a unique key.
export function keyedChildren(node) {
  const seen = new Map(), out = new Map();
  for (const c of node.children) {
    const n = (seen.get(c.selector) || 0) + 1;
    seen.set(c.selector, n);
    out.set(n === 1 ? c.selector : `${c.selector} #${n}`, c);
  }
  return out;
}

export function findNode(root, path) {
  let node = root;
  for (const sel of path) {
    node = node.children.find((c) => c.selector === sel);
    if (!node) return null;
  }
  return node;
}

export function serializeCss(node, indent = "") {
  let out = "";
  for (const [prop, values] of node.decls) {
    for (const v of values) out += prop === "@statement" ? `${indent}${v};\n` : `${indent}${prop}: ${v};\n`;
  }
  node.children.forEach((c, n) => {
    if (n > 0 || node.decls.size) out += "\n";
    out += `${indent}${c.selector} {\n${serializeCss(c, indent + "  ")}${indent}}\n`;
  });
  return out;
}

export const countDecls = (node) => [...node.decls.values()].reduce((n, v) => n + v.length, 0) + node.children.reduce((n, c) => n + countDecls(c), 0);

// b's declarations win over a's for the same rule and property; rules only in b are added. Returns a new tree.
export function mergeTrees(a, b) {
  const out = { selector: a.selector, decls: new Map(a.decls), children: a.children.map((c) => cloneNode(c)) };
  for (const [prop, values] of b.decls) out.decls.set(prop, [...values]);
  for (const bc of b.children) {
    const match = out.children.find((c) => c.selector === bc.selector);
    if (match) out.children[out.children.indexOf(match)] = mergeTrees(match, bc);
    else out.children.push(cloneNode(bc));
  }
  return out;
}

export function cloneNode(n) {
  return { selector: n.selector, decls: new Map([...n.decls].map(([k, v]) => [k, [...v]])), children: n.children.map(cloneNode) };
}
