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

const HOVER_STYLE = "[data-pick-hover]{outline:2px dashed #00917f;outline-offset:2px;cursor:pointer}";

export function createPreview(title, { resolve, onPick } = {}) {
  const el = document.createElement("section");
  el.className = "preview-card";
  el.setAttribute("aria-label", "Live preview");
  el.innerHTML = `
    <div class="card-head">
      <h3>Live preview <span class="preview-hint">· click anything to edit it</span></h3>
      <div class="card-tools">
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

  // ---- click to edit --------------------------------------------------------
  frame.addEventListener("load", () => {
    const doc = frame.contentDocument;
    if (!doc || !resolve) return;
    const root = doc.getElementById("page-container");
    const style = doc.createElement("style");
    style.textContent = HOVER_STYLE;
    doc.head.appendChild(style);
    let hovered = null;
    const clearHover = () => { if (hovered) { hovered.removeAttribute("data-pick-hover"); hovered = null; } };

    doc.addEventListener("mouseover", (e) => {
      const hit = resolve(e.target, root);
      clearHover();
      if (hit) { hovered = hit.element; hovered.setAttribute("data-pick-hover", ""); }
    });
    doc.addEventListener("mouseleave", clearHover);
    doc.addEventListener("click", (e) => {
      // Links in the preview must not navigate it away; other behaviour (accordions...) is left alone.
      if (e.target.closest && e.target.closest("a[href]")) e.preventDefault();
      const hit = resolve(e.target, root);
      if (hit && onPick) onPick(hit.control);
    }, true);
  });

  // ---- pop-out ---------------------------------------------------------------
  const api = {
    el, layout, title, doc: "",
    isVisible: () => { const panel = el.closest(".panel"); return !!panel && !panel.hidden; },
    setDoc(html) {
      api.doc = html;
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
