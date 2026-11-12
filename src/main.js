// Entry point: builds the block tabs and the other views, then wires the header.
import "./ui/navbar-offset.js";
import { BLOCK_LIST } from "./blocks/index.js";
import { buildBlockPanel } from "./ui/block-panel.js";
import { buildUpgradePanel } from "./ui/upgrade-panel.js";
import { buildChangelogPanel } from "./ui/changelog-panel.js";
import { initThemeToggle } from "./ui/theme.js";
import { initTopbar } from "./ui/topbar.js";
import { initTabs } from "./ui/tabs.js";
import { initLayout, initMenus } from "./ui/layout.js";
import { getPref, setPref } from "./ui/storage.js";
import { restoreSplitWidth } from "./ui/splitter.js";
import { broadcastActive } from "./ui/preview.js";

restoreSplitWidth(); // before the panels are built, so each starts at the saved width

// ---- block tabs, grouped by purpose ------------------------------------------
const GROUP_ORDER = ["Structure", "Content", "Interactive", "Links"];
const tabbar = document.getElementById("tabbar");
const panelsEl = document.getElementById("panels");
const blockTabs = [];

const groups = GROUP_ORDER.map((name) => [name, BLOCK_LIST.filter((b) => b.group === name)]);
const ungrouped = BLOCK_LIST.filter((b) => !GROUP_ORDER.includes(b.group));
if (ungrouped.length) groups.push(["Other", ungrouped]);

groups.forEach(([name, blocks]) => {
  if (!blocks.length) return;
  const group = document.createElement("div");
  group.className = "tab-group";
  group.setAttribute("role", "presentation");
  const label = document.createElement("span");
  label.className = "tab-group-label";
  label.setAttribute("aria-hidden", "true");
  label.textContent = name;
  group.appendChild(label);
  blocks.forEach((block) => {
    const panel = buildBlockPanel(block);
    panelsEl.appendChild(panel);
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab-btn";
    tab.textContent = block.tabLabel || block.label;
    tab.title = (block.description || "").split(/(?<=\.)\s/)[0];
    tab.dataset.block = block.id;
    tab._panel = panel;
    group.appendChild(tab);
    blockTabs.push(tab);
  });
  tabbar.appendChild(group);
});

const lastBlock = blockTabs.findIndex((t) => t.dataset.block === getPref("lastBlock", ""));
initTabs({
  tabs: blockTabs,
  panelFor: (t) => t._panel,
  onSelect: (t) => { setPref("lastBlock", t.dataset.block); broadcastActive(); }, // the pop-out follows the active block
  initial: Math.max(0, lastBlock),
  bothAxes: true,
});

// ---- show/hide the block rail (wide screens) ------------------------------------
const railToggle = document.getElementById("rail-toggle");
function setRail(open) {
  document.body.classList.toggle("rail-collapsed", !open);
  railToggle.setAttribute("aria-pressed", String(open));
  setPref("railOpen", open);
}
railToggle.addEventListener("click", () => setRail(railToggle.getAttribute("aria-pressed") !== "true"));
// On small laptop windows the rail starts hidden, so the preview can show the page at true size.
setRail(getPref("railOpen", window.innerWidth >= 1400));

// ---- views: build / upgrade / what's changed ----------------------------------
const main = document.getElementById("main");
main.append(buildUpgradePanel(), buildChangelogPanel());

const modeTabs = Array.from(document.querySelectorAll(".mode-btn"));
const viewOf = (btn) => document.getElementById("view-" + btn.dataset.view);
const fromHash = modeTabs.findIndex((b) => "#" + b.dataset.view === location.hash);
const modes = initTabs({
  tabs: modeTabs,
  panelFor: viewOf,
  onSelect: (btn) => {
    document.body.classList.toggle("view-other", btn.dataset.view !== "build"); // the Blocks button only matters while building
    history.replaceState(null, "", btn.dataset.view === "build" ? location.pathname + location.search : "#" + btn.dataset.view);
  },
  initial: Math.max(0, fromHash),
});
window.addEventListener("hashchange", () => {
  const tab = modeTabs.find((b) => "#" + b.dataset.view === location.hash) || modeTabs[0];
  modes.select(tab);
});

initThemeToggle();
initTopbar();
initMenus();
initLayout();
