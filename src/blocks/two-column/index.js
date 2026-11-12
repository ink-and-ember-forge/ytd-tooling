import { loadBlockAsset } from "../../lib/assets.js";
import { indentLines } from "../../lib/html.js";
import { mediaInner } from "../../lib/media.js";

export default {
  id: "two-column",
  label: "Two-column layout",
  description: "One media item in one column, free text (and buttons, or other blocks pasted into the text) in the other. Media sits on the left by default; switch the layout to flip it. Top-aligned on desktop, and stacked with media first on mobile.",
  fields: [
    { type: "select", id: "flip", label: "Layout", default: "media-left",
      options: [
        { value: "media-left", label: "Media left (default)" },
        { value: "media-right", label: "Media right" }
      ] },
    { type: "media-picker", id: "media", label: "Media column", allowNone: false, allowOther: true },
    { type: "rich-text", id: "content", label: "Text column", placeholder: "Write the text for this column, then paste any buttons or other blocks here..." }
  ],
  generateHTML: (values) => {
    const mediaHTML = mediaInner(values.media);
    const flipClass = values.flip === "media-right" ? " two-column--flipped" : "";

    return `<div class="two-column${flipClass}">
  <div class="two-column__media">
    ${mediaHTML}
  </div>
  <div class="two-column__content">
${indentLines(values.content, 4)}
  </div>
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
