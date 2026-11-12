import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML, slugify, uniqueSlug, randomId } from "../../lib/html.js";

export default {
  id: "accordion",
  label: "Accordion",
  description: "A stack of expandable items — only one open at a time. This block only builds the structure (titles + correctly-linked ids); the content inside each panel is left as a placeholder for you to fill in — paste generated content from another tab, or write it directly.",
  fields: [
    { type: "text", id: "groupName", label: "Group name (used to build a readable id — leave blank to fall back to a random id)", placeholder: "e.g. Digital literacy resources" },
    { type: "bullet-list", id: "titles", label: "Item titles", defaultCount: 2,
      itemPlaceholder: "Item title", addLabel: "+ Add item" }
  ],
  generateHTML: (values) => {
    const accordionId = values.groupName.trim()
      ? `accordion-${slugify(values.groupName)}`
      : randomId("accordion");
    const titles = values.titles.filter(t => t.trim().length > 0);
    const usedSlugs = new Set();

    const itemsHTML = titles.map(title => {
      const slug = uniqueSlug(slugify(title), usedSlugs);
      const headingId = `heading-${slug}`;
      const collapseId = `collapse-${slug}`;
      return `  <div class="accordion-item">
    <h3 class="accordion-header" id="${headingId}">
      <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
        <span class="accordion-button-text">${escapeHTML(title.trim())}</span>
      </button>
    </h3>
    <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headingId}" data-bs-parent="#${accordionId}">
      <div class="accordion-body">
        <!-- Content goes here -->
      </div>
    </div>
  </div>`;
    }).join("\n");

    return `<div class="accordion" id="${accordionId}">
${itemsHTML}
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
