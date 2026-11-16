// HTML rules that need the whole page, not one tag: ids and the things that point at them. Pure.
import { makeFinding, relatedAt } from "./locate.js";
import { attrOf } from "./html-scan.js";

const idsOf = (v) => (v || "").split(/\s+/).filter(Boolean);

// scan: the result of scanHtml(). Returns findings.
export function htmlRules({ elements, loc }) {
  const findings = [];
  const add = (id, severity, start, end, message, extra) => findings.push(makeFinding(loc, "html", id, severity, start, end, message, extra));

  // ---- ids ----
  const first = new Map();
  for (const el of elements) {
    const id = attrOf(el, "id");
    if (!id || id.value === null || !id.value.trim()) continue;
    const value = id.value.trim();
    if (!first.has(value)) { first.set(value, id); continue; }
    add("html/duplicate-id", "error", id.valueStart, id.valueEnd, `The id "${value}" is used more than once.`, {
      why: "Links, aria attributes and Bootstrap's data-bs-target all find the FIRST element with an id, so controls on this one act on the other element.",
      related: [relatedAt(loc, "html", first.get(value).valueStart, "the first use of the id")],
      data: { id: value },
    });
  }

  // ---- things that point at an id ----
  const anchors = new Set([...first.keys()]);
  for (const el of elements) if (el.tag === "a") { const n = attrOf(el, "name"); if (n?.value) anchors.add(n.value); }
  const missing = (attr, target, severity, what, why) => {
    if (anchors.has(target)) return;
    add("html/missing-target", severity, attr.valueStart, attr.valueEnd, `${what} points at "${target}", but nothing on the page has that id.`, { why, data: { target } });
  };
  for (const el of elements) {
    for (const a of el.attrs) {
      if (a.value === null || a.valueStart === null) continue;
      if (a.name === "href" && /^#[^\s#]/.test(a.value)) {
        let target = a.value.slice(1);
        try { target = decodeURIComponent(target); } catch { /* keep it as written */ }
        missing(a, target, "warning", "This link", "The link goes nowhere (unless the page it is pasted into defines that id).");
      } else if (a.name === "data-bs-target" || a.name === "data-bs-parent") {
        const m = a.value.trim().match(/^#([\w-]+)$/);
        if (m) missing(a, m[1], a.name === "data-bs-target" ? "error" : "warning", `This ${a.name}`, a.name === "data-bs-target" ? "Bootstrap finds nothing to open or close, so the control does nothing." : "The panel still opens, but the group no longer closes the others.");
      } else if (a.name === "aria-controls" || a.name === "aria-labelledby" || a.name === "aria-describedby") {
        for (const id of idsOf(a.value)) missing(a, id, "warning", `This ${a.name}`, "Assistive technology can't follow it.");
      } else if (a.name === "for" && el.tag === "label" && a.value.trim()) {
        missing(a, a.value.trim(), "warning", "This label", "Clicking the label does not focus anything, and the field has no accessible name.");
      }
    }
  }
  return findings;
}
