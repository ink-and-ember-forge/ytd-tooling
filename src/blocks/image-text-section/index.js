import { loadBlockAsset } from "../../lib/assets.js";
import { indentLines } from "../../lib/html.js";
import { imageTag, youtubeIframe } from "../../lib/media.js";

export default {
  id: "image-text-section",
  label: "Image-text-section",
  // How the block appears in the builder's tab bar (display only).
  group: "Content",
  tabLabel: "Text around media",
  description: "Text that wraps around a small image or video and flows underneath it once it passes the media's height. Use it when the writing is the main thing and the media is a supporting extra. The media is optional. If you want a clean side-by-side split instead, use Equal columns or Media beside text.",
  fields: [
    { type: "media-picker", id: "media", label: "Media", allowSize: true },
    { type: "rich-text", id: "content", label: "Content", placeholder: "Write the content that sits alongside the image or video..." }
  ],
  generateHTML: (values) => {
    const media = values.media;
    let mediaHTML = "";
    if (media.type === "image" && media.imageUrl.trim()) {
      const sizeClass = media.imageSize === "large" ? ' class="media-large"' : "";
      mediaHTML = `  ${imageTag(media, sizeClass)}\n`;
    } else if (media.type === "video" && media.videoUrl.trim()) {
      mediaHTML = `  ${youtubeIframe(media.videoUrl)}\n`;
    }

    return `<div class="image-text-section">
${mediaHTML}  <div>
${indentLines(values.content, 4)}
  </div>
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
