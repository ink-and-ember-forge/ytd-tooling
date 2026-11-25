import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML, slugify, uniqueSlug, randomId } from "../../lib/html.js";

export default {
  id: "accordion",
  label: "Accordion",
  // How the block appears in the builder's tab bar (display only).
  group: "Interactive",
  tabLabel: "Accordion",
  // How the upgrade tool recognises this block on a page (class names / ids in its HTML).
  detect: { classes: ["accordion"] },
  description: "A stack of expandable items — only one open at a time. This block only builds the structure (titles + correctly-linked ids); the content inside each panel is left as a placeholder for you to fill in — paste generated content from another tab, or write it directly.",
  fields: [
    { type: "text", id: "groupName", label: "Group name (used to build a readable id — leave blank to fall back to a random id)", placeholder: "e.g. Digital literacy resources" },
    { type: "select", id: "level", label: "Heading level (one below the heading this accordion sits under: h3 under an h2, h4 under an h3)", default: "h3",
      options: [
        { value: "h3", label: "h3 (accordion sits under an h2) (default)" },
        { value: "h4", label: "h4 (accordion sits under an h3)" },
        { value: "h5", label: "h5 (accordion sits under an h4)" }
      ] },
    { type: "bullet-list", id: "titles", label: "Item titles", defaultCount: 2,
      itemPlaceholder: "Item title", addLabel: "+ Add item" }
  ],
  generateHTML: (values) => {
    const accordionId = values.groupName.trim()
      ? `accordion-${slugify(values.groupName)}`
      : randomId("accordion");
    const level = ["h3", "h4", "h5"].includes(values.level) ? values.level : "h3"; // a project saved before the option existed has none
    const titles = values.titles.filter(t => t.trim().length > 0);
    const usedSlugs = new Set();

    const itemsHTML = titles.map(title => {
      const slug = uniqueSlug(slugify(title), usedSlugs);
      // Scoped by the accordion's own id, so two accordions on one page with an item of the same name never share an id.
      const headingId = `${accordionId}-heading-${slug}`;
      const collapseId = `${accordionId}-collapse-${slug}`;
      return `  <div class="accordion-item">
    <${level} class="accordion-header" id="${headingId}">
      <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
        <span class="accordion-button-text">${escapeHTML(title.trim())}</span>
      </button>
    </${level}>
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
  explain: JSON.parse(await loadBlockAsset(import.meta.url, "explain.json")),
};
