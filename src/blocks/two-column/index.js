import { loadBlockAsset } from "../../lib/assets.js";
import { indentLines } from "../../lib/html.js";
import { mediaInner } from "../../lib/media.js";

export default {
  id: "two-column",
  label: "Two-column layout",
  // How the block appears in the builder's tab bar (display only).
  group: "Content",
  tabLabel: "Media beside text",
  // How the upgrade tool recognises this block on a page (class names / ids in its HTML).
  detect: { classes: ["two-column"] },
  description: "Media in one column and text in the other, both lined up at the top, with the text column a little wider. You choose which side the media sits on. Best for longer text with a smaller picture beside it. For a balanced, centred, equal split use Equal columns instead.",
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
