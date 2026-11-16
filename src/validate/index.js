// The code validator. Pure: validate({ html, css, js }) -> { findings, counts }. See docs/VALIDATOR.md.
//
// A finding: { id, severity ("error" | "warning" | "info"), language, line, column, endLine, endColumn, message, why, related[], data }.
// Core checks work on any page. `packs` are optional layers (the template-aware rules will be one): each is a function
// ({ html, css, js, htmlScan, cssScan }) -> findings[].
import { scanHtml } from "./html-scan.js";
import { htmlRules } from "./html-rules.js";
import { scanCss } from "./css-scan.js";
import { cssRules } from "./css-rules.js";
import { SEVERITIES } from "./locate.js";

export { SEVERITIES };
const LANGUAGES = ["html", "css", "js"];

export function validate({ html = "", css = "", js = "" } = {}, { packs = [] } = {}) {
  const htmlScan = scanHtml(html), cssScan = scanCss(css);
  const findings = [
    ...htmlScan.findings, ...htmlRules(htmlScan),
    ...cssScan.findings, ...cssRules(cssScan, { html, js }, htmlScan),
  ];
  for (const pack of packs) findings.push(...pack({ html, css, js, htmlScan, cssScan }));
  findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || LANGUAGES.indexOf(a.language) - LANGUAGES.indexOf(b.language) || a.line - b.line || a.column - b.column);
  const counts = { error: 0, warning: 0, info: 0 };
  findings.forEach((f) => counts[f.severity]++);
  return { findings, counts };
}
