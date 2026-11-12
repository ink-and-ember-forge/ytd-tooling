// Loads a text file that sits next to the code that needs it (block CSS, base
// HTML, the changelog...). Works in the browser (fetch) and in Node (fs), so the
// same modules run in the builder, the build scripts and the tests.
//
// One trailing newline is dropped: files end with one by convention, the
// strings the builder hands out do not.

const isNode = typeof process !== "undefined" && !!process.versions?.node && typeof window === "undefined";

export async function loadText(url) {
  let text;
  if (isNode) {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    text = readFileSync(fileURLToPath(url), "utf8");
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
    text = await res.text();
  }
  return text.replace(/\n$/, "");
}

// loadBlockAsset(import.meta.url, "block.css") reads src/blocks/<id>/block.css
export const loadBlockAsset = (moduleUrl, fileName) => loadText(new URL(fileName, moduleUrl));
