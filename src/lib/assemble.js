// Builds the complete template stylesheet and script from the base code plus
// every block. Used by `npm run build` (writes template/) and by the tests
// (check that template/ is up to date). Pure: no file access.

const MARKER = /\n?\s*\/\* =+\s*\n\s*PLACE NEW BLOCK CSS ABOVE THIS LINE/;

// Block CSS goes inside #page-container, just above the marker in base.css.
export function assembleCSS(baseCssSource, blocks) {
  const m = baseCssSource.match(MARKER);
  if (!m) throw new Error("base.css has no 'PLACE NEW BLOCK CSS ABOVE THIS LINE' marker");
  const blockCss = blocks.filter((b) => b.css).map((b) => b.css).join("\n\n");
  return baseCssSource.slice(0, m.index) + "\n\n" + blockCss + baseCssSource.slice(m.index);
}

// Block JS is appended to the base script (the Base JS has no closing tag in the file).
export function assembleJS(baseJsSource, blocks) {
  const blockJs = blocks.filter((b) => b.js).map((b) => b.js).join("\n\n");
  return baseJsSource.replace(/\s+$/, "") + "\n\n" + blockJs + "\n";
}
