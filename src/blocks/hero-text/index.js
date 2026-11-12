import { loadBlockAsset } from "../../lib/assets.js";
import { indentLines } from "../../lib/html.js";
import { markFirstParagraphLarge } from "../../lib/richtext.js";

export default {
  id: "hero-text",
  label: "Hero text",
  // How the block appears in the builder's tab bar (display only).
  group: "Structure",
  tabLabel: "Intro text",
  description: "Sits just below at-a-glance and just above the first section — one rich text editor, same as elsewhere. The first paragraph you write is automatically rendered larger (1.25em); everything after it is normal size. No separate field for the opening line — the tool finds it for you.",
  fields: [
    { type: "rich-text", id: "content", label: "Content", placeholder: "Write freely — the first paragraph is automatically styled larger..." }
  ],
  generateHTML: (values) => {
    const html = markFirstParagraphLarge(values.content, "hero-text__intro");
    return `<div class="hero-text">
${indentLines(html, 2)}
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
