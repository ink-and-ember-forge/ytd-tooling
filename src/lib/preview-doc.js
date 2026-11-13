// Builds the HTML document shown in a block's live-preview iframe.
import { BOOTSTRAP_CSS, BOOTSTRAP_JS, FONT_AWESOME_CSS } from "./cdn.js";

export function buildPreviewDoc(block, html, css, js, theme, baseCss) {
  const baseRules = baseCss.replace(/<\/?style>/g, "");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="${BOOTSTRAP_CSS}" rel="stylesheet">
<link rel="stylesheet" href="${FONT_AWESOME_CSS}" />
<style>
  :root { --thinqi-navbar-height: 0px; --anchor-section-offset: 0px; }
  body { margin: 0; padding: 0.5rem; background: #fff; }
  /* On a real desktop page a block sits in a ~600px column (3fr of the page grid in
     .main-grid), not the full width, so show it that wide. Below 769px the base CSS goes
     single column and fills the width, which is also what happens here. */
  @media (min-width: 769px) { #page-container { max-width: 600px; } }
  ${baseRules}
  ${css || ""}
</style>
</head>
<body>
<div id="page-container" class="${theme}">
${html}
</div>
<script src="${BOOTSTRAP_JS}"><\/script>
${js ? `<script>\n${js}\n<\/script>` : ""}
</body>
</html>`;
}
