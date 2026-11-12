// Small string helpers shared by the block generators.

export function escapeHTML(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slugify(text) {
  const slug = (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "item";
}

/* Guarantees a unique, readable id even when two items share a title —
   this is exactly the failure mode found in the legacy corpus (the same
   id reused across dozens of unrelated headings). Collisions silently
   get a "-2", "-3" ... suffix rather than colliding. */
export function uniqueSlug(base, usedSlugs) {
  let slug = base;
  let n = 2;
  while (usedSlugs.has(slug)) {
    slug = `${base}-${n}`;
    n++;
  }
  usedSlugs.add(slug);
  return slug;
}

export function randomId(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8);
}

export function indentLines(html, spaces) {
  const pad = " ".repeat(spaces);
  return html.split("\n").map(line => line.trim() ? pad + line : line).join("\n");
}
