// Migrating a page built BEFORE version 3.1.0 (flat CSS, --burgundy/--navy tokens, no version
// marker, no theme class). Such a page can't be upgraded by diffing against a stored baseline, so
// the page's own HTML decides what matters: every selector in the old CSS is judged on its own
// against the classes and ids the HTML uses.
//
//   base      no class or id (p, a, :root, body...)     replaced by the new base
//   standard  classes the new standard CSS styles       replaced by the new CSS
//   custom    classes the page uses, nobody else styles carried over (this is the author's design)
//   unused    classes that are not in the HTML          leftovers from other pages, dropped
//
// Custom rules are translated (old tokens become theme tokens), merged (a rule defined twice: the
// last wins), nested under #page-container so they keep their specificity, and written into the
// same PAGE-SPECIFIC OVERRIDES region that upgrades use, so a migrated page is an ordinary page.
// Pure: no DOM, no file access beyond the modules it imports.
import { BLOCK_LIST } from "../blocks/index.js";
import { BUILDER_VERSION } from "./index.js";
import { getPageCSS, getPageJS, BASE_JS_SOURCE } from "../base/index.js";
import { detectBlocks } from "./upgrade.js";
import { parseCss, findNode, serializeCss, stripStyleTags } from "./css-tree.js";
import { OVERRIDES_START, OVERRIDES_END } from "./local-edits.js";

// ---- the old vocabulary -----------------------------------------------------

// Token renames from CHG-3.1.0-01 (and the burgundy tint, which is the Gwella secondary colour).
export const TOKEN_MAP = {
  "--navy": "--primary-colour", "--green": "--primary-colour", "--burgundy": "--primary-colour",
  "--tertiary-colour": "--secondary-colour", "--light-burgundy": "--secondary-colour",
};
const LEGACY_TOKENS = /--(navy|green|burgundy|light-burgundy|tertiary-colour)\b/;
export const THEMES = {
  gwella: { label: "Gwella", primary: "#a3195b" },
  ytydysgu: { label: "Y Tŷ Dysgu", primary: "#325083" },
};

// "gwella" or "ytydysgu" when the old CSS says so unambiguously (its brand colour or token), else null.
export function detectTheme(css) {
  const gwella = /--burgundy\b|#a3195b/i.test(css), ytydysgu = /--navy\b|#325083/i.test(css);
  return gwella && !ytydysgu ? "gwella" : ytydysgu && !gwella ? "ytydysgu" : null;
}

const containerTag = (html) => (html.match(/<div\b[^>]*\bid="page-container"[^>]*>/) || [])[0] || null;

// Does this page need migrating rather than upgrading? { legacy, signals[] }.
export function assessFit({ html = "", css = "" }) {
  const signals = [];
  if (!css.trim()) return { legacy: false, signals };
  const container = findNode(parseCss(css), ["#page-container"]);
  const flat = !container || container.children.length < 5;
  const tokens = LEGACY_TOKENS.test(css);
  if (flat) signals.push("The CSS is a flat stylesheet, not the nested one the current template uses.");
  if (tokens) signals.push("It uses colour tokens from before version 3.1.0 (--burgundy, --navy...).");
  if (!/data-base-version=/.test(html)) signals.push("The page has no version marker.");
  const tag = containerTag(html);
  if (tag && !/\b(gwella|ytydysgu)\b/.test(tag)) signals.push("#page-container has no theme class (gwella or ytydysgu), so the theme colours are undefined.");
  return { legacy: flat || tokens, signals };
}

// ---- flattening and classifying the old CSS ---------------------------------

// Splits a selector list on its top-level commas.
export function splitList(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if ("([".includes(ch)) depth++;
    if (")]".includes(ch)) depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

// Every rule as { items: [selector...], media, decls }, with nesting resolved (so nested 3.0.x CSS works too).
export function flattenRules(root) {
  const out = [];
  const resolve = (parents, item) => (parents.length ? parents.map((p) => (item.includes("&") ? item.replace(/&/g, p) : `${p} ${item}`)) : [item]);
  (function walk(nodes, parents, media) {
    for (const n of nodes) {
      if (n.selector.startsWith("@media")) {
        if (n.decls.size && parents.length) out.push({ items: parents, media: n.selector, decls: n.decls });
        walk(n.children, parents, n.selector);
      } else if (n.selector.startsWith("@")) {
        continue; // @keyframes, @font-face... are not carried automatically
      } else {
        const items = splitList(n.selector).flatMap((i) => resolve(parents, i));
        if (n.decls.size) out.push({ items, media, decls: n.decls });
        walk(n.children, items, media);
      }
    }
  })(root.children, [], null);
  return out;
}

const namesIn = (selector) => [...selector.replace(/\[[^\]]*\]/g, "").replace(/(["']).*?\1/g, "").matchAll(/(?:^|[^\w-])[.#]([a-zA-Z_][\w-]*)/g)]
  .map((m) => m[1]).filter((n) => n !== "page-container");

function namesUsedByHtml(html) {
  const names = new Set();
  for (const m of html.matchAll(/\sclass="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => c && names.add(c));
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) names.add(m[1]);
  return names;
}

function namesStyledBy(css) {
  const names = new Set();
  (function walk(n) { for (const c of n.children) { namesIn(c.selector).forEach((x) => names.add(x)); walk(c); } })(parseCss(css));
  return names;
}

export const kindOf = (item, standard, used) => {
  const names = namesIn(item);
  if (!names.length) return "base";
  if (names.every((n) => standard.has(n))) return "standard";
  return names.every((n) => standard.has(n) || used.has(n)) ? "custom" : "unused";
};

// ---- translating values ----------------------------------------------------

// Old tokens become theme tokens; the theme's own brand colour written out as a literal becomes the token,
// so the page follows its theme. Returns { value, changes[] }.
export function translateValue(value, theme) {
  const changes = [];
  let out = value.replace(/var\(\s*(--[\w-]+)/g, (m, name) => {
    if (!TOKEN_MAP[name]) return m;
    changes.push(`${name} → ${TOKEN_MAP[name]}`);
    return `var(${TOKEN_MAP[name]}`;
  });
  const brand = theme && THEMES[theme]?.primary;
  if (brand) {
    out = out.replace(new RegExp(brand, "gi"), () => { changes.push(`${brand} → var(--primary-colour)`); return "var(--primary-colour)"; });
  }
  return { value: out, changes };
}

// Specificity as one comparable number (ids, then classes/attributes/pseudo-classes, then elements).
export function specificity(selector) {
  const s = selector.replace(/\[[^\]]*\]/g, " [] ").replace(/(["']).*?\1/g, "");
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[\]|(?<!:):(?!:)(?!not\b|is\b|where\b)[\w-]+/g) || []).length;
  const elements = (s.replace(/[.#:][\w-]+/g, " ").match(/(?:^|[\s>+~(])[a-zA-Z][\w-]*/g) || []).length + (s.match(/::[\w-]+/g) || []).length;
  return ids * 10000 + classes * 100 + elements;
}

// ---- the analysis ----------------------------------------------------------

// What the old CSS holds, sorted by what the page's HTML uses. `standardCss` is the new CSS for the page's blocks.
export function analyseLegacyCss(css, html, standardCss) {
  const standard = namesStyledBy(standardCss), used = namesUsedByHtml(html);
  const dropped = { base: [], standard: [], unused: [] };
  const groups = new Map(); // custom class (or id) -> { key, entries: [{ media, selector, decls, spec, order }] }
  const show = (decls) => [...decls].map(([p, v]) => `${p}: ${v.join(" / ")}`).join("; ");
  let order = 0;

  for (const rule of flattenRules(parseCss(css))) {
    for (const item of rule.items) {
      const kind = kindOf(item, standard, used);
      if (kind !== "custom") { dropped[kind].push({ selector: item, media: rule.media, css: show(rule.decls) }); continue; }
      const key = namesIn(item).find((n) => !standard.has(n));
      const group = groups.get(key) || { key, entries: [] };
      group.entries.push({ media: rule.media, selector: item, decls: rule.decls, spec: specificity(item), order: order++ });
      groups.set(key, group);
    }
  }
  return { groups: [...groups.values()], dropped };
}

// ---- writing the carried rules ----------------------------------------------

const stripContainer = (sel) => sel.replace(/^#page-container\s+/, "");

// Entries that end up as the same nested rule are merged. Declarations are applied by original specificity and then
// source order, so the old cascade holds: once everything is nested under #page-container the specificity is equal,
// and "last wins" would otherwise let a weaker rule beat a stronger one.
function mergeEntries(entries) {
  const merged = new Map();
  for (const e of [...entries].sort((a, b) => a.spec - b.spec || a.order - b.order)) {
    const selector = stripContainer(e.selector), key = `${e.media || ""}|${selector}`;
    const rule = merged.get(key) || { media: e.media, selector, decls: new Map(), sources: 0, first: e.order };
    for (const [prop, values] of e.decls) rule.decls.set(prop, values);
    rule.sources++; rule.first = Math.min(rule.first, e.order);
    merged.set(key, rule);
  }
  return [...merged.values()].sort((a, b) => a.first - b.first);
}

// For each group: its translated rules (as text and as nodes), what was translated, merged, or is undefined.
function prepareGroups(groups, theme, definedVars) {
  return groups.map((g) => {
    const notes = [];
    const rules = mergeEntries(g.entries).map((r) => {
      const decls = new Map();
      for (const [prop, values] of r.decls) {
        const translated = values.map((v) => translateValue(v, theme));
        translated.forEach((t) => t.changes.forEach((c) => { if (!notes.includes(c)) notes.push(c); }));
        decls.set(prop, translated.map((t) => t.value));
        for (const v of translated) for (const m of v.value.matchAll(/var\(\s*(--[\w-]+)\s*[,)]/g)) {
          if (!definedVars.has(m[1])) notes.push(`${m[1]} is not defined anywhere, so ${prop} has no effect (${r.selector})`);
        }
      }
      return { media: r.media, selector: r.selector, decls, sources: r.sources, order: r.first };
    });
    const merged = rules.filter((r) => r.sources > 1);
    if (merged.length) notes.push(`${merged.map((r) => r.selector).join(", ")} ${merged.length > 1 ? "are" : "is"} defined more than once in the old CSS; they were combined, with the more specific (then the later) definition winning`);
    const text = rules.map((r) => `${r.media ? `${r.media} ` : ""}${r.selector} { ${[...r.decls].map(([p, v]) => `${p}: ${v.join(" / ")};`).join(" ")} }`).join("\n");
    return { key: g.key, rules, notes: [...new Set(notes)], text };
  });
}

// The kept rules in their ORIGINAL order, because order is part of the cascade: a media rule hoisted above a later
// plain rule for the same selector would lose to it. Only neighbouring rules with the same media query share one block.
function overridesFrom(prepared) {
  const rules = prepared.flatMap((g) => g.rules).sort((a, b) => a.order - b.order);
  const container = { selector: "#page-container", decls: new Map(), children: [] };
  for (const r of rules) {
    const node = { selector: r.selector, decls: r.decls, children: [] };
    if (!r.media) { container.children.push(node); continue; }
    const last = container.children[container.children.length - 1];
    if (last && last.selector === r.media) last.children.push(node);
    else container.children.push({ selector: r.media, decls: new Map(), children: [node] });
  }
  if (!container.children.length) return "";
  return `${OVERRIDES_START}\n${serializeCss({ selector: "", decls: new Map(), children: [container] }).trimEnd()}\n${OVERRIDES_END}`;
}

// ---- the HTML skeleton ------------------------------------------------------

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

// Tags that open and never close, or close the wrong thing. Messages carry line numbers.
export function tagProblems(html) {
  const problems = [], stack = [];
  const line = (i) => html.slice(0, i).split("\n").length;
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => m.replace(/[^\n]/g, " "));
  for (const m of cleaned.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)) {
    const [whole, closing, name, selfClosed] = m, tag = name.toLowerCase();
    if (!closing) { if (!VOID.has(tag) && !selfClosed) stack.push({ tag, at: m.index, text: whole.slice(0, 50) }); continue; }
    if (VOID.has(tag)) { problems.push(`Stray </${tag}> on line ${line(m.index)}: <${tag}> never has a closing tag.`); continue; }
    const idx = stack.map((s) => s.tag).lastIndexOf(tag);
    if (idx === -1) { problems.push(`Stray </${tag}> on line ${line(m.index)} with no matching <${tag}>.`); continue; }
    for (const skipped of stack.splice(idx + 1)) problems.push(`<${skipped.tag}> on line ${line(skipped.at)} is never closed (it was still open at the </${tag}> on line ${line(m.index)}).`);
    stack.pop();
  }
  for (const s of stack) problems.push(`<${s.tag}> on line ${line(s.at)} is never closed.`);
  return problems;
}

// The safe fixes to a legacy page's HTML, each with what changed: { html, changes: [{ id, summary, before, after }] }.
export function migrateHtml(html, { theme = null, version = BUILDER_VERSION } = {}) {
  const changes = [];
  let out = html;
  const tag = containerTag(out);
  if (tag) {
    let next = tag.replace(/\sdata-base-version="[^"]*"/, "");
    if (theme) {
      next = /\sclass="/.test(next)
        ? next.replace(/\sclass="([^"]*)"/, (m, c) => ` class="${c.split(/\s+/).filter((x) => x && x !== "gwella" && x !== "ytydysgu").concat(theme).join(" ")}"`)
        : next.replace(/>$/, ` class="${theme}">`);
    }
    next = next.replace(/>$/, ` data-base-version="${version}">`);
    if (next !== tag) {
      out = out.replace(tag, next);
      changes.push({ id: "container", summary: theme ? `Added the ${THEMES[theme].label} theme class and the version marker to #page-container.` : "Added the version marker to #page-container. The theme class still needs choosing.", before: tag, after: next });
    }
  }
  const icon = '<i class="fa-solid fa-circle-chevron-up" aria-hidden="true"></i>';
  const button = out.match(/<button\b[^>]*\bback-to-top\b[^>]*>\s*<img\b[^>]*>/);
  if (button) {
    const img = button[0].match(/<img\b[^>]*>/)[0];
    out = out.replace(button[0], button[0].replace(img, icon));
    changes.push({ id: "back-to-top", summary: "Swapped the back-to-top image for the standard Font Awesome icon, which the new CSS styles.", before: img.replace(/\s+/g, " "), after: icon });
  }
  return { html: out, changes };
}

// ---- checks on the finished page --------------------------------------------

const IGNORED_CLASSES = /^(fa|fa-[\w-]+|collapse|collapsed|show|accordion(-[\w-]+)?|btn(-[\w-]+)?|row|col(-[\w-]+)?|container|d-[\w-]+|visually-hidden)$/;
const SET_BY_JS = /^--(thinqi-navbar-height|anchor-section-offset|bs-[\w-]+)$/;

// Problems the author should see before copying: classes with no styling, undefined variables, broken tags.
export function lintPage({ html, css }) {
  const finalCss = stripStyleTags(css);
  const styled = namesStyledBy(finalCss);
  const classesUsed = new Set();
  for (const m of html.matchAll(/\sclass="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => c && classesUsed.add(c));
  const unstyledClasses = [...classesUsed].filter((c) => !styled.has(c) && !IGNORED_CLASSES.test(c));
  const defined = new Set([...finalCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const undefinedVars = [...new Set([...finalCss.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1]))].filter((v) => !defined.has(v) && !SET_BY_JS.test(v));
  return { unstyledClasses, undefinedVars, tagProblems: tagProblems(html) };
}

// The standard JS names every selector it looks for; any other selector in the old JS is the author's own.
export function customJs(oldJs) {
  const selectors = (js) => new Set([...js.matchAll(/(?:querySelector(?:All)?|getElementById|closest|matches)\(\s*(["'`])(.*?)\1/g)].map((m) => m[2]));
  const standard = selectors(BASE_JS_SOURCE);
  return [...selectors(oldJs)].filter((s) => !standard.has(s));
}

// ---- the whole migration ------------------------------------------------------

// page: { html, css, js } as pasted. options:
//   theme      "gwella" | "ytydysgu" (default: detected from the old CSS; null if it can't be told)
//   keepGroups ids (custom class names) of the groups to carry; leave out to carry them all
// Returns {
//   fit, theme, themeDetected, blocks (ids), groups[{ key, text, notes, kept }], dropped{ base, standard, unused },
//   html, htmlChanges[], css, js, customJs[], lint, ready (false until a theme is chosen), notes[]
// }
export function buildMigration(page, { theme, keepGroups = null } = {}) {
  const { html = "", css = "", js = "" } = page;
  const detected = detectTheme(css);
  const chosen = theme === undefined ? detected : theme;
  const used = detectBlocks(html);
  const toc = /\sid="table-of-contents"/.test(html);
  const standardCss = getPageCSS(toc, used);

  const { groups, dropped } = analyseLegacyCss(css, html, standardCss);
  const definedVars = new Set([...standardCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const prepared = prepareGroups(groups, chosen, definedVars).map((g) => ({ ...g, kept: !keepGroups || keepGroups.includes(g.key) }));
  const region = overridesFrom(prepared.filter((g) => g.kept));
  const outCss = region ? standardCss.replace(/\n<\/style>$/, `\n\n${region}\n</style>`) : standardCss;

  const migrated = migrateHtml(html, { theme: chosen });
  const notes = [];
  const skipped = (css.match(/@(keyframes|font-face|supports|import)\b/g) || []).length;
  if (skipped) notes.push(`The old CSS has ${skipped} at-rule(s) (@keyframes, @font-face...) that are not carried automatically. Check the page.`);
  const own = js.trim() ? customJs(js) : [];
  if (own.length) notes.push(`Your JS also looks for ${own.join(", ")}, which the standard JS doesn't. Re-add whatever code uses it after pasting.`);

  return {
    fit: assessFit(page),
    theme: chosen,
    themeDetected: detected,
    blocks: used.map((b) => b.id),
    groups: prepared,
    dropped,
    html: migrated.html,
    htmlChanges: migrated.changes,
    css: outCss,
    js: getPageJS(used),
    customJs: own,
    lint: lintPage({ html: migrated.html, css: outCss }),
    ready: !!chosen,
    notes,
  };
}
