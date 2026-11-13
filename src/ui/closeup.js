// The close-up of one rule in the migration review: the element the rule touches, shown at a readable size with the template's
// version above and yours below, cropped to the element so nothing needs scrolling. It measures the real rendered styles in
// both versions, so it can say which elements actually look different and what the difference is, and says plainly when a rule
// changes nothing you can see on this page.
//
// Each version is a sandboxed iframe holding the whole page, with a small script (see probeMarkup in upgrade-parts.js) that finds
// the rule's elements, reports their computed styles to the builder with postMessage, and scrolls itself to the element it is
// asked to show. The builder sizes the frame to the element. The frame scrolls ITSELF (window.scrollTo); nothing here ever calls
// scrollIntoView, which would scroll the builder's own page.
import { makeEl } from "../lib/dom.js";
import { pageDoc, plural } from "./upgrade-parts.js";
import { cleanSelector } from "../changelog/review.js";

const PAD = 24, MIN_H = 90, MAX_H = 380;
const PSEUDO = /::?(?:before|after|marker|placeholder|first-line|first-letter|selection)\s*$/;
const STATE = /:(?:hover|focus|focus-visible|focus-within|active|visited|checked)\b/;

// What the frame needs to know about a row: its elements, and the property of each rule to measure.
export function probeFor(row) {
  return {
    selectors: row.selectors, pad: PAD,
    lines: row.lines.map((l) => ({
      sel: cleanSelector(l.where), prop: l.prop, label: l.label, media: l.media,
      pseudo: ((l.where.match(PSEUDO) || [])[0] || "").replace(/^:{1,2}/, "::") || null,
      measurable: !STATE.test(l.where),
    })),
  };
}

// Which elements look different, from the two reports (template, yours). Pure: it is tested in Node.
// A report: { n, desc[], lines: [{ applies, measurable, vals[] (one per element, null when the rule does not touch it) }] }.
export function compareReports(template, yours, labels) {
  const differ = new Map(); // element index -> [{ label, template, yours }]
  let measured = 0, unmeasurable = 0, small = 0;
  template.lines.forEach((t, i) => {
    const y = yours.lines[i];
    if (!t.applies) { small++; return; }
    if (!t.measurable) { unmeasurable++; return; }
    measured++;
    t.vals.forEach((tv, j) => {
      const yv = y.vals[j];
      if (tv === null || yv === null || tv === yv) return;
      differ.set(j, [...(differ.get(j) || []), { label: labels[i], template: tv, yours: yv }]);
    });
  });
  const differing = [...differ.keys()].sort((a, b) => a - b);
  return { n: template.n, differing, differ, measured, unmeasurable, small };
}

const show = (v) => (v === "" || v == null ? "not set" : v);

// The sentence above a close-up for the element on show.
export function lookAt(desc, diffs) {
  if (!diffs || !diffs.length) return `Looking at the ${desc}. It looks the same either way.`;
  return `Looking at the ${desc}. ${diffs.map((d) => `${d.label}: the template gives ${show(d.template)}, yours gives ${show(d.yours)}.`).join(" ")}`;
}

// The line that says how much of this rule you can see on this page.
export function summaryLine(cmp) {
  if (cmp.n === 0) return "This rule matches nothing on this page, so it has no effect here.";
  if (!cmp.measured) {
    return cmp.unmeasurable ? "This rule only applies on hover or focus, which can't be shown here, so read the values above to decide."
      : "This rule applies only on a different screen size from this view.";
  }
  if (!cmp.differing.length) return `No visible difference on this page: the ${plural(cmp.n, "element", "elements")} look${cmp.n === 1 ? "s" : ""} the same with or without your rule.${cmp.unmeasurable ? " (Part of it only applies on hover or focus, which can't be shown here.)" : ""}`;
  return `${cmp.differing.length} of the ${plural(cmp.n, "element", "elements")} ${cmp.n === 1 ? "looks" : "look"} different. ${cmp.differing.length === cmp.n ? "" : "The others already match the template, so they are skipped here."}`.trim();
}

// row: a review row. pages(): { template, yours } as { html, css, js }, built when the close-up scrolls into view.
// phone: show at phone width, side by side. Returns { el, load }.
export function createCloseup(row, pages, { phone = false } = {}) {
  const probe = probeFor(row);
  const labels = probe.lines.map((l) => l.label);
  const root = makeEl("div", `upgrade-closeup${phone ? " upgrade-closeup--phone" : ""}`);
  const summary = makeEl("p", "upgrade-closeup-summary", "Loading the close-up…");
  const look = makeEl("p", "upgrade-closeup-look");
  look.setAttribute("aria-live", "polite");
  const stage = makeEl("div", "upgrade-closeup-frames");
  const nav = makeEl("div", "upgrade-closeup-nav");
  const prev = makeEl("button", "copy-btn copy-btn--inline", "Previous");
  const next = makeEl("button", "copy-btn copy-btn--inline", "Next");
  const where = makeEl("span", "upgrade-muted");
  prev.type = next.type = "button";
  nav.append(prev, where, next);
  nav.hidden = true;
  root.append(summary, look, stage, nav);

  const side = {}; // "template" | "yours" -> { frame, report }
  let loaded = false, order = [], pos = 0, cmp = null;

  const post = (index) => Object.values(side).forEach((s) => s.frame.contentWindow?.postMessage({ __closeup: "go", i: index }, "*"));
  const go = (p) => {
    pos = Math.max(0, Math.min(order.length - 1, p));
    const idx = order[pos];
    look.textContent = lookAt(side.template.report.desc[idx], cmp.differ.get(idx));
    where.textContent = ` ${cmp.differing.length ? "Difference" : "Element"} ${pos + 1} of ${order.length} `;
    prev.disabled = pos === 0;
    next.disabled = pos >= order.length - 1;
    post(idx);
  };
  prev.addEventListener("click", () => go(pos - 1));
  next.addEventListener("click", () => go(pos + 1));

  function analyse() {
    cmp = compareReports(side.template.report, side.yours.report, labels);
    summary.textContent = summaryLine(cmp);
    summary.classList.toggle("upgrade-closeup-summary--same", cmp.n > 0 && cmp.measured > 0 && !cmp.differing.length);
    order = cmp.differing.length ? cmp.differing : [...Array(cmp.n).keys()];
    if (!cmp.n) { stage.hidden = true; return; }
    nav.hidden = order.length < 2;
    go(0);
  }

  const onMessage = (event) => {
    if (!root.isConnected) { window.removeEventListener("message", onMessage); return; }
    const data = event.data;
    if (!data || !data.__closeup) return;
    const name = Object.keys(side).find((k) => side[k].frame.contentWindow === event.source);
    if (!name) return;
    if (data.type === "size") side[name].frame.style.height = `${Math.max(MIN_H, Math.min(MAX_H, Math.ceil(data.h) + 2 * PAD))}px`;
    else if (data.type === "report") { side[name].report = data; if (side.template.report && side.yours.report) analyse(); }
  };

  function load() {
    if (loaded) return;
    loaded = true;
    const { template, yours } = pages();
    window.addEventListener("message", onMessage);
    [["template", "The template", template], ["yours", "Yours", yours]].forEach(([name, label, page]) => {
      const cell = makeEl("div", "upgrade-closeup-cell");
      cell.appendChild(makeEl("strong", "upgrade-compare-label", label));
      const frame = document.createElement("iframe");
      frame.className = "upgrade-frame upgrade-frame--closeup";
      frame.title = `${label}: ${row.label}`;
      frame.setAttribute("sandbox", "allow-scripts");
      frame.style.width = phone ? "390px" : "100%";
      frame.srcdoc = pageDoc(page, { probe });
      cell.appendChild(frame);
      stage.appendChild(cell);
      side[name] = { frame, report: null };
    });
  }

  // Built only when it comes into view: a group can have a dozen rules, and each close-up is two copies of the page.
  if (typeof IntersectionObserver === "function") {
    const watcher = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { watcher.disconnect(); load(); } }, { rootMargin: "600px" });
    watcher.observe(root);
  } else load();
  return { el: root, load };
}
