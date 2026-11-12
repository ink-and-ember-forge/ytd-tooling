import { loadBlockAsset } from "../../lib/assets.js";
import { indentLines } from "../../lib/html.js";
import { imageTag, youtubeIframe } from "../../lib/media.js";

export default {
  id: "image-text-section",
  label: "Image-text-section",
  description: "Free-form content — headings, lists, paragraphs, whatever the page needs — with an optional image or video floated alongside it. The content always flows around the media correctly; you don't need to manage that yourself.",
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
