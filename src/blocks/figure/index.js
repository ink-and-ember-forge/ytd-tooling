import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML } from "../../lib/html.js";

export default {
  id: "figure",
  label: "Figure",
  group: "Content",
  tabLabel: "Figure",
  // How the upgrade tool recognises this block on a page (class names / ids in its HTML).
  detect: { classes: ["figure-block"] },
  description: "One image across the full width of the content column, with an optional caption. For a chart, diagram or table that has to be readable. Pictures that sit beside text belong in Text around media, which floats them small.",
  fields: [
    { type: "text", id: "imageUrl", label: "Image URL", placeholder: "https://..." },
    { type: "text", id: "imageAlt", label: "Alt text (describe what the figure shows)", placeholder: "e.g. Radar chart of the six leadership domains" },
    { type: "text", id: "caption", label: "Caption (optional)", placeholder: "Shown under the image" },
  ],
  warnings: (values) => {
    const w = [];
    if (!(values.imageUrl || "").trim()) w.push("Add an image URL, so nothing was generated.");
    else if (!(values.imageAlt || "").trim()) w.push("A figure is informative, so it needs alt text that says what it shows. Without it a screen reader user gets nothing from it.");
    return w;
  },
  generateHTML: (values) => {
    const url = (values.imageUrl || "").trim();
    if (!url) return "";
    const caption = (values.caption || "").trim();
    return `<figure class="figure-block">
  <img src="${escapeHTML(url)}" alt="${escapeHTML((values.imageAlt || "").trim())}" />${caption ? `\n  <figcaption>${escapeHTML(caption)}</figcaption>` : ""}
</figure>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
