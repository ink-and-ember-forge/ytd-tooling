// The preview of one rule in the migration review: the element the rule touches, shown large, the template's version and
// yours. It measures the real rendered styles in both versions, so it can say which elements actually look different and what the
// difference is, and says plainly when a rule changes nothing you can see on this page.
//
// Each version is a sandboxed iframe holding the whole page, with a probe script (probeScript in upgrade-parts.js) that finds the
// rule's elements, reports their computed styles to the builder with postMessage, opens whatever hides the element (a closed
// accordion, an icon card's panel) and scrolls ITSELF to it. The builder sizes the frames to the room the slide has. Nothing here
// ever calls scrollIntoView, which would scroll the builder's own page.
import { makeEl } from "../lib/dom.js";
import { pageDoc, plural } from "./upgrade-parts.js";
import { cleanSelector } from "../changelog/review.js";

const PAD = 40;
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

// The sentence above a preview for the element on show.
export function lookAt(desc, diffs) {
  if (!diffs || !diffs.length) return `Looking at the ${desc}. It looks the same either way.`;
  return `Looking at the ${desc}. ${diffs.map((d) => `${d.label}: the template gives ${show(d.template)}, yours gives ${show(d.yours)}.`).join(" ")}`;
}

// The line that says how much of this rule you can see on this page.
export function summaryLine(cmp) {
  if (cmp.n === 0) return "This rule matches nothing on this page, so it has no effect here.";
  if (!cmp.measured) {
    return cmp.unmeasurable ? "This rule only applies on hover or focus, which can't be shown here, so read the values to decide."
      : "This rule applies only on a different screen size from this view.";
  }
  if (!cmp.differing.length) return `No visible difference on this page: the ${plural(cmp.n, "element", "elements")} look${cmp.n === 1 ? "s" : ""} the same with or without your rule.${cmp.unmeasurable ? " (Part of it only applies on hover or focus, which can't be shown here.)" : ""}`;
  return `${cmp.differing.length} of the ${plural(cmp.n, "element", "elements")} ${cmp.n === 1 ? "looks" : "look"} different. ${cmp.differing.length === cmp.n ? "" : "The others already match the template, so they are skipped here."}`.trim();
}

// What the preview measured, in a form the rest of the wizard (the slide's value lines, the final report) can keep:
//   { status: "differs" | "same" | "none" | "state" | "screen", n, differing, text, lines: [{ label, measurable, template, yours, differs }] }
// The values of a line are read from the first element the rule CHANGES (else the first it touches), so they are the real
// rendered values on this page, not just what the template's rule for the same selector says.
export function measuredSummary(cmp, template, yours, labels) {
  const status = cmp.n === 0 ? "none" : !cmp.measured ? (cmp.unmeasurable ? "state" : "screen") : cmp.differing.length ? "differs" : "same";
  const lines = template.lines.map((t, i) => {
    const y = yours.lines[i], measurable = t.applies && t.measurable;
    if (!measurable) return { label: labels[i], measurable: false, template: null, yours: null, differs: false };
    let j = t.vals.findIndex((tv, e) => tv !== null && y.vals[e] !== null && tv !== y.vals[e]);
    const differs = j !== -1;
    if (!differs) j = t.vals.findIndex((tv) => tv !== null);
    return { label: labels[i], measurable: j !== -1, template: j === -1 ? null : t.vals[j], yours: j === -1 ? null : y.vals[j], differs };
  });
  return { status, n: cmp.n, differing: cmp.differing.length, text: summaryLine(cmp), lines };
}

// The note when the element was inside something closed, e.g. ['the accordion "Culture"'].
export const openedNote = (notes) => (notes && notes.length ? `It was inside ${notes.join(" and ")}, so that has been opened for you.` : "");

// How tall the frames may be: the room the slide has, less its header, text and buttons.
export const roomFor = (innerHeight) => Math.max(300, innerHeight - 510);

// The height of one frame: all the room there is (the element is centred in it, with the page around it). Pure.
export const frameHeight = ({ room, stacked }) => (stacked ? Math.floor(room / 2) : room);

// row: a review row. pages(): { template, yours } as { html, css, js }, built when the preview comes into view.
// phone: show at phone width. onMeasured(summary): called once both versions have reported. prefs: { mode: "stacked" | "flip", show: "template" | "yours" }, shared by every preview in the
// wizard so a choice sticks. Returns { el, load }.
export function createCloseup(row, pages, { phone = false, prefs = { mode: "stacked", show: "template" }, onMeasured = null } = {}) {
  const probe = probeFor(row);
  const labels = probe.lines.map((l) => l.label);
  const root = makeEl("div", `upgrade-closeup${phone ? " upgrade-closeup--phone" : ""}`);
  const summary = makeEl("p", "upgrade-closeup-summary", "Loading the preview…");
  const look = makeEl("p", "upgrade-closeup-look");
  look.setAttribute("aria-live", "polite");
  const opened = makeEl("p", "upgrade-closeup-opened");
  const stage = makeEl("div", "upgrade-closeup-frames");
  const nav = makeEl("div", "upgrade-closeup-nav");
  const prev = makeEl("button", "copy-btn copy-btn--inline", "Previous element");
  const next = makeEl("button", "copy-btn copy-btn--inline", "Next element");
  const where = makeEl("span", "upgrade-muted");
  prev.type = next.type = "button";
  nav.append(prev, where, next);
  nav.hidden = true;

  // The view controls: stacked or flip, and (flip only) which version is showing.
  const bar = makeEl("div", "upgrade-closeup-bar");
  const group = (label, items, get, set) => {
    const seg = makeEl("div", "upgrade-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", label);
    const buttons = items.map(([value, text]) => {
      const b = makeEl("button", "upgrade-seg-btn", text);
      b.type = "button";
      b.dataset.value = value;
      b.addEventListener("click", () => { set(value); layout(); });
      seg.appendChild(b);
      return b;
    });
    return { seg, sync: () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(get() === b.dataset.value))) };
  };
  const views = [
    group("How to compare", [["stacked", "Template above yours"], ["flip", "Flip between them"]], () => prefs.mode, (v) => { prefs.mode = v; }),
    group("Which version", [["template", "The template"], ["yours", "Yours"]], () => prefs.show, (v) => { prefs.show = v; }),
  ];
  views[1].seg.classList.add("upgrade-closeup-which");
  bar.append(...views.map((v) => v.seg), nav); // the element stepper sits with the view controls, so it is never below the fold
  root.append(bar, summary, look, opened, stage);

  const side = {}; // "template" | "yours" -> { frame, cell, report, h }
  let loaded = false, order = [], pos = 0, cmp = null;

  // Everything that depends on the view: which frames show, and how tall they are.
  function layout() {
    views.forEach((v) => v.sync());
    const flip = prefs.mode === "flip";
    views[1].seg.hidden = !flip;
    root.classList.toggle("upgrade-closeup--flip", flip);
    const room = roomFor(window.innerHeight);
    Object.entries(side).forEach(([name, s]) => {
      s.cell.hidden = flip && prefs.show !== name;
      s.frame.style.height = `${frameHeight({ room, stacked: !flip && !phone })}px`;
    });
    if (cmp && order.length) post(order[pos]); // the element is placed again for the new frame size
  }
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
    if (onMeasured) onMeasured(measuredSummary(cmp, side.template.report, side.yours.report, labels));
    summary.textContent = summaryLine(cmp);
    summary.classList.toggle("upgrade-closeup-summary--same", cmp.n > 0 && cmp.measured > 0 && !cmp.differing.length);
    order = cmp.differing.length ? cmp.differing : [...Array(cmp.n).keys()];
    if (!cmp.n) { stage.hidden = true; bar.hidden = true; return; }
    nav.hidden = order.length < 2;
    go(0);
  }

  const onMessage = (event) => {
    if (!root.isConnected) { window.removeEventListener("message", onMessage); return; }
    const data = event.data;
    if (!data || !data.__closeup) return;
    const name = Object.keys(side).find((k) => side[k].frame.contentWindow === event.source);
    if (!name) return;
    if (data.type === "size") {
      if (name === "template") opened.textContent = openedNote(data.notes);
    } else if (data.type === "report") {
      side[name].report = data;
      if (side.template.report && side.yours.report) analyse();
    }
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
      side[name] = { frame, cell, report: null };
    });
    layout();
  }
  views.forEach((v) => v.sync());
  views[1].seg.hidden = prefs.mode !== "flip";

  // A wizard slide shows one preview, so it loads at once; a long page would load previews as they scroll into view.
  load();
  return { el: root, load };
}
