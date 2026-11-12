import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML, slugify, uniqueSlug, randomId } from "../../lib/html.js";

export default {
  id: "icon-toggle",
  label: "Icon-toggle",
  // How the block appears in the builder's tab bar (display only).
  group: "Interactive",
  tabLabel: "Icon panels",
  description: "A grid of clickable icons; clicking one reveals its own content panel below (and closes any other open panel). Content is left as a placeholder for you to fill in, same as accordion. Note: only one icon-toggle group per page — the click behaviour tracks 'the currently open panel' globally, not per-group.",
  fields: [
    { type: "text", id: "groupName", label: "Group name (used to build a readable id — leave blank to fall back to a random id)", placeholder: "e.g. Communication scenarios" },
    { type: "icon-toggle-items", id: "items", label: "Icons", defaultCount: 3 }
  ],
  generateHTML: (values) => {
    const gridId = values.groupName.trim()
      ? `data-icons-grid-${slugify(values.groupName)}`
      : randomId("data-icons-grid");
    const items = values.items.filter(it => it.label.trim().length > 0);
    const usedSlugs = new Set();

    const contentIds = items.map(item => `content-${uniqueSlug(slugify(item.label), usedSlugs)}`);

    const triggersHTML = items.map((item, i) => {
      const contentId = contentIds[i];
      return `  <div class="data-icon-trigger" onclick="openAccordion(this, '${contentId}')" onkeydown="openAccordionKey(event, this, '${contentId}')" tabindex="0">
    <div class="data-icon-card">
      <img src="${escapeHTML(item.iconUrl.trim())}" alt="${escapeHTML(item.iconAlt.trim())}" />
      <h5>${escapeHTML(item.label.trim())}</h5>
    </div>
  </div>`;
    }).join("\n");

    const panelsHTML = items.map((item, i) => {
      const contentId = contentIds[i];
      const panelImage = item.separateImage && item.panelImageUrl.trim()
        ? item.panelImageUrl.trim()
        : item.iconUrl.trim();
      return `<div class="content-display" id="${contentId}">
  <div class="content-display-inner-grid">
    <div>
      <!-- Content goes here -->
    </div>
    <img src="${escapeHTML(panelImage)}" alt="${escapeHTML(item.iconAlt.trim())}" />
  </div>
</div>`;
    }).join("\n");

    return `<div class="data-icons-grid" id="${gridId}">
${triggersHTML}
</div>
${panelsHTML}`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  js: await loadBlockAsset(import.meta.url, "block.js"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
