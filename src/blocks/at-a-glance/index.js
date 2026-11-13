import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML } from "../../lib/html.js";

export default {
  id: "at-a-glance",
  label: "At-a-glance",
  // How the block appears in the builder's tab bar (display only).
  group: "Structure",
  tabLabel: "At a glance",
  // How the upgrade tool recognises this block on a page (class names / ids in its HTML).
  detect: { ids: ["at-a-glance"] },
  description: "A short bulleted summary box that sits above the table of contents on the page.",
  fields: [
    { type: "bullet-list", id: "bullets", label: "Bullet points", defaultCount: 2 }
  ],
  generateHTML: (values) => {
    const items = values.bullets
      .filter(b => b.trim().length > 0)
      .map(b => `    <li>${escapeHTML(b.trim())}</li>`)
      .join("\n");
    return `<div id="at-a-glance">
  <h3 id="at-a-glance-heading">At a glance</h3>
  <ul>
${items}
  </ul>
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
