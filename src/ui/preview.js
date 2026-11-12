// The live preview: an iframe shown at a chosen device width, scaled to fit the
// side panel. The base CSS has breakpoints at 768px and 576px, so the width
// toggle is how editors check the mobile layout.
import { getPref, setPref } from "./storage.js";

export const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1000 },
  { id: "tablet", label: "Tablet", width: 700 },
  { id: "phone", label: "Phone", width: 375 },
];

let device = DEVICES.find((d) => d.id === getPref("device", "desktop")) || DEVICES[0];
const previews = new Set();

function setDevice(d) {
  device = d;
  setPref("device", d.id);
  previews.forEach((p) => p.layout());
}

export function createPreview(title) {
  const el = document.createElement("section");
  el.className = "preview-card";
  el.setAttribute("aria-label", "Live preview");
  el.innerHTML = `
    <div class="card-head">
      <h3>Live preview</h3>
      <div class="device-toggle" role="group" aria-label="Preview width"></div>
    </div>
    <div class="preview-stage"><iframe class="live-preview" title="${title} preview"></iframe></div>`;
  const stage = el.querySelector(".preview-stage");
  const frame = el.querySelector("iframe");
  const toggle = el.querySelector(".device-toggle");

  const buttons = DEVICES.map((d) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d.label;
    b.title = `${d.label} (${d.width}px wide)`;
    b.addEventListener("click", () => setDevice(d));
    toggle.appendChild(b);
    return [d, b];
  });

  function layout() {
    buttons.forEach(([d, b]) => b.setAttribute("aria-pressed", String(d === device)));
    const avail = stage.clientWidth || device.width;
    const scale = Math.min(1, avail / device.width);
    frame.style.width = device.width + "px";
    frame.style.height = (stage.clientHeight || 380) / scale + "px";
    frame.style.transform = `scale(${scale})`;
    frame.style.left = Math.max(0, (avail - device.width * scale) / 2) + "px";
  }

  const api = { el, layout, setDoc: (html) => { frame.srcdoc = html; } };
  previews.add(api);
  new ResizeObserver(layout).observe(stage);
  layout();
  return api;
}
