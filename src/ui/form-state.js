// Reads and restores a block form generically, from the DOM itself, so every
// field type (and any future one) gets autosave, reset and undo without
// per-type code. State shape per field:
//   { n: number of list items (if a list), c: [control values in DOM order], q: rich-text delta }
//
// "Controls" are the form inputs inside the field, excluding the rich-text editor's own.

const controlsOf = (wrap) =>
  Array.from(wrap.querySelectorAll("input, select, textarea")).filter((el) => !el.closest(".ql-toolbar, .ql-container, .rich-text-editor"));

const itemsOf = (wrap) => wrap.querySelectorAll(".item-cards > .item-card, .bullet-rows > .bullet-row");

export function snapshotField(wrap) {
  const state = { c: controlsOf(wrap).map((el) => (el.type === "checkbox" ? { k: el.checked } : { v: el.value })) };
  if (wrap.querySelector(".item-add, .bullet-add")) state.n = itemsOf(wrap).length;
  if (wrap._quillInstance) state.q = wrap._quillInstance.getContents().ops;
  return state;
}

export function snapshotForm(fieldEls) {
  return { v: 1, fields: fieldEls.map(snapshotField) };
}

function setControl(el, saved) {
  if (!saved) return;
  if (el.type === "checkbox") el.checked = !!saved.k;
  else if ("v" in saved) {
    // A select only takes values it has; ignore stale ones.
    if (el.tagName === "SELECT" && !Array.from(el.options).some((o) => o.value === saved.v)) return;
    el.value = saved.v;
  }
  // Lets visibility rules (media type, "separate image", card style) react.
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function restoreField(wrap, state) {
  if (!state) return;
  if (typeof state.n === "number") {
    const add = wrap.querySelector(".item-add, .bullet-add");
    let items = itemsOf(wrap);
    for (let i = items.length; i < state.n; i++) add.click();
    items = itemsOf(wrap);
    for (let i = items.length - 1; i >= state.n; i--) items[i].remove();
  }
  const controls = controlsOf(wrap);
  (state.c || []).forEach((saved, i) => controls[i] && setControl(controls[i], saved));
  if (wrap._quillInstance && state.q) wrap._quillInstance.setContents(state.q, "silent");
}

export function restoreForm(fieldEls, state) {
  if (!state || !Array.isArray(state.fields)) return false;
  fieldEls.forEach((wrap, i) => restoreField(wrap, state.fields[i]));
  return true;
}

// Copies every control value from one list item to another (used by "Duplicate").
export function copyControls(from, to) {
  const a = controlsOf(from), b = controlsOf(to);
  a.forEach((el, i) => {
    if (!b[i]) return;
    if (el.type === "checkbox") b[i].checked = el.checked; else b[i].value = el.value;
    b[i].dispatchEvent(new Event("change", { bubbles: true }));
  });
}
