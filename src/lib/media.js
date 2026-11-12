// Shared media rendering for blocks that take an image, a video or "another content block".
import { escapeHTML } from "./html.js";
import { toYouTubeEmbed } from "./links.js";

export const IFRAME_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

export function youtubeIframe(videoUrl) {
  return `<iframe src="${escapeHTML(toYouTubeEmbed(videoUrl))}" title="YouTube video player" frameborder="0" allow="${IFRAME_ALLOW}" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
}

export function imageTag(media, classAttr = "") {
  return `<img${classAttr} src="${escapeHTML(media.imageUrl.trim())}" alt="${escapeHTML(media.imageAlt.trim())}" />`;
}

// The inner HTML of a media column: <img>, <iframe>, a placeholder comment, or "".
export function mediaInner(media) {
  if (media.type === "image" && media.imageUrl.trim()) return imageTag(media);
  if (media.type === "video" && media.videoUrl.trim()) return youtubeIframe(media.videoUrl);
  if (media.type === "other") return `<!-- CONTENT BLOCK GOES HERE -->`;
  return "";
}
