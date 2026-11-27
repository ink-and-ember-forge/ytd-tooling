// The template pack: rules that only make sense for a page built from the Gwella template. Optional and switchable
// (`validate(page, { packs: [templatePack] })`); the core checks stay usable on any page. Pure.
//
// A pack is a function ({ html, css, js, htmlScan, cssScan }) -> findings[].
//
//   template/block-css-missing     error    block markup is on the page but the block's CSS is not (or only part of it)
//   template/block-js-missing      error    block markup is on the page but its JS functions are not defined
//   template/block-css-outdated    info     the block's CSS is there but differs from the current template's
//   template/image-text-children   warning  .image-text-section holds more than one media element and one <div>
//   template/empty-href            warning  href="" or href="#"
//   template/img-no-alt            warning  <img> with no alt attribute at all
//   template/blank-no-label        warning  target="_blank" with no "(opens in a new tab)" in its name or text
//   template/blank-no-rel          warning  target="_blank" to an external host without rel="noopener noreferrer" (internal hosts: not required)
//   template/heading-before-h1     warning  a heading earlier in the document than the page's first <h1>
//   template/heading-skip          warning  a heading more than one level deeper than the one before it (h2 -> h4)
//   template/accordion-header-not-heading  warning  .accordion-header on something that is not an h1-h6
//   template/uat-host              warning  a link to a non-production host (*.thinqi-uat.co.uk)
//   template/mixed-portal-host     warning  links to both leadershipportal.heiw.wales and nhswalesleadershipportal.heiw.wales
//   template/table-no-scroll-wrapper  warning  a <table> that is not inside the scrolling box (class table-scroll), so a wide one widens the page on a phone
//   template/duplicate-library     error / warning  the Bootstrap JS (error) or CSS / Font Awesome (warning) is loaded twice
import { makeFinding, relatedAt } from "./locate.js";
import { attrOf } from "./html-scan.js";
import { BLOCK_LIST } from "../blocks/index.js";
import { getPageCSS } from "../base/index.js";
import { linkIsExternal } from "../lib/links.js";
import { hasCurrentMarkup } from "../changelog/upgrade.js";
import { parseCss, findNode, serializeCss, stripStyleTags } from "../changelog/css-tree.js";
import { splitOverrides } from "../changelog/local-edits.js";

const CONTAINER = "#page-container";
const MEDIA = new Set(["img", "picture", "figure", "video", "iframe", "svg"]);
const textOf = (html, el) => html.slice(el.openEnd, el.closeStart ?? el.end ?? el.openEnd).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const hostOf = (href) => { const m = (href || "").match(/^(?:https?:)?\/\/([^/?#:\s]+)/i); return m ? m[1].toLowerCase() : null; };
const squash = (s) => s.replace(/\s+/g, " ").trim();
const rootsOf = (css) => parseCss(css).children.map((c) => c.selector);

export function templatePack({ html, css, js, htmlScan }, { blocks = BLOCK_LIST } = {}) {
  const { elements, loc } = htmlScan;
  const findings = [];
  const add = (id, severity, start, end, message, extra) => findings.push(makeFinding(loc, "html", id, severity, start, end, message, extra));

  // ---- block code present for the block markup on the page (the migration assembles code before the author rebuilds blocks) ----
  const used = blocks.filter((b) => hasCurrentMarkup(html, b));
  if (used.length) {
    const pageCss = stripStyleTags(splitOverrides(css).css);
    const tree = parseCss(pageCss);
    const standard = (b) => parseCss(getPageCSS(true, [b]));
    for (const b of used) {
      if (b.css) {
        const roots = [...new Set(rootsOf(b.css))];
        const missing = roots.filter((r) => !findNode(tree, [CONTAINER, r]));
        if (missing.length) {
          findings.push({ id: "template/block-css-missing", severity: "error", language: "css", line: 1, column: 1, endLine: 1, endColumn: 1,
            message: `The ${b.label} block is on the page, but ${missing.length === roots.length ? "its CSS is not" : `part of its CSS is missing (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ", …" : ""})`}.`,
            why: "The block renders unstyled (an icon at full size, a grid collapsed). This usually happens when blocks are rebuilt after the CSS was assembled: re-assemble the CSS and JS from the final HTML.", related: [], data: { block: b.id, missing } });
        } else {
          const std = standard(b);
          const differs = roots.filter((r) => { const a = findNode(tree, [CONTAINER, r]), s = findNode(std, [CONTAINER, r]); return a && s && squash(serializeCss(a)) !== squash(serializeCss(s)); });
          if (differs.length) findings.push({ id: "template/block-css-outdated", severity: "info", language: "css", line: 1, column: 1, endLine: 1, endColumn: 1,
            message: `The ${b.label} block's CSS differs from the current template's (${differs.slice(0, 3).join(", ")}${differs.length > 3 ? ", …" : ""}).`,
            why: "Either the page was built on an older version, or its CSS was edited by hand. Run it through Upgrade a page to see which.", related: [], data: { block: b.id, rules: differs } });
        }
      }
      if (b.js) {
        const fns = [...b.js.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
        const gone = fns.filter((n) => !new RegExp(`function\\s+${n}\\s*\\(`).test(js));
        if (gone.length) findings.push({ id: "template/block-js-missing", severity: "error", language: "js", line: 1, column: 1, endLine: 1, endColumn: 1,
          message: `The ${b.label} block is on the page, but its script does not define ${gone.join(", ")}.`,
          why: "The block's controls throw or do nothing. Re-assemble the JS from the final HTML.", related: [], data: { block: b.id, missing: gone } });
      }
    }
  }

  // ---- .image-text-section: one media element and one <div> ----
  for (const el of elements) {
    const cls = (attrOf(el, "class")?.value || "").split(/\s+/);
    if (el.tag !== "div" || !cls.includes("image-text-section")) continue;
    const kids = el.children.filter((c) => c.tag);
    const firstMedia = kids.find((c) => MEDIA.has(c.tag)), firstDiv = kids.find((c) => c.tag === "div");
    const extra = kids.filter((c) => c !== firstMedia && c !== firstDiv);
    if (extra.length) {
      const first = extra[0];
      add("template/image-text-children", "warning", first.start, first.openEnd, `.image-text-section should hold at most one image and one text <div>, but it also holds a <${first.tag}>${extra.length > 1 ? ` and ${extra.length - 1} more` : ""}.`, {
        why: "The extra elements sit outside the text column and break the layout. This usually means the text <div> was closed too early or never closed.", related: [relatedAt(loc, "html", el.start, "the .image-text-section")], data: { tags: extra.map((e) => e.tag) } });
    }
  }

  // ---- links, images, new tabs ----
  for (const el of elements) {
    if (el.tag === "a") {
      const href = attrOf(el, "href");
      if (href && href.value !== null && /^\s*#?\s*$/.test(href.value)) add("template/empty-href", "warning", href.start, href.end, `This link has ${href.value.trim() === "#" ? 'href="#"' : "an empty href"}, so it goes nowhere.`, { why: "A link that goes nowhere is announced as a link and scrolls or reloads the page." });
      const target = attrOf(el, "target");
      if (target?.value === "_blank") {
        const name = `${attrOf(el, "aria-label")?.value || ""} ${textOf(html, el)}`;
        if (!/opens in a new (tab|window)/i.test(name)) add("template/blank-no-label", "warning", target.start, target.end, 'This link opens a new tab but does not say so (no "(opens in a new tab)" in its aria-label or text).', { why: "Screen reader users are not told the page they are on will be left behind." });
        const rel = (attrOf(el, "rel")?.value || "").split(/\s+/);
        // External hosts only (owner's decision): the platform's own hosts are trusted (INTERNAL_HOSTS in src/lib/links.js).
        if (href?.value && linkIsExternal(href.value) && !(rel.includes("noopener") && rel.includes("noreferrer"))) add("template/blank-no-rel", "warning", target.start, target.end, 'This link to another site opens a new tab without rel="noopener noreferrer".', { why: "The new page gets a handle on this one (window.opener) and is told where the reader came from." });
      }
      const host = hostOf(href?.value);
      if (host && /(^|\.)thinqi-uat\.co\.uk$/.test(host)) add("template/uat-host", "warning", href.valueStart, href.valueEnd, `This link goes to ${host}, a test (UAT) host.`, { why: "Readers on the live site would be sent to a system they cannot use." });
    }
    if (el.tag === "img" && !attrOf(el, "alt")) add("template/img-no-alt", "warning", el.start, el.openEnd, "This image has no alt attribute.", { why: 'Without one, a screen reader reads out the file name. Use alt="" for a purely decorative image.' });
  }

  // ---- hosts: one portal host per page ----
  const portal = new Map();
  for (const el of elements) if (el.tag === "a") {
    const href = attrOf(el, "href"), host = hostOf(href?.value);
    if (host === "leadershipportal.heiw.wales" || host === "nhswalesleadershipportal.heiw.wales") portal.set(host, [...(portal.get(host) || []), href]);
  }
  if (portal.size > 1) {
    const [major, minor] = [...portal].sort((a, b) => b[1].length - a[1].length);
    for (const h of minor[1]) add("template/mixed-portal-host", "warning", h.valueStart, h.valueEnd, `This link uses ${minor[0]}, but ${major[1].length} other link(s) use ${major[0]}.`, { why: "The two hosts are different sites; pick one.", related: [relatedAt(loc, "html", major[1][0].valueStart, `uses ${major[0]}`)] });
  }

  // ---- headings ----
  const headings = elements.filter((e) => /^h[1-6]$/.test(e.tag));
  const firstH1 = headings.find((h) => h.tag === "h1");
  if (firstH1) for (const h of headings) {
    if (h.start >= firstH1.start) break;
    add("template/heading-before-h1", "warning", h.start, h.openEnd, `This <${h.tag}> comes before the page's <h1>.`, { why: "Screen reader users navigating by heading meet it before they know what the page is.", related: [relatedAt(loc, "html", firstH1.start, "the <h1>")] });
  }
  let prev = firstH1 ? 1 : 0;
  for (const h of headings) {
    if (firstH1 && h.start < firstH1.start) continue;
    const level = +h.tag[1];
    if (prev && level > prev + 1) add("template/heading-skip", "warning", h.start, h.openEnd, `This <${h.tag}> follows a <h${prev}>, skipping a level.`, { why: "Headings are an outline: skipping a level makes the page look as if a section is missing." });
    prev = level;
  }
  for (const el of elements) {
    const cls = (attrOf(el, "class")?.value || "").split(/\s+/);
    if (cls.includes("accordion-header") && !/^h[1-6]$/.test(el.tag)) add("template/accordion-header-not-heading", "warning", el.start, el.openEnd, `This .accordion-header is a <${el.tag}>, not a heading.`, { why: "The accordion's sections do not appear in the page outline." });
  }

  // ---- tables scroll inside their own box ----
  for (const el of elements) {
    if (el.tag !== "table") continue;
    let boxed = false;
    for (let p = el.parent; p && !boxed; p = p.parent) if (p.tag === "table" || (attrOf(p, "class")?.value || "").split(/\s+/).includes("table-scroll")) boxed = true;
    if (!boxed) add("template/table-no-scroll-wrapper", "warning", el.start, el.openEnd, "This table is not inside a scrolling box (<div class=\"table-scroll\">).", { why: "A table wider than a phone widens the whole page. The Table block's box scrolls it sideways instead; the migration wraps tables for you." });
  }

  // ---- libraries loaded twice (the field is pasted into a page that may already load them) ----
  const libs = [
    ["script", "src", /bootstrap(?:\.bundle)?(?:\.min)?\.js/i, "error", "The Bootstrap script is loaded"],
    ["link", "href", /bootstrap(?:\.min)?\.css/i, "warning", "The Bootstrap stylesheet is loaded"],
    ["link", "href", /font-?awesome|fontawesome|\/fa(?:-all)?(?:\.min)?\.css/i, "warning", "Font Awesome is loaded"],
  ];
  for (const [tag, attr, re, severity, what] of libs) {
    const found = elements.filter((e) => e.tag === tag && re.test(attrOf(e, attr)?.value || ""));
    found.slice(1).forEach((e) => add("template/duplicate-library", severity, e.start, e.openEnd, `${what} more than once in this field.`, {
      why: severity === "error" ? "Bootstrap's script then runs twice, so each accordion handler fires twice: a panel opens and closes in one click and cannot be closed on the second." : "Loaded twice, it is downloaded and applied twice.",
      related: [relatedAt(loc, "html", found[0].start, "the first one")] }));
  }
  return findings;
}
