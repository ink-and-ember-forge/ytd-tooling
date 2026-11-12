// Header controls: base-code downloads, ToC toggle, project save/load, template link.
import { downloadText } from "../lib/dom.js";
import { BASE_JS, getBaseCSS, getBaseHTML } from "../base/index.js";
import { getTheme } from "./theme.js";
import { exportProject, importProject, clearAll, getPref, setPref, onSaved } from "./storage.js";
import { toast } from "./toast.js";

export function initTopbar() {
  const includeTocToggle = document.getElementById("include-toc-toggle");
  includeTocToggle.checked = getPref("includeToc", true);
  includeTocToggle.addEventListener("change", () => setPref("includeToc", includeTocToggle.checked));

  document.getElementById("download-html-btn").addEventListener("click", () => {
    const includeToc = includeTocToggle.checked;
    downloadText(includeToc ? "gwella-base-html.txt" : "gwella-base-html-no-toc.txt", getBaseHTML(includeToc, getTheme()));
  });
  document.getElementById("download-css-btn").addEventListener("click", () => {
    const includeToc = includeTocToggle.checked;
    downloadText(includeToc ? "gwella-base-css.txt" : "gwella-base-css-no-toc.txt", getBaseCSS(includeToc));
  });
  document.getElementById("download-js-btn").addEventListener("click", () => {
    downloadText("gwella-base-js.txt", BASE_JS);
  });

  // Opens the reference template in its own window.
  document.getElementById("open-template-btn").addEventListener("click", () => window.open("template/", "_blank"));

  // ---- project: save / load / reset ---------------------------------------
  const status = document.getElementById("save-status");
  onSaved((ok) => {
    status.textContent = ok
      ? "Saved in this browser at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + "."
      : "Couldn't save in this browser (storage is blocked or full). Use Save project to a file.";
  });

  document.getElementById("save-project-btn").addEventListener("click", () => {
    downloadText("gwella-project.json", exportProject());
    toast("Project saved to a file");
  });

  const fileInput = document.getElementById("load-project-input");
  document.getElementById("load-project-btn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const error = importProject(await file.text());
    fileInput.value = "";
    if (error) { toast(error); return; }
    location.reload(); // blocks reload their saved state from storage
  });

  document.getElementById("reset-all-btn").addEventListener("click", () => {
    if (!confirm("Clear every block's form and start again? Save the project to a file first if you might need it.")) return;
    clearAll();
    location.reload();
  });
}
