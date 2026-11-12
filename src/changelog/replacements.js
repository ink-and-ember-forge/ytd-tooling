// Guided fixes: for a change whose action is "copy", the exact replacement code
// the page needs, taken from the current sources. Pure; tested in test/.
//
// `code` supplies the current code: { html(), css(), js() } for the base files
// and `blocks` (the registry) for block CSS/JS.

export function replacementFor(change, code, blocks) {
  if (change.action !== "copy") return null;
  const scope = change.scope;
  if (scope === "base-css") return { label: "Copy the new base CSS", text: code.css() };
  if (scope === "base-js") return { label: "Copy the new base JS", text: code.js() };
  if (scope === "base-html") return { label: "Copy the new base HTML", text: code.html() };
  if (scope.startsWith("block:")) {
    const block = blocks[scope.slice(6)];
    if (!block || !block.css) return null;
    return { label: `Copy the new ${block.label} CSS`, text: block.css };
  }
  return null;
}
