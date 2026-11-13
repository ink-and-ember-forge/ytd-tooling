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

// Which elements of the page each property of a group is set on, per media query: "|list-style-type" -> Set(elements).
function elementsByProperty(doc, group) {
  const byKey = new Map();
  for (const rule of group.rules) {
    let found;
    try { found = doc.querySelectorAll(cleanSelector(rule.selector)); } catch { continue; }
    for (const prop of rule.decls.keys()) {
      const key = `${rule.media || ""}|${prop}`, set = byKey.get(key) || new Set();
      found.forEach((e) => set.add(e));
      byKey.set(key, set);
    }
  }
  return byKey;
}

// Rules that set the same property on the same element in the same media query depend on each other: one is often there to
// undo what the other does (a list rule that numbers the breadcrumb, and the fix that un-numbers it). Decided separately they
// could leave the page in a state nobody chose, so they are decided together. Returns the linked sets and the links found.
function linkGroups(doc, groups) {
  const parent = new Map(groups.map((g) => [g, g]));
  const find = (g) => (parent.get(g) === g ? g : (parent.set(g, find(parent.get(g))), parent.get(g)));
  const links = [];
  if (doc) {
    const sets = new Map(groups.map((g) => [g, elementsByProperty(doc, g)]));
    for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
      for (const [key, mine] of sets.get(groups[a])) {
        const other = sets.get(groups[b]).get(key);
        const shared = other ? [...mine].filter((e) => other.has(e)).length : 0;
        if (shared) { links.push({ a: groups[a], b: groups[b], prop: key.split("|")[1], media: key.split("|")[0] || null, shared }); parent.set(find(groups[a]), find(groups[b])); }
      }
    }
  }
  const sets = new Map();
  for (const g of groups) sets.set(find(g), [...(sets.get(find(g)) || []), g]);
  return { sets: [...sets.values()], links };
}

const nameOf = (group) => group.key.replace(/^differs:/, "");

// migration: the result of buildMigration(). html: the page's HTML. Returns the steps, in the order they are asked.
// A step: { id, title, why, keys[] (the migration's group keys it covers), lines[], headline, elements, selectors[], width,
//           scroll, linked } where `linked` lists why rules were decided together (empty for an ordinary decision).
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

  const steps = new Map(), stepOf = new Map();
  const add = (step, g) => {
    step.keys.push(g.key);
    stepOf.set(g, step);
    for (const r of g.rules) {
      for (const [prop, values] of r.decls) {
        step.lines.push({ where: r.selector || "#page-container", media: r.media || null, prop, label: labelOf(prop), mine: values.join(" / "), template: r.standard.get(prop) ?? null });
      }
      if (r.selector) step.selectors.push(r.selector);
      if (!/max-width/.test(r.media || "")) step.phone = false;
    }
  };
  const stepFor = (id, title, why, extra = {}) => {
    if (!steps.has(id)) steps.set(id, { id, title, why, keys: [], lines: [], selectors: [], phone: true, linked: [], ...extra });
    return steps.get(id);
  };

  const doc = (() => { try { return new DOMParser().parseFromString(html, "text/html"); } catch { return null; } })();
  const { sets, links } = linkGroups(doc, deviations.filter((g) => g !== containerVars));
  for (const set of sets) {
    if (set.length === 1) { const c = categorise(set[0]); add(stepFor(slug(c.category), c.category, c.why), set[0]); continue; }
    const mine = links.filter((l) => set.includes(l.a));
    // One sentence per pair of rules, naming every property they share.
    const pairs = new Map();
    for (const l of mine) {
      const key = `${nameOf(l.a)}|${nameOf(l.b)}`, pair = pairs.get(key) || { a: nameOf(l.a), b: nameOf(l.b), labels: [], shared: 0 };
      if (!pair.labels.includes(labelOf(l.prop))) pair.labels.push(labelOf(l.prop));
      pair.shared = Math.max(pair.shared, l.shared);
      pairs.set(key, pair);
    }
    const sentences = [...pairs.values()].map((x) => `${x.a} and ${x.b} both set ${x.labels.join(" and ")} on ${x.shared === 1 ? "the same element" : `${x.shared} of the same elements`}`);
    const categories = [...new Set(set.map((g) => categorise(g).category))];
    if (categories.length === 1) {
      // Already decided together: no need for a decision of its own, only a note that they belong together.
      const c = categorise(set[0]), step = stepFor(slug(c.category), c.category, c.why);
      step.linked.push(...sentences);
      set.forEach((g) => add(step, g));
      continue;
    }
    // Rules that work together but would land in different decisions become one decision, named after what they have in common.
    const labels = [...new Set(mine.map((l) => labelOf(l.prop)))];
    const step = stepFor(`linked-${slug(nameOf(set[0]))}`, `Rules that work together: ${labels.join(" and ")}`,
      `These rules depend on each other: ${sentences.join("; ")}. One is often there to undo what the other does, so keeping one without the other could leave the page in a state you didn't choose. They are decided together.`);
    step.linked.push(...sentences);
    set.forEach((g) => add(step, g));
  }
  // A custom property the page defines (--heading-4) belongs with whatever uses it.
  if (containerVars) {
    const mention = (name) => deviations.find((g) => g !== containerVars && g.rules.some((r) => [...r.decls.values()].some((vs) => vs.some((v) => v.includes(`var(${name}`)))));
    const home = containerVars.rules.flatMap((r) => [...r.decls.keys()]).map(mention).find(Boolean);
    const step = home ? stepOf.get(home) : stepFor(slug(OTHER), OTHER, WHY[OTHER]);
    add(step, containerVars);
  }

  return [...steps.values()].map((step) => {
    const { count } = affectedElements(html, step.selectors);
    // The preview shows the most-affected selector first, not whichever comes first in the page (a breadcrumb is a poor
    // example of "bold text"). A phone-layout decision is about ORDER, which shows at the top of the page.
    const selectors = [...new Set(step.selectors)].map((sel) => ({ sel, n: affectedElements(html, [sel]).count ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.sel);
    const things = [...new Set(step.lines.map((l) => l.label))];
    const headline = `Changes ${things.slice(0, 3).join(", ")}${things.length > 3 ? ` and ${things.length - 3} more` : ""}`;
    return { id: step.id, title: step.title, why: step.why, keys: step.keys, lines: step.lines, headline, elements: count, selectors, width: step.phone ? "phone" : "desktop", scroll: step.phone ? "top" : "first", linked: step.linked };
  }).sort((a, b) => (b.elements ?? -1) - (a.elements ?? -1) || a.title.localeCompare(b.title));
}

// The reason line written into the CSS: "Text and headings: A deliberate design choice, bold is the house style".
export function ledgerLine(step, { reason = "unsure", note = "" } = {}) {
  const label = (REASONS.find(([id]) => id === reason) || REASONS[2])[1];
  return `${step.title}: ${label}${note.trim() ? `, ${note.trim()}` : ""}`;
}

// The guarantee the linking exists to give: no two decisions set the same property on the same element in the same media
// query. Returns the pairs that do (empty when the decisions are independent). Used by the tests.
export function crossDecisionLinks(steps, html) {
  let doc;
  try { doc = new DOMParser().parseFromString(html, "text/html"); } catch { return []; }
  const perStep = steps.map((s) => {
    const byKey = new Map();
    for (const l of s.lines) {
      if (!l.where || l.where === "#page-container") continue;
      let found;
      try { found = doc.querySelectorAll(cleanSelector(l.where)); } catch { continue; }
      const key = `${l.media || ""}|${l.prop}`, set = byKey.get(key) || new Set();
      found.forEach((e) => set.add(e));
      byKey.set(key, set);
    }
    return byKey;
  });
  const clashes = [];
  for (let a = 0; a < steps.length; a++) for (let b = a + 1; b < steps.length; b++) {
    for (const [key, mine] of perStep[a]) {
      const other = perStep[b].get(key);
      if (other && [...mine].some((e) => other.has(e))) clashes.push({ a: steps[a].title, b: steps[b].title, key });
    }
  }
  return clashes;
}
