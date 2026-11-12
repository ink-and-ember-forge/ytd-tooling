// Link helpers: decide whether a link needs rel="noopener noreferrer", and tidy video URLs.
// Edit INTERNAL_HOSTS when a new domain is used.

export const INTERNAL_HOSTS = [
  "leadershipportal.heiw.wales",
  "nhswalesleadershipportal.heiw.wales",
  "leadershipportal.thinqi-uat.co.uk",
  "ytydysgu.heiw.wales",
  "nhswalesytydysgu.heiw.wales",
  "ytydysgu.thinqi-uat.co.uk",
];

export function linkIsExternal(url) {
  let host;
  try {
    // A dummy base makes relative URLs (/page, #id, page.html) resolve to it.
    const parsed = new URL((url || "").trim(), "https://builder.invalid/");
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    host = parsed.hostname.toLowerCase();
  } catch (e) {
    return false;
  }
  if (host === "builder.invalid") return false;
  return !INTERNAL_HOSTS.some(h => host === h || host.endsWith("." + h));
}

// Attributes for a link, given its URL and whether it opens in a new tab.
export function newTabAttrs(url, newTab) {
  if (!newTab) return "";
  return linkIsExternal(url)
    ? ' target="_blank" rel="noopener noreferrer"'
    : ' target="_blank"';
}

export function toYouTubeEmbed(input) {
  input = (input || "").trim();
  if (input.includes("youtube.com/embed/")) return input;
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
  }
  if (/^[\w-]{11}$/.test(input)) return `https://www.youtube.com/embed/${input}`;
  return input;
}
