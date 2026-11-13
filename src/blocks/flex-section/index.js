import { loadBlockAsset } from "../../lib/assets.js";
import { indentLines } from "../../lib/html.js";
import { mediaInner } from "../../lib/media.js";

export default {
  id: "flex-section",
  label: "Flex-section",
  // How the block appears in the builder's tab bar (display only).
  group: "Content",
  tabLabel: "Equal columns",
  // How the upgrade tool recognises this block on a page (class names / ids in its HTML).
  detect: { classes: ["flex-section"] },
  description: "Text on the left, media on the right, in two equal-width columns that are vertically centred, for a balanced, symmetrical look. The text is always on the left (it can't be flipped) and the media is required. To put the media on the left, or to line it up with the top of the text, use Media beside text instead.",
  fields: [
    { type: "rich-text", id: "content", label: "Left column — content", placeholder: "Write the content for this side..." },
    { type: "media-picker", id: "media", label: "Right column", allowNone: false, allowOther: true }
  ],
  generateHTML: (values) => {
    const mediaHTML = mediaInner(values.media);

    return `<div class="flex-section">
  <div class="text-content">
${indentLines(values.content, 4)}
  </div>
  <div class="video-content">
    ${mediaHTML}
  </div>
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
