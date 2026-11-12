import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML } from "../../lib/html.js";
import { newTabAttrs } from "../../lib/links.js";

export default {
  id: "nav-cards",
  label: "Navigation cards",
  description: "A row of cards, two styles available: icon + description + button (only the button is clickable, unlike resource-cards), or numbered heading + plain icon with no button at all. Choose the style once — it applies to every card in the row.",
  fields: [
    { type: "nav-card-items", id: "cardsData", label: "Cards", defaultCount: 3 }
  ],
  warnings: (values) => {
    const { style, cards } = values.cardsData;
    if (style === "numbered") {
      const usable = cards.filter(c => c.heading.trim().length > 0).length;
      return usable === 0
        ? ["Numbered style needs a heading on at least one card, so nothing was generated. Headings are separate from the standard style's description and button label."]
        : [];
    }
    const usable = cards.filter(c => c.buttonLabel.trim().length > 0).length;
    return usable === 0
      ? ["Standard style needs a button label on at least one card, so nothing was generated. Button labels are separate from the numbered style's headings."]
      : [];
  },
  generateHTML: (values) => {
    const { style, autoNumber, cards } = values.cardsData;

    if (style === "numbered") {
      const items = cards.filter(c => c.heading.trim().length > 0);
      const cardsHTML = items.map((c, i) => {
        const numberSpan = autoNumber ? `<span class="nav-card__number">${i + 1}.</span> ` : "";
        const targetAttr = newTabAttrs(c.targetUrl, c.newTab);
        const icon = c.newTab ? ` <i class="fa-solid fa-up-right-from-square button-icon inline-icon"></i>` : "";
        return `  <div class="nav-card nav-card--numbered">
    <a href="${escapeHTML(c.targetUrl.trim())}" class="stretched-link"${targetAttr} aria-label="${escapeHTML(c.heading.trim())}"></a>
    <h3>${numberSpan}${escapeHTML(c.heading.trim())}${icon}</h3>
    <div class="nav-card__icon-plain">
      <img src="${escapeHTML(c.iconUrl.trim())}" alt="${escapeHTML(c.iconAlt.trim())}" />
    </div>
  </div>`;
      }).join("\n");

      return `<div class="nav-cards-grid nav-cards-grid--numbered">
${cardsHTML}
</div>`;
    }

    const items = cards.filter(c => c.buttonLabel.trim().length > 0);
    const cardsHTML = items.map(c => {
      const targetAttr = newTabAttrs(c.buttonUrl, c.newTab);
      const icon = c.newTab ? ` <i class="fa-solid fa-up-right-from-square button-icon inline-icon"></i>` : "";
      return `  <div class="nav-card">
    <div class="nav-card__icon">
      <img src="${escapeHTML(c.iconUrl.trim())}" alt="${escapeHTML(c.iconAlt.trim())}" />
    </div>
    <p>${escapeHTML(c.description.trim())}</p>
    <a href="${escapeHTML(c.buttonUrl.trim())}" class="nav-card__button"${targetAttr}>${escapeHTML(c.buttonLabel.trim())}${icon}</a>
  </div>`;
    }).join("\n");

    return `<div class="nav-cards-grid">
${cardsHTML}
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
