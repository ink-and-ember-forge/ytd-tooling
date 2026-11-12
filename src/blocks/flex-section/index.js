import { loadBlockAsset } from "../../lib/assets.js";
import { indentLines } from "../../lib/html.js";
import { mediaInner } from "../../lib/media.js";

export default {
  id: "flex-section",
  label: "Flex-section",
  description: "A genuine two-column layout — left side is always free-form content (the rich text editor), right side is your choice: an image, a video, or another content block from a different tab. Different from image-text-section: this doesn't wrap text around media, it's a true side-by-side split, so the right column is always shown (there's no 'None' option here).",
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
