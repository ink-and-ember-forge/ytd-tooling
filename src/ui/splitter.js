// A draggable divider between the form and the preview, so editors can give the
// preview as much room as they like. Width is shared by every block and remembered.
// Mouse/touch drag, arrow keys when focused, double-click to reset.
import { getPref, setPref } from "./storage.js";

const MIN = 380; // narrowest either side may get, in px
const root = document.documentElement;

const clamp = (w, total) => Math.round(Math.min(Math.max(w, MIN), Math.max(MIN, total - MIN)));

function apply(width) {
  if (width == null) root.style.removeProperty("--side-w");
  else root.style.setProperty("--side-w", width + "px");
}

// Call once at startup so every panel starts at the saved width.
export function restoreSplitWidth() {
  const saved = getPref("sideWidth", null);
  if (typeof saved === "number") apply(saved);
}

export function initSplitter(handle, grid) {
  const total = () => grid.getBoundingClientRect().width;
  const current = () => handle.nextElementSibling.getBoundingClientRect().width;

  function set(width, save = true) {
    const w = clamp(width, total());
    apply(w);
    handle.setAttribute("aria-valuenow", String(w));
    if (save) setPref("sideWidth", w);
  }

  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("is-dragging");
    const right = grid.getBoundingClientRect().right;
    const move = (ev) => set(right - ev.clientX, false);
    const up = () => {
      handle.classList.remove("is-dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      setPref("sideWidth", Math.round(current()));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  });

  handle.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 80 : 24;
    if (e.key === "ArrowLeft") { e.preventDefault(); set(current() + step); }   // preview wider
    else if (e.key === "ArrowRight") { e.preventDefault(); set(current() - step); }
  });

  handle.addEventListener("dblclick", () => { apply(null); setPref("sideWidth", null); });
}
