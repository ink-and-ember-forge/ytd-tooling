// One block's tab: a form on the left; on the right a sticky live preview and
// the generated code. Everything updates as you type; there is no Generate step.
// The form is autosaved to the browser and can be reset (with Undo).
import { buildField, collectValue } from "./fields.js";
import { getTheme, onThemeChange } from "./theme.js";
import { buildPreviewDoc } from "../lib/preview-doc.js";
import { BASE_CSS } from "../base/index.js";
import { createPreview } from "./preview.js";
import { createOutputPanel } from "./output-panel.js";
import { validateForm } from "./validation.js";
import { snapshotForm, restoreForm } from "./form-state.js";
import { getBlockState, setBlockState, clearBlockState, debounce } from "./storage.js";
import { toast } from "./toast.js";

export function buildBlockPanel(block) {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "panel-" + block.id;

  panel.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 class="panel-title"></h2>
        <p class="panel-desc"></p>
      </div>
      <button type="button" class="reset-btn">Reset this block</button>
    </div>
    <div class="panel-grid">
      <div class="panel-form"></div>
      <div class="panel-side"></div>
    </div>`;
  panel.querySelector(".panel-title").textContent = block.tabLabel || block.label;
  panel.querySelector(".panel-desc").textContent = block.description || "";
  const formCol = panel.querySelector(".panel-form");
  const sideCol = panel.querySelector(".panel-side");

  const preview = createPreview(block.tabLabel || block.label);
  const output = createOutputPanel(block);
  sideCol.append(preview.el, output.el);

  const fieldEls = block.fields.map((field) => {
    const el = buildField(field);
    formCol.appendChild(el);
    return el;
  });

  if (block.guide) {
    const guide = document.createElement("details");
    guide.className = "how-it-works";
    guide.innerHTML = `<summary>How it works</summary><div class="how-it-works-body">${block.guide}</div>`;
    formCol.appendChild(guide);
  }

  let restoring = true; // suppress refreshes while loading saved state
  const defaults = snapshotForm(fieldEls);

  const collect = () => {
    const values = {};
    block.fields.forEach((field, i) => { values[field.id] = collectValue(fieldEls[i], field); });
    return values;
  };

  const save = debounce(() => setBlockState(block.id, snapshotForm(fieldEls)), 400);
  const showPreview = debounce((html) => preview.setDoc(html), 120);

  function refresh() {
    if (restoring) return;
    validateForm(formCol);
    try {
      const values = collect();
      const html = block.generateHTML(values);
      output.update({
        html,
        secondary: block.secondaryHTML ? block.secondaryHTML.generate(values) : null,
        warnings: block.warnings ? block.warnings(values) : [],
      });
      showPreview(buildPreviewDoc(block, html, block.css, block.js, getTheme(), BASE_CSS));
    } catch (err) {
      // A field mid-edit (e.g. an incomplete media URL) shouldn't break the
      // tool; the next keystroke will try again. The last good output stays.
    }
  }

  const onEdit = () => { refresh(); if (!restoring) save(); };
  panel.addEventListener("input", onEdit);
  panel.addEventListener("change", onEdit);
  fieldEls.forEach((el) => { if (el._quillInstance) el._quillInstance.on("text-change", onEdit); });
  onThemeChange(refresh);

  // Load saved state, then render once.
  restoreForm(fieldEls, getBlockState(block.id));
  restoring = false;
  refresh();

  panel.querySelector(".reset-btn").addEventListener("click", () => {
    const before = snapshotForm(fieldEls);
    restoring = true;
    restoreForm(fieldEls, defaults);
    restoring = false;
    clearBlockState(block.id);
    refresh();
    toast("Block reset", {
      actionLabel: "Undo",
      onAction: () => {
        restoring = true;
        restoreForm(fieldEls, before);
        restoring = false;
        refresh();
        setBlockState(block.id, before);
      },
    });
  });

  return panel;
}
