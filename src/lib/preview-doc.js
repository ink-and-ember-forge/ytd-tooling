// Builds the HTML document shown in a block's live-preview iframe.

export function buildPreviewDoc(block, html, css, js, theme, baseCss) {
  const baseRules = baseCss.replace(/<\/?style>/g, "");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.0/css/all.min.css" />
<style>
  :root { --thinqi-navbar-height: 0px; --anchor-section-offset: 0px; }
  body { margin: 0; padding: 1.25rem; background: #fff; }
  ${baseRules}
  ${css || ""}
</style>
</head>
<body>
<div id="page-container" class="${theme}">
${html}
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"><\/script>
${js ? `<script>\n${js}\n<\/script>` : ""}
</body>
</html>`;
}
