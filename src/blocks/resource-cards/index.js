import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML } from "../../lib/html.js";
import { newTabAttrs } from "../../lib/links.js";

export default {
  id: "resource-cards",
  label: "Resource cards",
  // How the block appears in the builder's tab bar (display only).
  group: "Links",
  tabLabel: "Resource cards",
  description: "A grid of linked resource cards — image, title, type, and an optional duration/length. Generates just the card grid; wrap it in your own <section> with a heading, same as every other block.",
  fields: [
    { type: "resource-card-items", id: "cards", label: "Cards", defaultCount: 2 }
  ],
  generateHTML: (values) => {
    const cards = values.cards.filter(c => c.title.trim().length > 0);
    const cardsHTML = cards.map(c => {
      const targetAttr = newTabAttrs(c.linkUrl, c.newTab);
      const durationHTML = c.duration.trim()
        ? `<span>${escapeHTML(c.duration.trim())}</span>`
        : "";
      return `  <div class="card">
    <img src="${escapeHTML(c.imageUrl.trim())}" alt="${escapeHTML(c.imageAlt.trim())}" class="resource-card__img" />
    <div>
      <a href="${escapeHTML(c.linkUrl.trim())}" class="stretched-link"${targetAttr}>
        <strong>${escapeHTML(c.title.trim())} <i class="fa-solid fa-up-right-from-square"></i></strong>
      </a>
      <p><strong>${escapeHTML(c.type.trim())}</strong>${durationHTML}</p>
    </div>
  </div>`;
    }).join("\n");

    return `<div class="cards-grid">
${cardsHTML}
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
