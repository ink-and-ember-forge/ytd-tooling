// CSS rules that look at the HTML (and JS) as well as the CSS. Pure, apart from the DOMParser used to match selectors (the browser's,
// or linkedom's in the tests): a selector engine is not worth rewriting, and matching against the DOM the browser would build is the
// right truth for "does this rule ever apply?".
import { makeFinding } from "./locate.js";
import { splitList } from "./css-scan.js";
import { attrOf } from "./html-scan.js";

// What a static copy of the page can't show: states, and pseudo-elements (which are not elements at all).
const PSEUDO_ELEMENT = /::?(?:before|after|first-line|first-letter)\b|::[\w-]+(?:\([^)]*\))?/g;
// Longer names first: `focus` before `focus-visible` would strip only `:focus` and leave `-visible` behind.
const DYNAMIC_PSEUDO = /:(?:focus-visible|focus-within|focus|hover|active|visited|target-within|target|user-invalid|user-valid|fullscreen|-webkit-[\w-]+|-moz-[\w-]+)(?![\w-])(?:\([^)]*\))?/g;
// Classes Bootstrap's own JS adds and removes at runtime: absent from the HTML, present on the page.
const STATE_CLASSES = new Set(["show", "collapse", "collapsing", "collapsed", "active", "fade", "open", "disabled", "selected"]);
// Custom properties set by the host page or the base JS, never declared by the author.
const HOST_VARIABLES = /^--(?:bs-|thinqi-|anchor-section-)/;
const SKIPPED_AT_RULES = /^@(?:-webkit-)?(?:keyframes|font-face|page|property|counter-style|font-feature-values)$/i;

const truncate = (s, n = 70) => { const t = s.replace(/\s+/g, " "); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const countRules = (node) => node.children.reduce((n, c) => n + (c.kind === "rule" ? 1 : 0) + countRules(c), 0);

// Does this selector match anything the page can show? true = used (or can't be told, which counts as used).
function usedBy(selector, ctx) {
  let s = selector.replace(PSEUDO_ELEMENT, "").replace(DYNAMIC_PSEUDO, "").trim();
  if (/[>+~]$/.test(s)) s += "*";
  if (!s || s === "*") return true;
  if (/^(?:html|body|:root|:host)(?![\w-])/i.test(s)) return true; // the page this is pasted into, not this page
  // A rule on the ABSENCE of a state class (.accordion-button:not(.collapsed)) applies once a script has changed the state.
  if ([...s.matchAll(/:not\(([^)]*)\)/g)].some((m) => [...m[1].matchAll(/\.([\w-]+)/g)].some((c) => STATE_CLASSES.has(c[1])))) return true;
  let found;
  try { found = ctx.doc.querySelector(s); } catch { return true; } // a selector the engine can't read: don't guess
  if (found) return true;
  // Something the HTML doesn't have, that a script or Bootstrap may add later.
  const missing = [...s.matchAll(/[.#]([\w-]+)/g)].map((m) => m[1]).filter((t) => !ctx.names.has(t));
  return missing.some((t) => STATE_CLASSES.has(t) || ctx.jsWords.has(t));
}

// scan: scanCss(). htmlScan: scanHtml(). Returns findings.
export function cssRules(scan, { html, js }, htmlScan) {
  const findings = [];
  const add = (id, severity, start, end, message, extra) => findings.push(makeFinding(scan.loc, "css", id, severity, start, end, message, extra));

  // ---- selectors that match nothing ----
  const total = countRules(scan.root);
  if (!html.trim()) {
    if (total) add("css/unused-skipped", "info", 0, 0, "No HTML was given, so unused CSS can't be checked.");
  } else if (typeof DOMParser === "undefined") {
    if (total) add("css/unused-skipped", "info", 0, 0, "Unused CSS can't be checked here: this environment has no HTML parser.");
  } else if (total) {
    const names = new Set();
    for (const el of htmlScan.elements) {
      for (const c of (attrOf(el, "class")?.value || "").split(/\s+/)) if (c) names.add(c);
      const id = attrOf(el, "id")?.value?.trim();
      if (id) names.add(id);
    }
    const ctx = { doc: new DOMParser().parseFromString(html, "text/html"), names, jsWords: new Set(js.match(/[\w-]+/g) || []) };
    const unusedItem = new Map();
    const used = (sel) => { if (!unusedItem.has(sel)) unusedItem.set(sel, usedBy(sel, ctx)); return unusedItem.get(sel); };
    let wholeRules = 0, wholeBytes = 0;

    (function visit(node, parents, atChain) {
      for (const child of node.children) {
        if (child.kind === "at") {
          if (!SKIPPED_AT_RULES.test(child.name || "")) visit(child, parents, [...atChain, child.prelude]);
          continue;
        }
        if (child.kind !== "rule") continue;
        const sources = splitList(child.prelude).map((s) => ({
          source: s,
          full: parents.length ? parents.map((p) => (s.includes("&") ? s.replace(/&/g, p) : `${p} ${s}`)) : [s],
        }));
        const dead = sources.filter((s) => !s.full.some(used));
        const where = atChain.length ? ` (inside ${truncate(atChain.join(" "), 40)})` : "";
        // A nested rule is shown as the selector it really is (".image-text-section > iframe"), not as it is written ("> iframe").
        const shown = (s) => truncate(s.full[0]);
        if (dead.length && dead.length === sources.length) {
          const nested = countRules(child), bytes = child.end === null ? 0 : child.end - child.start;
          wholeRules += 1 + nested; wholeBytes += bytes;
          add("css/unused-selector", "info", child.start, child.openAt + 1, `${sources.map(shown).join(", ")} never matches anything in the HTML${where}.${nested ? ` ${nested === 1 ? "Its nested rule goes" : `Its ${nested} nested rules go`} with it.` : ""}`, {
            why: "The rule is dead weight unless a script or another page adds matching elements. It can be deleted.",
            data: { selector: child.prelude, bytes, rules: 1 + nested },
          });
          continue; // its nested rules are subsumed
        }
        for (const d of dead) {
          add("css/unused-selector", "info", child.start, child.openAt + 1, `${shown(d)} never matches anything in the HTML${where}, although the other selectors of this rule do.`, {
            why: "Only this selector can be dropped from the list.", data: { selector: d.source, bytes: 0, rules: 0 },
          });
        }
        visit(child, sources.flatMap((s) => s.full), atChain);
      }
    })(scan.root, [], []);

    if (wholeRules) {
      const pct = scan.text.length ? Math.round((wholeBytes / scan.text.length) * 100) : 0;
      add("css/unused-summary", "info", 0, 0, `${wholeRules} of ${total} rules (about ${wholeBytes.toLocaleString("en-GB")} bytes, ${pct}% of the CSS) never match anything in the HTML.`, {
        why: "Each is listed below. They can go, unless a script or another page adds the matching elements or classes.",
        data: { rules: wholeRules, of: total, bytes: wholeBytes, percent: pct },
      });
    }
  }

  // ---- custom properties nothing uses ----
  const referenced = new Set([...scan.text.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
  (function walk(node) {
    for (const d of node.decls) {
      if (!d.prop.startsWith("--") || HOST_VARIABLES.test(d.prop) || referenced.has(d.prop)) continue;
      const escaped = d.prop.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
      const outside = (html + "\n" + js).match(new RegExp(`${escaped}(?![\\w-])`)); // an inline style, or a script reading it
      if (outside) continue;
      add("css/unused-variable", "info", d.start, d.start + d.prop.length, `${d.prop} is declared but nothing uses it.`, { why: "No var() in the CSS, and nothing in the HTML or JS reads it.", data: { name: d.prop } });
    }
    node.children.forEach(walk);
  })(scan.root);

  return findings;
}
