import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML } from "../../lib/html.js";
import { newTabAttrs } from "../../lib/links.js";

export default {
  id: "buttons",
  label: "Buttons",
  // How the block appears in the builder's tab bar (display only).
  group: "Links",
  tabLabel: "Buttons",
  // How the upgrade tool recognises this block on a page (class names / ids in its HTML).
  detect: { classes: ["buttons"] },
  description: "A row of call-to-action buttons (e.g. 'Sign the pledge'). Wraps as needed on smaller screens.",
  fields: [
    { type: "button-items", id: "buttons", label: "Buttons", defaultCount: 1 }
  ],
  generateHTML: (values) => {
    const buttons = values.buttons.filter(b => b.label.trim().length > 0);
    const buttonsHTML = buttons.map(b => {
      const label = escapeHTML(b.label.trim());
      const targetAttr = newTabAttrs(b.url, b.newTab);
      const ariaSuffix = b.newTab ? " (opens in a new tab)" : "";
      const icon = b.newTab ? `\n    <i class="fa-solid fa-up-right-from-square button-icon inline-icon"></i>` : "";
      return `  <a href="${escapeHTML(b.url.trim())}"${targetAttr} aria-label="${label}${ariaSuffix}">
    ${label}${icon}
  </a>`;
    }).join("\n");

    return `<div class="buttons">
${buttonsHTML}
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
