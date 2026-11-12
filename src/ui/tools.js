// The Tools drawer (Upgrade page, Changelog) and its open/close behaviour.
import { makeEl } from "../lib/dom.js";
import { buildUpgradePanel } from "./upgrade-panel.js";
import { buildChangelogPanel } from "./changelog-panel.js";

const TOOLS = [
  ["upgrade", "Upgrade page", buildUpgradePanel],
  ["changelog", "Changelog", buildChangelogPanel],
];

export function initTools() {
  const toolsTabbar = document.getElementById("tools-tabbar");
  const toolsPanels = document.getElementById("tools-panels");
  const toolsMenu = document.getElementById("tools-menu");
  const toolsToggle = document.getElementById("tools-toggle");

  TOOLS.forEach(([key, label, build], index) => {
    const btn = makeEl("button", "tools-tab" + (index === 0 ? " active" : ""), label);
    btn.dataset.toolTarget = key;
    toolsTabbar.appendChild(btn);
    const panel = build();
    panel.classList.toggle("active", index === 0);
    toolsPanels.appendChild(panel);
  });

  toolsTabbar.querySelectorAll(".tools-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      toolsTabbar.querySelectorAll(".tools-tab").forEach((b) => b.classList.remove("active"));
      toolsPanels.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.toolTarget).classList.add("active");
    });
  });

  function setToolsOpen(open) {
    toolsMenu.classList.toggle("open", open);
    toolsToggle.setAttribute("aria-expanded", String(open));
    toolsToggle.hidden = open;
  }
  toolsToggle.addEventListener("click", () => setToolsOpen(true));
  document.getElementById("tools-close").addEventListener("click", () => setToolsOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setToolsOpen(false); });
}
