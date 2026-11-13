// The guided review of where a migrated page differs from the template. The goal is to conform to the template, so the
// default for every decision is "use the template"; keeping an override is a deliberate act with a stated reason.
//
// buildReview() turns the migration's deviations into a short list of DECISIONS grouped by purpose ("your phone layout",
// "text and headings", one component...), each with what changes in plain words, what the template does instead, and how
// many elements of this page it touches. Pure apart from DOMParser (the browser's, or linkedom's in the tests).
import { BLOCK_LIST } from "../blocks/index.js";
import { parseCss } from "./css-tree.js";
import { namesIn, namesStyledBy } from "./migrate.js";

export const REASONS = [
  ["design", "A deliberate design choice"],
  ["problem", "It fixes a problem (say which)"],
  ["unsure", "Not sure yet"],
];

const PROP_LABELS = {
  "font-weight": "text weight", "font-size": "text size", "font-style": "text style", "line-height": "line spacing", color: "text colour",
  "background-color": "background colour", background: "background", "text-decoration": "underlines", "text-shadow": "text shadow",
  "box-shadow": "shadow", border: "border", "border-radius": "rounded corners", "list-style-type": "list markers", "list-style": "list markers",
  margin: "spacing around", "margin-top": "space above", "margin-bottom": "space below", "margin-left": "space to the left", "margin-right": "space to the right",
  "margin-block": "space above and below", "margin-inline": "space to the sides", padding: "spacing inside", "padding-block": "spacing inside (top and bottom)",
  "padding-left": "spacing inside (left)", "padding-inline": "spacing inside (sides)", display: "how it is laid out", "grid-template-columns": "column layout",
  "flex-direction": "direction of items", gap: "gap between items", order: "order on small screens", width: "width", "max-width": "maximum width", height: "height",
  "align-items": "alignment", "justify-content": "alignment", position: "positioning", right: "distance from the right edge", bottom: "distance from the bottom edge", "scroll-margin-top": "scroll position", cursor: "mouse pointer", "object-fit": "image fitting", "min-height": "minimum height", "min-width": "minimum width",
};
const labelOf = (prop) => PROP_LABELS[prop] || (prop.startsWith("--") ? "a design variable" : prop.replace(/-/g, " "));

// What the selector would match in the page's HTML: the states and pseudo-elements a static page cannot match are removed.
export function cleanSelector(selector) {
  return selector
    .replace(/::?(?:before|after|marker|placeholder|first-line|first-letter|selection)\b/g, "")
    .replace(/:(?:hover|focus|focus-visible|focus-within|active|visited|checked)\b/g, "")
    .replace(/\s+/g, " ").trim().replace(/[>+~]\s*$/, "").trim();
}

// How many distinct elements of the page the selectors match, and which of them could be used (for the preview).
export function affectedElements(html, selectors) {
  let doc;
  try { doc = new DOMParser().parseFromString(html, "text/html"); } catch { return { count: null, selectors: [] }; }
  const elements = new Set(), usable = [];
  for (const raw of selectors) {
    const selector = cleanSelector(raw);
    if (!selector) continue;
    try { doc.querySelectorAll(selector).forEach((e) => elements.add(e)); usable.push(selector); } catch { /* a selector this parser cannot read */ }
  }
  return { count: elements.size, selectors: [...new Set(usable)] };
}

const PHONE = "Your phone and tablet layout", WORKAROUND = "Fixes that use !important", TEXT = "Text and headings", FRAME = "Page header, contents list and layout", OTHER = "Other differences";
const FRAME_NAMES = /^(#header-h1|#header-img|\.header|#breadcrumb-nav\S*|#table-of-contents\S*|\.main-grid|\.content-body|\.content-column|\.standard-container|\.timestamp|\.back-to-top|section|#page-container)$/;
const TEXT_SELECTOR = /^(?:\.content-column\s+)?(?:h[1-6]|p|a|strong|b|em|ul|ol|li|blockquote)(?:[\s:>.#[]|$)/;

const WHY = {
  [PHONE]: "The template already has a phone and tablet layout. Overriding it changes the order and spacing of this page on small screens, so it behaves differently from the others.",
  [WORKAROUND]: "!important is usually added to beat another stylesheet on the site. The template's own list and link styles are set up to cope, so these can often be dropped. Try the template first, and keep one only if the problem comes back.",
  [TEXT]: "The template sets text and headings once for every page. Overriding them makes this page's text look different from the rest of the site.",
  [FRAME]: "This is the page's frame: header, contents list and layout. The template sets it for every page, so overriding it makes this page different from the others.",
  [OTHER]: "The template styles this too, but this page overrides it.",
};
const whyComponent = (label) => `The current ${label} block already defines this. Overriding it means this page's ${label} won't match the same block on other pages.`;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const importantOnly = (g) => g.rules.every((r) => [...r.decls.values()].every((vs) => vs.every((v) => /!important\s*$/.test(v))));

// migration: the result of buildMigration(). html: the page's HTML. Returns the steps, in the order they are asked.
// A step: { id, title, why, keys[] (the migration's group keys it covers), lines[], headline, elements, selectors[], width }.
export function buildReview(migration, html) {
  const deviations = migration.groups.filter((g) => g.kind === "deviation");
  const used = BLOCK_LIST.filter((b) => migration.blocks.includes(b.id) && b.css);
  const blockOf = new Map(); // ".data-icon-card" -> "Icon-toggle"
  for (const b of used) for (const name of namesStyledBy(b.css)) if (!blockOf.has(name)) blockOf.set(name, b.label);

  const containerVars = deviations.find((g) => g.key === "differs:#page-container");
  const categorise = (g) => {
    const rules = g.rules;
    if (rules.every((r) => /max-width/.test(r.media || ""))) return { category: PHONE, why: WHY[PHONE] };
    if (importantOnly(g)) return { category: WORKAROUND, why: WHY[WORKAROUND] };
    const selector = (rules.find((r) => !r.media) || rules[0]).selector;
    const component = namesIn(selector).map((n) => blockOf.get(n)).find(Boolean);
    if (component) return { category: `${component} component`, why: whyComponent(component) };
    const bare = selector.replace(/^#page-container\s*/, "");
    if (TEXT_SELECTOR.test(bare)) return { category: TEXT, why: WHY[TEXT] };
    if (FRAME_NAMES.test(namesIn(selector)[0] || bare) || FRAME_NAMES.test(bare)) return { category: FRAME, why: WHY[FRAME] };
    return { category: OTHER, why: WHY[OTHER] };
  };

  const steps = new Map();
  const put = (g, c) => {
    const step = steps.get(c.category) || { id: slug(c.category), title: c.category, why: c.why, keys: [], lines: [], selectors: [], category: c.category, phone: true };
    step.keys.push(g.key);
    for (const r of g.rules) {
      for (const [prop, values] of r.decls) {
        step.lines.push({ where: r.selector || "#page-container", media: r.media || null, prop, label: labelOf(prop), mine: values.join(" / "), template: r.standard.get(prop) ?? null });
      }
      if (r.selector) step.selectors.push(r.selector);
      if (!/max-width/.test(r.media || "")) step.phone = false;
    }
    steps.set(c.category, step);
  };
  for (const g of deviations) {
    if (g === containerVars) continue;
    put(g, categorise(g));
  }
  // A custom property the page defines (--heading-4) belongs with whatever uses it.
  if (containerVars) {
    const mention = (name) => deviations.find((g) => g !== containerVars && g.rules.some((r) => [...r.decls.values()].some((vs) => vs.some((v) => v.includes(`var(${name}`)))));
    const home = containerVars.rules.flatMap((r) => [...r.decls.keys()]).map(mention).find(Boolean);
    put(containerVars, home ? categorise(home) : { category: OTHER, why: WHY[OTHER] });
  }

  return [...steps.values()].map((step) => {
    const { count } = affectedElements(html, step.selectors);
    // The preview shows the most-affected selector first, not whichever comes first in the page (a breadcrumb is a poor
    // example of "bold text"). A phone-layout decision is about ORDER, which shows at the top of the page.
    const selectors = [...new Set(step.selectors)].map((sel) => ({ sel, n: affectedElements(html, [sel]).count ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.sel);
    const things = [...new Set(step.lines.map((l) => l.label))];
    const headline = `Changes ${things.slice(0, 3).join(", ")}${things.length > 3 ? ` and ${things.length - 3} more` : ""}`;
    return { id: step.id, title: step.title, why: step.why, keys: step.keys, lines: step.lines, headline, elements: count, selectors, width: step.phone ? "phone" : "desktop", scroll: step.phone ? "top" : "first" };
  }).sort((a, b) => (b.elements ?? -1) - (a.elements ?? -1) || a.title.localeCompare(b.title));
}

// The reason line written into the CSS: "Text and headings: A deliberate design choice, bold is the house style".
export function ledgerLine(step, { reason = "unsure", note = "" } = {}) {
  const label = (REASONS.find(([id]) => id === reason) || REASONS[2])[1];
  return `${step.title}: ${label}${note.trim() ? `, ${note.trim()}` : ""}`;
}
