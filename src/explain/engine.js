// The Explain tab's brain: given a block's generated HTML and its explain.json,
// work out which part each element belongs to, and what to say about an attribute.
// Needs DOMParser (the browser has it; tests use linkedom).
import { loadText } from "../lib/assets.js";
import { mapHTML } from "../lib/code-map.js";

export const GLOSSARY = JSON.parse(await loadText(new URL("./glossary.json", import.meta.url)));

// Plain-English note for an attribute: the block's own note, else the shared glossary.
export function attributeNote(name, explain) {
  const own = explain && explain.attributes && explain.attributes[name];
  if (own) return own;
  if (GLOSSARY[name]) return GLOSSARY[name];
  if (name.startsWith("aria-")) return GLOSSARY["aria-*"];
  if (name.startsWith("data-bs-")) return GLOSSARY["data-bs-*"];
  return null;
}

const matches = (el, selector) => { try { return el.matches(selector); } catch (e) { return false; } };

// -> { map, partOf } where partOf[i] is the index in explain.parts of element i (-1 if none),
//    or null if the HTML could not be lined up with the DOM (then the tab says so rather than guess).
export function analyse(html, explain) {
  const map = mapHTML(html);
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const els = Array.from(doc.getElementById("root").querySelectorAll("*"));
  if (els.length !== map.elements.length) return null;
  const partOf = els.map((el) => explain.parts.findIndex((p) => matches(el, p.selector)));
  return { map, partOf };
}

// Problems with an explain.json (used by the tests, and handy when authoring one).
export function validateExplain(explain) {
  const errors = [];
  if (!explain || !Array.isArray(explain.parts) || explain.parts.length === 0) return ["explain.json needs a non-empty \"parts\" array"];
  const doc = new DOMParser().parseFromString("<div></div>", "text/html");
  explain.parts.forEach((p, i) => {
    const where = `parts[${i}] (${p.label || p.selector || "?"})`;
    for (const key of ["selector", "label", "what"]) if (typeof p[key] !== "string" || !p[key].trim()) errors.push(`${where}: missing "${key}"`);
    for (const key of ["how", "deep"]) if (key in p && (typeof p[key] !== "string" || !p[key].trim())) errors.push(`${where}: "${key}" must be text`);
    try { doc.querySelector(p.selector); } catch (e) { errors.push(`${where}: "${p.selector}" is not a valid selector`); }
  });
  for (const [name, note] of Object.entries(explain.attributes || {})) {
    if (typeof note !== "string" || !note.trim()) errors.push(`attributes.${name}: needs text`);
  }
  return errors;
}
