// The generated code for one block, always up to date: HTML, plus (when the
// block has them) a contents entry, CSS and JS. One tab each, with a Copy button.
import { initTabs } from "./tabs.js";
import { copyToClipboard } from "../lib/dom.js";
import { toast } from "./toast.js";
import { getPref, setPref } from "./storage.js";

export function createOutputPanel(block) {
  const el = document.createElement("section");
  el.className = "output-card";
  el.setAttribute("aria-label", "Generated code");

  const outputs = [
    { key: "html", tab: "HTML", copy: "Copy HTML", heading: block.htmlOutputLabel || "HTML for this block — paste into .content-body" },
  ];
  if (block.secondaryHTML) {
    outputs.push({ key: "secondary", tab: "Contents entry", copy: "Copy entry", heading: block.secondaryHTML.label });
  }
  if (block.css) {
    outputs.push({ key: "css", tab: "CSS", copy: "Copy CSS", heading: "CSS for this block — paste inside #page-container { ... }",
      note: "Only styles this one block. It doesn't include the base page styling, which you already have from the Base CSS download." });
  }
  if (block.js) {
    outputs.push({ key: "js", tab: "JS", copy: "Copy JS", heading: "JS for this block — paste inside the Base JS script block",
      note: "Doesn't include its own <script> tags: add it inside the script block from Base JS, not as a separate one. Only needed once even if this block appears several times on the page." });
  }

  // The header keeps "Copy HTML" in reach even when the code is collapsed away, so the
  // preview can have the whole pane without losing the most common action.
  el.innerHTML = `
    <div class="card-head">
      <h3>Code to paste</h3>
      <div class="card-tools">
        <button type="button" class="primary-btn head-copy">Copy HTML</button>
        <button type="button" class="collapse-btn" aria-expanded="true" title="Show or hide the code">▾</button>
      </div>
    </div>
    <div class="output-warning" role="status" hidden></div>
    <div class="output-tabs" role="tablist" aria-label="Code type"></div>
    <div class="output-bodies"></div>`;
  const tablist = el.querySelector(".output-tabs");
  const bodies = el.querySelector(".output-bodies");
  const warningBox = el.querySelector(".output-warning");
  const areas = {};

  outputs.forEach((o) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "output-tab";
    tab.textContent = o.tab;
    tablist.appendChild(tab);

    const body = document.createElement("div");
    body.className = "output-body";
    body.id = `out-${block.id}-${o.key}`;
    body.innerHTML = `
      <p class="output-heading"></p>
      <div class="output-wrap"><button type="button" class="copy-btn"></button><textarea rows="8" readonly spellcheck="false"></textarea></div>
      ${o.note ? `<p class="note"></p>` : ""}`;
    body.querySelector(".output-heading").textContent = o.heading;
    if (o.note) body.querySelector(".note").textContent = o.note;
    const copyBtn = body.querySelector(".copy-btn");
    copyBtn.textContent = o.copy;
    if (o.key === "html") copyBtn.hidden = true; // the card header's "Copy HTML" is always in view
    const area = body.querySelector("textarea");
    area.setAttribute("aria-label", o.heading);
    copyBtn.addEventListener("click", async () => {
      area.select();
      try { await copyToClipboard(area.value, copyBtn); toast(`${o.tab} copied`); }
      catch (e) { toast("Couldn't copy. Select the code and press Ctrl+C."); }
    });
    bodies.appendChild(body);
    areas[o.key] = area;
    tab._body = body;
  });

  const tabs = Array.from(tablist.children);
  initTabs({ tabs, panelFor: (t) => t._body });
  if (tabs.length === 1) tablist.hidden = true;

  // Header "Copy HTML" (always visible) and the collapse toggle. Collapsed state is shared by
  // every block and remembered.
  const headCopy = el.querySelector(".head-copy");
  headCopy.addEventListener("click", async () => {
    try { await copyToClipboard(areas.html.value, headCopy); toast("HTML copied"); }
    catch (e) { toast("Couldn't copy. Open the code and press Ctrl+C."); }
  });
  const collapseBtn = el.querySelector(".collapse-btn");
  const setCollapsed = (collapsed) => {
    el.classList.toggle("is-collapsed", collapsed);
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    collapseBtn.textContent = collapsed ? "▸" : "▾";
  };
  collapseBtn.addEventListener("click", () => {
    const collapsed = !el.classList.contains("is-collapsed");
    setPref("codeCollapsed", collapsed);
    document.querySelectorAll(".output-card").forEach((card) => card._setCollapsed && card._setCollapsed(collapsed));
  });
  el._setCollapsed = setCollapsed;
  setCollapsed(getPref("codeCollapsed", false));

  return {
    el,
    // { html, secondary, warnings } from the generator; css/js are static.
    update({ html, secondary, warnings = [] }) {
      areas.html.value = html;
      if (areas.secondary) areas.secondary.value = secondary;
      if (areas.css) areas.css.value = block.css;
      if (areas.js) areas.js.value = block.js;
      warningBox.textContent = warnings.join(" ");
      warningBox.hidden = warnings.length === 0;
    },
  };
}
