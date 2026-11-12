// One block's tab: description, live preview, form, Generate button, outputs
// (HTML / CSS / JS with copy buttons) and the "How it works" guide.
import { buildField, collectValue } from "./fields.js";
import { getTheme, onThemeChange } from "./theme.js";
import { buildPreviewDoc } from "../lib/preview-doc.js";
import { BASE_CSS } from "../base/index.js";
import { copyToClipboard } from "../lib/dom.js";

function updatePreview(block, panel, fieldEls, previewFrame) {
  try {
    const values = {};
    block.fields.forEach((field, i) => {
      values[field.id] = collectValue(fieldEls[i], field);
    });
    const html = block.generateHTML(values);
    previewFrame.srcdoc = buildPreviewDoc(block, html, block.css, block.js, getTheme(), BASE_CSS);
  } catch (err) {
    // A field mid-edit (e.g. incomplete media URL) shouldn't break the tool —
    // just skip this update, the next keystroke will try again.
  }
}

// Returns { tabBtn, panel }; the caller decides where they go.
export function buildBlockPanel(block, index) {
  const tabBtn = document.createElement("button");
  tabBtn.className = "tab-btn" + (index === 0 ? " active" : "");
  tabBtn.textContent = block.label;
  tabBtn.dataset.tabTarget = block.id;

  const panel = document.createElement("div");
  panel.className = "panel" + (index === 0 ? " active" : "");
  panel.id = "panel-" + block.id;

  const desc = document.createElement("p");
  desc.className = "panel-desc";
  desc.textContent = block.description || "";
  panel.appendChild(desc);

  const previewWrap = document.createElement("div");
  previewWrap.className = "preview-wrap";
  previewWrap.innerHTML = `<h3>Live preview</h3><iframe class="live-preview"></iframe>`;
  panel.appendChild(previewWrap);
  const previewFrame = previewWrap.querySelector(".live-preview");

  const fieldEls = block.fields.map(field => {
    const el = buildField(field);
    panel.appendChild(el);
    return el;
  });

  const refreshPreview = () => updatePreview(block, panel, fieldEls, previewFrame);
  onThemeChange(refreshPreview);
  panel.addEventListener("input", refreshPreview);
  panel.addEventListener("change", refreshPreview);
  fieldEls.forEach(el => {
    if (el._quillInstance) el._quillInstance.on("text-change", refreshPreview);
  });
  refreshPreview();

  const generateBtn = document.createElement("button");
  generateBtn.className = "generate-btn";
  generateBtn.textContent = "Generate " + block.label.toLowerCase();
  panel.appendChild(generateBtn);

  const htmlOutputBlock = document.createElement("div");
  htmlOutputBlock.className = "output-block hidden";
  htmlOutputBlock.innerHTML = `
    <h3>${block.htmlOutputLabel || "HTML for this block — paste into .content-body"}</h3>
    <div class="output-wrap">
      <button class="copy-btn">Copy</button>
      <textarea rows="9" readonly></textarea>
    </div>`;
  const warningBox = document.createElement("div");
  warningBox.className = "note generate-warning";
  warningBox.style.cssText = "display:none; margin-top:1rem; padding:0.7rem 0.9rem; border-radius:6px; background:#fff4e5; color:#7a4a00; font-weight:600;";
  panel.appendChild(warningBox);
  panel.appendChild(htmlOutputBlock);

  let secondaryHtmlOutputBlock = null;
  if (block.secondaryHTML) {
    secondaryHtmlOutputBlock = document.createElement("div");
    secondaryHtmlOutputBlock.className = "output-block hidden";
    secondaryHtmlOutputBlock.innerHTML = `
      <h3>${block.secondaryHTML.label}</h3>
      <div class="output-wrap">
        <button class="copy-btn">Copy</button>
        <textarea rows="4" readonly></textarea>
      </div>`;
    panel.appendChild(secondaryHtmlOutputBlock);
  }

  let cssOutputBlock = null;
  if (block.css) {
    cssOutputBlock = document.createElement("div");
    cssOutputBlock.className = "output-block hidden";
    cssOutputBlock.innerHTML = `
      <h3>CSS for this block — paste inside #page-container { ... }</h3>
      <div class="output-wrap">
        <button class="copy-btn">Copy</button>
        <textarea rows="9" readonly></textarea>
      </div>
      <p class="note">This CSS only styles this one block — it doesn't include the base page styling, which you already have from the Base CSS download above.</p>`;
    panel.appendChild(cssOutputBlock);
  }

  let jsOutputBlock = null;
  if (block.js) {
    jsOutputBlock = document.createElement("div");
    jsOutputBlock.className = "output-block hidden";
    jsOutputBlock.innerHTML = `
      <h3>JS for this block — paste inside the Base JS script block</h3>
      <div class="output-wrap">
        <button class="copy-btn">Copy</button>
        <textarea rows="9" readonly></textarea>
      </div>
      <p class="note">Doesn't include its own &lt;script&gt; tags — add this inside the script block from Base JS, not as a separate one. Only needed once even if this block appears multiple times on the same page.</p>`;
    panel.appendChild(jsOutputBlock);
  }


  if (block.guide) {
    const howItWorks = document.createElement("details");
    howItWorks.className = "how-it-works";
    howItWorks.innerHTML = `
      <summary>How it works</summary>
      <div class="how-it-works-body">${block.guide}</div>`;
    panel.appendChild(howItWorks);
  }

  const htmlTextarea = htmlOutputBlock.querySelector("textarea");
  const secondaryHtmlTextarea = secondaryHtmlOutputBlock ? secondaryHtmlOutputBlock.querySelector("textarea") : null;
  const cssTextarea = cssOutputBlock ? cssOutputBlock.querySelector("textarea") : null;
  const jsTextarea = jsOutputBlock ? jsOutputBlock.querySelector("textarea") : null;

  generateBtn.addEventListener("click", () => {
    const values = {};
    block.fields.forEach((field, i) => {
      values[field.id] = collectValue(fieldEls[i], field);
    });
    const warnings = block.warnings ? block.warnings(values) : [];
    warningBox.textContent = warnings.join(" ");
    warningBox.style.display = warnings.length ? "block" : "none";
    htmlTextarea.value = block.generateHTML(values);
    htmlOutputBlock.classList.remove("hidden");
    if (secondaryHtmlOutputBlock) {
      secondaryHtmlTextarea.value = block.secondaryHTML.generate(values);
      secondaryHtmlOutputBlock.classList.remove("hidden");
    }
    if (cssOutputBlock) {
      cssTextarea.value = block.css;
      cssOutputBlock.classList.remove("hidden");
    }
    if (jsOutputBlock) {
      jsTextarea.value = block.js;
      jsOutputBlock.classList.remove("hidden");
    }
  });

  const outputBlocks = [htmlOutputBlock];
  if (secondaryHtmlOutputBlock) outputBlocks.push(secondaryHtmlOutputBlock);
  if (cssOutputBlock) outputBlocks.push(cssOutputBlock);
  if (jsOutputBlock) outputBlocks.push(jsOutputBlock);

  outputBlocks.forEach(outputBlock => {
    const copyBtn = outputBlock.querySelector(".copy-btn");
    const textarea = outputBlock.querySelector("textarea");
    copyBtn.addEventListener("click", () => {
      textarea.select();
      copyToClipboard(textarea.value, copyBtn);
    });
  });

  return { tabBtn, panel };
}
