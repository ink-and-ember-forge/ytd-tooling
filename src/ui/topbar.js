// Header controls: base-code downloads, ToC toggle and the template link.
import { downloadText } from "../lib/dom.js";
import { BASE_JS, getBaseCSS, getBaseHTML } from "../base/index.js";
import { getTheme } from "./theme.js";

export function initTopbar() {
  const includeTocToggle = document.getElementById("include-toc-toggle");

  document.getElementById("download-html-btn").addEventListener("click", () => {
    const includeToc = includeTocToggle.checked;
    const filename = includeToc ? "gwella-base-html.txt" : "gwella-base-html-no-toc.txt";
    downloadText(filename, getBaseHTML(includeToc, getTheme()));
  });

  document.getElementById("download-css-btn").addEventListener("click", () => {
    const includeToc = includeTocToggle.checked;
    const filename = includeToc ? "gwella-base-css.txt" : "gwella-base-css-no-toc.txt";
    downloadText(filename, getBaseCSS(includeToc));
  });

  document.getElementById("download-js-btn").addEventListener("click", () => {
    downloadText("gwella-base-js.txt", BASE_JS);
  });

  // Opens the reference template in its own window.
  document.getElementById("open-template-btn").addEventListener("click", () => {
    window.open("template/", "_blank");
  });
}
