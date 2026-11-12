// The live preview: an iframe laid out at a chosen device width. The base CSS has
// breakpoints at 768px and 576px, so the width toggle is how editors check the
// mobile layout.
//
// The preview is NEVER scaled: text is always at its true size. (An earlier version
// shrank the page to fit the panel, which made 16px text look like 10px.) If the panel
// is narrower than the page being shown, the preview scrolls sideways instead.
//
// `width` is the iframe's viewport (what the media queries see); `shown` is how much of
// it to display. On desktop a block sits in a ~600px column (see preview-doc.js), so the
// viewport is 1000px (desktop layout) but only the left 616px are shown (the column plus
// the preview's 8px margins) and the empty remainder is clipped.
//
// Two extras:
//  - click-to-edit: hovering outlines what you can edit; clicking calls onPick(hit),
//    where hit comes from `resolve(element)` (see pick.js).
//  - pop-out: the preview can live in its own window (see popout.js).
import { getPref, setPref } from "./storage.js";
import { openPopout, closePopout, postDoc, isPoppedOut, onPopoutChange, setResender } from "./popout.js";

export const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1000, shown: 616, hint: "page column, about 600px wide" }, // 600px column + the preview's 8px margins
  { id: "tablet", label: "Tablet", width: 640 }, // between the 576px and 768px breakpoints
  { id: "phone", label: "Phone", width: 375 },
];

let device = DEVICES.find((d) => d.id === getPref("device", "desktop")) || DEVICES[0];
const previews = new Set();

function setDevice(d) {
  device = d;
  setPref("device", d.id);
  previews.forEach((p) => p.layout());
}

// The block whose panel is on screen is the one the pop-out follows.
export function broadcastActive() {
  for (const p of previews) {
    if (p.doc && p.isVisible()) { postDoc(p.doc, p.title); return; }
  }
}
setResender(broadcastActive);
onPopoutChange((open) => previews.forEach((p) => p.setPopped(open)));

// Styles injected into the preview page: click-to-edit hover, and the X-ray overlay
// (a dashed outline on every explained part, a numbered chip on each, a solid outline on the active one).
const PREVIEW_STYLE = `
  [data-pick-hover]{outline:2px dashed #00917f;outline-offset:2px;cursor:pointer}
  [data-xray]{outline:1px dashed rgba(0,145,127,.7);outline-offset:-1px}
  [data-xray-hover]{outline:2px solid #00917f !important;outline-offset:2px;background-color:rgba(0,145,127,.09)}
  .xray-chip{position:absolute;z-index:2147483647;min-width:20px;height:20px;padding:0 5px;border-radius:10px;border:2px solid #fff;background:#00917f;color:#fff;font:700 11px/16px sans-serif;text-align:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.4)}
`;

// `xray` (optional): { onHover(elementIndex | null), onSelect(elementIndex) } turns on the X-ray
// button. Element indexes are positions inside #page-container (see lib/code-map.js).
export function createPreview(title, { resolve, onPick, xray } = {}) {
  const el = document.createElement("section");
  el.className = "preview-card";
  el.setAttribute("aria-label", "Live preview");
  el.innerHTML = `
    <div class="card-head">
      <h3>Live preview <span class="preview-hint">· click anything to edit it</span></h3>
      <div class="card-tools">
        <button type="button" class="xray-btn" aria-pressed="false" hidden title="Number and outline every part of the block, then hover one to see what it does">🔍 X-ray</button>
        <div class="device-toggle" role="group" aria-label="Preview width"></div>
        <button type="button" class="popout-btn" title="Open the preview in its own window (for a second screen)">⧉ Pop out</button>
      </div>
    </div>
    <div class="preview-stage">
      <div class="preview-page"><iframe class="live-preview" title="${title} preview"></iframe></div>
      <div class="popout-note" hidden>
        <p>The preview is open in another window.</p>
        <button type="button" class="primary-btn popout-return">Bring it back here</button>
      </div>
    </div>
    <p class="clip-note" hidden>↔ This pane is narrower than the page, so the preview scrolls sideways at true size. Drag the divider to widen it.</p>`;
  const stage = el.querySelector(".preview-stage");
  const page = el.querySelector(".preview-page");
  const clipNote = el.querySelector(".clip-note");
  const frame = el.querySelector("iframe");
  const toggle = el.querySelector(".device-toggle");
  const popBtn = el.querySelector(".popout-btn");
  const note = el.querySelector(".popout-note");

  const buttons = DEVICES.map((d) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d.label;
    b.title = `${d.label} (${d.hint || d.width + "px wide"})`;
    b.addEventListener("click", () => setDevice(d));
    toggle.appendChild(b);
    return [d, b];
  });

  function layout() {
    buttons.forEach(([d, b]) => b.setAttribute("aria-pressed", String(d === device)));
    // Real pixels only: no transform, no zoom. The page is `shown` px wide and sits centred
    // when the panel is wider; when the panel is narrower the stage scrolls sideways.
    const shown = device.shown || device.width;
    const avail = stage.clientWidth || shown;
    page.style.width = shown + "px";
    page.style.left = Math.max(0, (avail - shown) / 2) + "px";
    frame.style.width = device.width + "px";
    // Say so when part of the page is off to the side, since the scrollbar may be hidden.
    clipNote.hidden = !(stage.scrollWidth > stage.clientWidth + 1);
  }

  // ---- X-ray: numbered chips over each explained part -------------------------------
  const xrayBtn = el.querySelector(".xray-btn");
  const hint = el.querySelector(".preview-hint");
  let xrayOn = false;
  let model = null;          // { partOf, labels } from the Explain panel, for the HTML currently shown
  let chips = [];            // [{ node, chip }]
  let highlighted = null;    // element index outlined from the code side

  const pageDoc = () => frame.contentDocument;
  const pageRoot = () => { const d = pageDoc(); return d && d.getElementById("page-container"); };

  function placeChips() {
    const d = pageDoc();
    if (!d) return;
    const sx = d.defaultView.scrollX, sy = d.defaultView.scrollY;
    const stacks = new Map(); // chips whose parts share a corner fan out sideways
    chips.forEach(({ node, chip }) => {
      const r = node.getBoundingClientRect();
      const hidden = r.width === 0 && r.height === 0; // e.g. a closed accordion panel
      chip.style.display = hidden ? "none" : "block";
      if (hidden) return;
      const key = `${Math.round(r.top / 6)},${Math.round(r.left / 6)}`;
      const k = stacks.get(key) || 0;
      stacks.set(key, k + 1);
      chip.style.left = Math.max(2, r.left + sx - 9 + k * 24) + "px";
      chip.style.top = Math.max(2, r.top + sy - 9) + "px";
    });
  }

  function clearXray() {
    const d = pageDoc();
    if (!d) return;
    d.querySelectorAll("[data-xray]").forEach((n) => n.removeAttribute("data-xray"));
    d.querySelectorAll(".xray-chip").forEach((c) => c.remove());
    chips = [];
  }

  function renderXray() {
    clearXray();
    const d = pageDoc(), root = pageRoot();
    if (!xrayOn || !model || !d || !root) return;
    const nodes = root.querySelectorAll("*");
    model.partOf.forEach((part, i) => {
      const node = nodes[i];
      if (part < 0 || !node) return;
      node.setAttribute("data-xray", String(i));
      const chip = d.createElement("button");
      chip.type = "button";
      chip.className = "xray-chip";
      chip.dataset.xrayChip = String(i);
      chip.textContent = String(part + 1);
      chip.title = model.labels[part];
      d.body.appendChild(chip);
      chips.push({ node, chip });
    });
    placeChips();
  }

  function highlight(index) {
    highlighted = index;
    const d = pageDoc(), root = pageRoot();
    if (!d) return;
    d.querySelectorAll("[data-xray-hover]").forEach((n) => n.removeAttribute("data-xray-hover"));
    if (index == null || !root) return;
    const node = root.querySelectorAll("*")[index];
    if (node) node.setAttribute("data-xray-hover", "");
  }

  function setXray(on) {
    xrayOn = !!on;
    xrayBtn.setAttribute("aria-pressed", String(xrayOn));
    el.classList.toggle("is-xray", xrayOn);
    if (hint) hint.textContent = xrayOn ? "· hover a number to learn" : "· click anything to edit it";
    renderXray();
  }
  if (xray) {
    xrayBtn.hidden = false;
    xrayBtn.addEventListener("click", () => setXray(!xrayOn));
  }

  // ---- inside the preview page: click-to-edit and X-ray interaction ---------------
  frame.addEventListener("load", () => {
    const doc = pageDoc();
    if (!doc) return;
    const root = pageRoot();
    const style = doc.createElement("style");
    style.textContent = PREVIEW_STYLE;
    doc.head.appendChild(style);
    renderXray();
    highlight(highlighted); // a reload (every edit) must not lose the outline
    const view = doc.defaultView;
    view.addEventListener("resize", placeChips);
    doc.addEventListener("transitionend", placeChips);
    if (root && "ResizeObserver" in view) new view.ResizeObserver(placeChips).observe(root);

    let hovered = null;
    const clearHover = () => { if (hovered) { hovered.removeAttribute("data-pick-hover"); hovered = null; } };
    const xrayIndex = (target) => {
      const n = target.closest && target.closest("[data-xray], [data-xray-chip]");
      return n ? Number(n.getAttribute("data-xray") ?? n.dataset.xrayChip) : null;
    };

    doc.addEventListener("mouseover", (e) => {
      if (xrayOn) { if (xray) xray.onHover(xrayIndex(e.target)); return; }
      if (!resolve) return;
      const hit = resolve(e.target, root);
      clearHover();
      if (hit) { hovered = hit.element; hovered.setAttribute("data-pick-hover", ""); }
    });
    doc.addEventListener("mouseleave", () => { clearHover(); if (xrayOn && xray) xray.onHover(null); });
    doc.addEventListener("click", (e) => {
      // Links in the preview must not navigate it away; other behaviour (accordions...) is left alone.
      if (e.target.closest && e.target.closest("a[href]")) e.preventDefault();
      if (xrayOn) {
        const i = xrayIndex(e.target);
        if (i !== null && xray) xray.onSelect(i);
        setTimeout(placeChips, 380); // an accordion may have opened: chips follow the layout
        return;
      }
      if (!resolve) return;
      const hit = resolve(e.target, root);
      if (hit && onPick) onPick(hit.control);
    }, true);
  });

  // ---- pop-out ---------------------------------------------------------------
  const api = {
    el, layout, title, doc: "",
    isVisible: () => { const panel = el.closest(".panel"); return !!panel && !panel.hidden; },
    setXray,
    highlight,
    // `newModel` (optional) is the Explain panel's model for this exact HTML, used by the X-ray.
    setDoc(html, newModel) {
      api.doc = html;
      model = newModel || null;
      frame.srcdoc = html;
      if (isPoppedOut() && api.isVisible()) postDoc(html, title);
    },
    setPopped(open) {
      el.classList.toggle("is-popped", open);
      note.hidden = !open;
      toggle.hidden = open;
      popBtn.hidden = open;
      if (!open) layout();
      else if (api.isVisible()) broadcastActive();
    },
  };
  popBtn.addEventListener("click", () => { if (openPopout()) broadcastActive(); });
  el.querySelector(".popout-return").addEventListener("click", closePopout);

  previews.add(api);
  new ResizeObserver(layout).observe(stage);
  layout();
  api.setPopped(isPoppedOut());
  return api;
}
