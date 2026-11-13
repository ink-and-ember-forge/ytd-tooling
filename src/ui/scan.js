// A quick scan of EVERY rule of the review before it starts: which ones change how this page looks, and which make no visible
// difference (so there is nothing to decide: the template is simply used). The per-rule preview measures one rule at a time on its
// slide; this measures all of them at once, with two hidden pairs of frames (the template, and the page as the author wrote it),
// one at desktop width and one at phone width, because a rule written for phones only shows at the phone width.
//
// Pure analysis (summariseScan) is separate from the frames (scanRules), so it can be tested in Node.
import { makeEl } from "../lib/dom.js";
import { pageDoc } from "./upgrade-parts.js";
import { probeFor, compareReports, measuredSummary } from "./closeup.js";

export const WIDTHS = { desktop: 1100, phone: 390 };

// What each frame is asked to measure: every line of every row, in one flat list (rows remember where theirs start).
export function scanProbe(rows) {
  const selectors = [], lines = [], spans = [];
  for (const row of rows) {
    const p = probeFor(row);
    p.selectors.forEach((s) => { if (!selectors.includes(s)) selectors.push(s); });
    spans.push([lines.length, lines.length + p.lines.length]);
    lines.push(...p.lines);
  }
  return { selectors, pad: 0, lines, spans };
}

// rows: the review rows. frames: { desktop: { template, yours }, phone: { template, yours } }, each a report from the probe:
// { n, lines: [{ applies, measurable, vals[] }] } over the flat list from scanProbe. Returns Map(row id -> measuredSummary).
// A line is read from the desktop frame, or from the phone frame when it only applies on small screens.
export function summariseScan(rows, spans, frames) {
  const out = new Map();
  rows.forEach((row, r) => {
    const [from, to] = spans[r];
    const pick = (side, i) => { const d = frames.desktop[side].lines[i]; return d.applies ? d : frames.phone[side].lines[i]; };
    const idx = Array.from({ length: to - from }, (_, k) => from + k);
    const t = idx.map((i) => pick("template", i)), y = idx.map((i) => pick("yours", i));
    const touched = new Set();
    t.forEach((l) => l.vals.forEach((v, j) => { if (v !== null) touched.add(j); }));
    const labels = row.lines.map((l) => l.label);
    const rt = { n: touched.size, desc: [], lines: t }, ry = { n: touched.size, desc: [], lines: y };
    out.set(row.id, measuredSummary(compareReports(rt, ry, labels), rt, ry, labels));
  });
  return out;
}

// The rules that make no visible difference on this page: nothing to decide. Rules that match nothing are listed apart, since they
// are dead on this page but the page might gain such an element later.
export function quietRules(rows, measured) {
  const same = [], none = [];
  for (const row of rows) {
    const m = measured.get(row.id);
    if (!m) continue;
    if (m.status === "same") same.push(row);
    else if (m.status === "none") none.push(row);
  }
  return { same, none };
}

// Loads the four hidden frames, waits for their reports (or the timeout), and resolves to Map(row id -> summary), or null if it
// could not measure (a blocked frame, a timeout): the review then simply asks about every rule, as it always did.
// pages: { template, yours } as { html, css, js }.
export function scanRules(rows, pages, { timeout = 12000 } = {}) {
  const measurable = rows.filter((r) => r.selectors.length);
  if (!measurable.length) return Promise.resolve(new Map());
  const probe = scanProbe(measurable);
  const holder = makeEl("div", "upgrade-scan");
  holder.setAttribute("aria-hidden", "true");
  document.body.appendChild(holder);
  const frames = {}, wanted = [];
  for (const [size, width] of Object.entries(WIDTHS)) {
    for (const side of ["template", "yours"]) {
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.tabIndex = -1;
      frame.title = `Measuring ${side} at ${size} width`;
      frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:800px;border:0;visibility:hidden`;
      frame.srcdoc = pageDoc(pages[side], { probe });
      holder.appendChild(frame);
      wanted.push([size, side, frame]);
    }
  }
  return new Promise((resolve) => {
    const got = { desktop: {}, phone: {} };
    let left = wanted.length;
    const finish = (result) => { window.removeEventListener("message", onMessage); clearTimeout(timer); holder.remove(); resolve(result); };
    const onMessage = (event) => {
      const data = event.data;
      if (!data || !data.__closeup || data.type !== "report") return;
      const hit = wanted.find(([, , f]) => f.contentWindow === event.source);
      if (!hit) return;
      got[hit[0]][hit[1]] = data;
      if (--left === 0) { try { finish(summariseScan(measurable, probe.spans, got)); } catch { finish(null); } }
    };
    const timer = setTimeout(() => finish(null), timeout);
    window.addEventListener("message", onMessage);
  });
}
