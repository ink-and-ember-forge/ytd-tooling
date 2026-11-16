// The generated code for one block, always up to date: HTML, plus (when the
// block has them) a contents entry, CSS and JS. One tab each. There is ONE Copy button, in the
// card header: it copies whichever tab is showing and is labelled for it (Copy HTML / CSS / JS).
import { initTabs } from "./tabs.js";
import { copyToClipboard } from "../lib/dom.js";
import { toast } from "./toast.js";
import { getPref, setPref } from "./storage.js";

// `explainEl` (optional): the Explain panel's element; it becomes an "Explain" tab beside HTML.
// `onTab(key)` is told whenever a tab is selected ("html", "explain", "css"...).
export function createOutputPanel(block, { explainEl, onTab } = {}) {
  const el = document.createElement("section");
  el.className = "output-card";
  el.setAttribute("aria-label", "Generated code");

  const outputs = [
    { key: "html", tab: "HTML", copy: "Copy HTML", heading: block.htmlOutputLabel || "HTML for this block — paste into .content-body" },
  ];
  if (explainEl) outputs.push({ key: "explain", tab: "Explain", custom: explainEl });
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

  // The header's Copy button stays in reach even when the code is collapsed away, so the
  // preview can have the whole pane without losing the most common action.
  el.innerHTML = `
    <div class="card-head">
      <h3>Code to paste</h3>
      <div class="card-tools">
        <button type="button" class="primary-btn head-copy" data-copy-label="Copy HTML">Copy HTML</button>
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

    tab._key = o.key;
    const body = document.createElement("div");
    body.className = "output-body";
    body.id = `out-${block.id}-${o.key}`;
    if (o.custom) {
      body.classList.add("output-body--explain");
      body.appendChild(o.custom);
      bodies.appendChild(body);
      tab._body = body;
      return;
    }
    body.innerHTML = `
      <p class="output-heading"></p>
      <div class="output-wrap"><textarea rows="8" readonly spellcheck="false"></textarea></div>
      ${o.note ? `<p class="note"></p>` : ""}`;
    body.querySelector(".output-heading").textContent = o.heading;
    if (o.note) body.querySelector(".note").textContent = o.note;
    const area = body.querySelector("textarea");
    area.setAttribute("aria-label", o.heading);
    bodies.appendChild(body);
    areas[o.key] = area;
    tab._body = body;
  });

  const tabs = Array.from(tablist.children);
  const headCopy = el.querySelector(".head-copy");
  let current = outputs[0];
  const tabsApi = initTabs({ tabs, panelFor: (t) => t._body, onSelect: (t) => {
    current = outputs.find((o) => o.key === t._key);
    headCopy.hidden = !current.copy; // the Explain tab has nothing to copy
    if (current.copy) headCopy.dataset.copyLabel = headCopy.textContent = current.copy;
    if (onTab) onTab(t._key);
  } });
  if (tabs.length === 1) tablist.hidden = true;

  // The header's Copy button (copies the tab that is showing) and the collapse toggle.
  // Collapsed state is shared by every block and remembered.
  headCopy.addEventListener("click", async () => {
    try { await copyToClipboard(areas[current.key].value, headCopy); toast(`${current.tab} copied`); }
    catch (e) { toast("Couldn't copy. Open the code and press Ctrl+C."); }
    // copyToClipboard puts back the label it found; if the tab changed meanwhile, that label is stale.
    setTimeout(() => { if (!headCopy.classList.contains("copied")) headCopy.textContent = current.copy || headCopy.textContent; }, 1600);
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
    selectTab(key) { const t = tabs.find((x) => x._key === key); if (t) tabsApi.select(t); },
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
