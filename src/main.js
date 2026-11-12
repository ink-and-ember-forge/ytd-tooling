// Entry point: builds the block tabs, then wires the header and the tools drawer.
import "./ui/navbar-offset.js";
import { BLOCK_LIST } from "./blocks/index.js";
import { buildBlockPanel } from "./ui/block-panel.js";
import { initThemeToggle } from "./ui/theme.js";
import { initTopbar } from "./ui/topbar.js";
import { initTools } from "./ui/tools.js";

const tabbar = document.getElementById("tabbar");
const panelsEl = document.getElementById("panels");

BLOCK_LIST.forEach((block, index) => {
  const { tabBtn, panel } = buildBlockPanel(block, index);
  tabbar.appendChild(tabBtn);
  panelsEl.appendChild(panel);
});

tabbar.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    tabbar.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    panelsEl.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.tabTarget).classList.add("active");
  });
});

initThemeToggle();
initTopbar();
initTools();
