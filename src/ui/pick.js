// Click-to-edit: given something clicked in the preview, find the form control that
// produced it, then reveal that control (open its card, scroll to it, focus it).
//
// Generic by design: instead of tagging each block's markup, it compares what was
// clicked with what is in the form. Walking up from the clicked element, the first
// element whose text (or src/href/alt) matches a control's value wins. Text fields
// match by equality or containment; rich-text editors match when they contain the
// clicked text. Nothing is added to the generated HTML.
import { revealItem } from "./list-actions.js";

const squash = (s) => (s || "").replace(/\s+/g, " ").trim();
const MIN_CONTAIN = 3; // shorter values only match by equality, so "a" doesn't match everything

function candidates(formRoot) {
  const out = [];
  formRoot.querySelectorAll('input[type="text"], textarea').forEach((el) => {
    if (el.closest(".ql-toolbar, .ql-container, .rich-text-editor")) return;
    const value = squash(el.value);
    if (value) out.push({ el, value, quill: null });
  });
  formRoot.querySelectorAll(".field").forEach((wrap) => {
    if (!wrap._quillInstance) return;
    const value = squash(wrap._quillInstance.getText());
    if (value) out.push({ el: wrap.querySelector(".ql-editor"), value, quill: wrap._quillInstance });
  });
  return out;
}

// -> { control, element } for the clicked element, or null.
export function findControl(target, formRoot, pageRoot) {
  const list = candidates(formRoot);
  if (!list.length) return null;
  for (let node = target; node && node !== pageRoot && node.nodeType === 1; node = node.parentElement) {
    const text = squash(node.textContent);
    const attrs = ["src", "href", "alt", "title"].map((a) => node.getAttribute && node.getAttribute(a)).filter(Boolean);
    let hit = list.find((c) => !c.quill && (c.value === text || attrs.includes(c.value)));
    if (!hit && text.length >= MIN_CONTAIN) hit = list.find((c) => c.quill && c.value.includes(text));
    if (!hit) hit = list.find((c) => !c.quill && c.value.length >= MIN_CONTAIN && text.includes(c.value));
    if (hit) return { control: hit, element: node };
  }
  return null;
}

// Open, scroll to, focus and briefly flash the control.
export function reveal(hit) {
  const { el, quill } = hit;
  revealItem(el);
  const field = el.closest(".field");
  (quill ? quill.root : el).scrollIntoView({ block: "center", behavior: "smooth" });
  if (quill) quill.focus(); else el.focus({ preventScroll: true });
  const target = quill ? field : el;
  target.classList.remove("pick-flash");
  void target.offsetWidth; // restart the animation if it is already running
  target.classList.add("pick-flash");
  setTimeout(() => target.classList.remove("pick-flash"), 1400);
}
