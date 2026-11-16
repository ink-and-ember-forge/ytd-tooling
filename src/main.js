// Entry point: builds the block tabs and the other views, then wires the header.
import "./ui/navbar-offset.js";
import { BLOCK_LIST } from "./blocks/index.js";
import { buildBlockPanel } from "./ui/block-panel.js";
import { buildUpgradePanel } from "./ui/upgrade-panel.js";
import { buildChangelogPanel } from "./ui/changelog-panel.js";
import { buildValidatePanel } from "./ui/validate-panel.js";
import { initThemeToggle } from "./ui/theme.js";
import { initTopbar } from "./ui/topbar.js";
import { initTabs } from "./ui/tabs.js";
import { initLayout, initMenus } from "./ui/layout.js";
import { getPref, setPref } from "./ui/storage.js";
import { restoreSplitWidth } from "./ui/splitter.js";
import { broadcastActive } from "./ui/preview.js";
import { startTour } from "./ui/tour.js";
import { buildTours } from "./ui/tours.js";
import { showWhatsNew } from "./ui/whats-new.js";
import { recordVisit, markVersionSeen, tourOffered, markTourOffered } from "./ui/visits.js";
import { toast } from "./ui/toast.js";
import { initDeveloperMode, turnOffDeveloperMode } from "./ui/developer.js";
import { compareVersions } from "./lib/versions.js";
import { BUILDER_VERSION } from "./changelog/index.js";

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
// Upgrade and Validate are maintainers' tools: shown only in developer mode (open the page with ?dev, see ui/developer.js).
const devMode = initDeveloperMode();
const main = document.getElementById("main");
if (devMode) {
  main.append(buildUpgradePanel(), buildValidatePanel());
  const off = document.getElementById("dev-off-btn"); // in the Project menu, which has the room the header lacks
  off.hidden = false;
  off.addEventListener("click", turnOffDeveloperMode);
} else {
  document.querySelectorAll(".mode-btn[data-dev]").forEach((b) => b.remove());
}
main.append(buildChangelogPanel());

// ---- guided tours: the header's "? Tour" runs the tour for whichever view is showing ----------
const tourBtn = document.getElementById("tour-btn");
const tours = buildTours({ setRail, devMode });
const currentView = () => document.querySelector(".mode-btn.active").dataset.view;
function runTour(view) {
  const railWasOpen = railToggle.getAttribute("aria-pressed") === "true";
  markTourOffered(view);
  startTour(tours[view], { onEnd: () => setRail(railWasOpen) }); // the tour opens the block list; put it back as it was
}
tourBtn.addEventListener("click", () => runTour(currentView()));

const modeTabs = Array.from(document.querySelectorAll(".mode-btn"));
const viewOf = (btn) => document.getElementById("view-" + btn.dataset.view);
const fromHash = modeTabs.findIndex((b) => "#" + b.dataset.view === location.hash);
const modes = initTabs({
  tabs: modeTabs,
  panelFor: viewOf,
  onSelect: (btn) => {
    document.body.classList.toggle("view-other", btn.dataset.view !== "build"); // the Blocks button only matters while building
    tourBtn.hidden = !tours[btn.dataset.view]; // only views that have a tour (Upgrade and Validate get theirs later)
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

// ---- coming back: tell people what changed since they were last here ----------------------
// A first visit has no "since": offer the tour instead (a toast, not a lightbox, so nothing is in the way).
const visit = recordVisit(BUILDER_VERSION);
if (visit.firstVisit) {
  if (!tourOffered("build")) {
    markTourOffered("build");
    toast("New here? Take a one-minute tour.", { actionLabel: "Show me", onAction: () => runTour("build"), timeout: 12000 });
  }
} else if (compareVersions(visit.lastSeenVersion, BUILDER_VERSION) > 0) {
  markVersionSeen(BUILDER_VERSION); // an older copy of the builder was opened: nothing is new
} else {
  showWhatsNew({
    lastSeenVersion: visit.lastSeenVersion,
    lastVisit: visit.lastVisit,
    onClose: () => markVersionSeen(BUILDER_VERSION), // however it was closed, they have now seen it
    onSeeAll: () => modes.select(modeTabs.find((b) => b.dataset.view === "changelog")),
  });
}
