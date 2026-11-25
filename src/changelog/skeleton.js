// What page skeleton a page has: the template's (one column or with a table of contents) or an older one. Pure: strings in, data out.
//
// The template's skeleton, from getBaseHTML(includeToc, theme):
//   #page-container > nav#breadcrumb-nav + header.header + .main-grid.standard-container > [nav#table-of-contents] + .content-column > h1 + .content-body
// A LANDING page (no table of contents) is the same without the <nav>: getBaseHTML(false, theme) is exactly that.
//
// detectSkeleton(html) -> { kind, hasToc, landing, hasContentColumn, hasContentBody, h1InHeader, issues[] }
//   kind  "template"       has .content-column and .content-body
//         "legacy-header"  the <h1> (and so usually the intro) sits inside <header> and there is no .content-column: an older layout
//         "unknown"        neither
import { scanHtml, attrOf } from "../validate/html-scan.js";

const hasClass = (el, name) => (attrOf(el, "class")?.value || "").split(/\s+/).includes(name);

export function detectSkeleton(html) {
  const { elements } = scanHtml(html);
  const hasContentColumn = elements.some((e) => hasClass(e, "content-column"));
  const hasContentBody = elements.some((e) => hasClass(e, "content-body"));
  const hasToc = elements.some((e) => attrOf(e, "id")?.value === "table-of-contents");
  const h1 = elements.find((e) => e.tag === "h1");
  const h1InHeader = !!h1 && (() => { for (let p = h1.parent; p; p = p.parent) if (p.tag === "header") return true; return false; })();
  const issues = [];
  let kind = "unknown";
  if (hasContentColumn && hasContentBody) kind = "template";
  else if (h1InHeader && !hasContentColumn) {
    kind = "legacy-header";
    issues.push("The page's <h1> (and probably its introduction) is inside <header>, and there is no .content-column or .content-body, which is not the template's skeleton.");
  }
  if (hasContentColumn !== hasContentBody) issues.push(hasContentColumn ? "There is a .content-column but no .content-body inside it." : "There is a .content-body but no .content-column around it.");
  return { kind, hasToc, landing: !hasToc, hasContentColumn, hasContentBody, h1InHeader, issues };
}
