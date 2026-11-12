// This tool's own page sits under thinqi's navbar the same as any
// generated page — reusing the same dynamic-measurement approach as
// Base JS rather than a fixed guess, since real navbar height varies.
function updateToolNavOffset() {
  try {
    const thinqiNavbar =
      document.querySelector("div.app-chrome") ||
      document.querySelector(".public-site-header");
    const height = thinqiNavbar ? thinqiNavbar.offsetHeight : null;
    document.documentElement.style.setProperty(
      "--thinqi-navbar-height",
      (height > 0 ? height : 95) + "px"
    );
  } catch (err) {
    console.log("updateToolNavOffset failed", err);
  }
}
window.addEventListener("DOMContentLoaded", updateToolNavOffset);
window.addEventListener("resize", updateToolNavOffset);

/* ===================================================================
   BASE FILES
   =================================================================== */

const BUILDER_VERSION = "3.1.1";

const BASE_HTML = `<!-- Gwella base HTML · version ${BUILDER_VERSION} -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.0/css/all.min.css" />
<!-- Bundle JS: Popper.js is required for tooltips -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"><\/script>

<div id="page-container" class="__THEME__" data-base-version="${BUILDER_VERSION}">

  <!-- One <li><a> per parent level; the last <li> is plain text -->
  <nav aria-label="breadcrumb" id="breadcrumb-nav">
    <ol id="breadcrumb-nav__list">
      <li><a href="/">Home</a></li>
      <li>Current page title</li>
    </ol>
  </nav>

  <header class="header">
    <img id="header-img"
      src="REPLACE_WITH_HERO_IMAGE_URL"
      alt="" />
  </header>

  <main class="main-grid standard-container">

    <!-- Each ToC href must match a section id below -->
    <nav id="table-of-contents">
      <h3 id="table-of-contents-heading">Table of Contents</h3>
      <ul>
        <li><a href="#section-id" class="toc-link">Section label</a></li>
      </ul>
    </nav>

    <div class="content-column">

      <h1 id="header-h1">Page title</h1>

      <!-- Optional at-a-glance block -->

      <div class="content-body">

        <!-- Content blocks go here, one <section id> each -->

        <p class="timestamp">
          Webpage last updated on [date].
        </p>

      </div>
    </div>
  </main>

  <button class="back-to-top" aria-label="Back to top">
    <i class="fa-solid fa-circle-chevron-up" aria-hidden="true"></i>
    <span>Back to Top</span>
  </button>

</div>`;

const BASE_CSS = `<style>
/* Gwella base CSS · version ${BUILDER_VERSION} */
/* Base styles. Block CSS goes inside #page-container. The Base JS sets --thinqi-navbar-height and --anchor-section-offset; read them, never redeclare them. */

html {
  scroll-behavior: smooth;
}

.gwella {
  --primary-colour: #a3195b;
  --secondary-colour: #faf3f7;
  --light-grey: #f1f1f1;
  --mid-grey: #d3d3d3;
  --dark-grey: #545454;
}

.ytydysgu {
  --primary-colour: #325083;
  --secondary-colour: #f3f6fb;
  --light-grey: #f1f1f1;
  --mid-grey: #d3d3d3;
  --dark-grey: #545454;
}

body > main > article.plain-text {
  overflow: visible !important;
}

#page-container {
  --heading-1: 1.625rem;
  --heading-2: 1.375rem;
  --heading-3: 1.125rem;
  --numbered-subheading: 20px;


  --bs-font-sans-serif: "Noto Sans", "Noto Sans Arabic", sans-serif;
  --bs-body-font-family: "Noto Sans", "Noto Sans Arabic", sans-serif;

  margin-top: var(--thinqi-navbar-height, 95px);
  line-height: 160%;
  background-color: white !important;
  font-family: var(--bs-font-sans-serif) !important;

  &,
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  p {
    margin-block: 1em;
  }

  ul {
    list-style-type: disc;
    padding-left: 40px;
  }

  ol {
    list-style-type: decimal;
    padding-left: 40px;
  }

  ol > li {
    display: list-item;
  }

  li {
    line-height: 1.5em;
  }

  section {
    /* Padding, not margin, gives the 64px gap between sections. */
    padding-block: 1.25rem;
    scroll-margin-top: var(--anchor-section-offset, 145px);
  }

  h1,
  h2,
  h3,
  h4,
  h5 {
    font-weight: bold;
    margin-block: 1.5rem;
    /* Keeps anchored headings clear of the navbar. */
    scroll-margin-top: var(--anchor-section-offset, 145px);
  }

  a {
    color: var(--primary-colour);
    text-decoration: underline;

    &:hover {
      text-decoration: none;
    }
  }

  .standard-container {
    max-width: 860px;
    margin-inline: auto;

    @media (max-width: 1200px) {
      max-width: 750px;
    }

    @media (max-width: 768px) {
      max-width: 100%;
      padding-inline: 1.2rem;
    }
  }

  .content-column {
    h2 {
      font-size: var(--heading-2);
      font-weight: bold;
      margin-block: 1.5rem;
    }

    h3 {
      font-size: var(--heading-3);
      font-weight: 600;
      color: var(--primary-colour);
    }

    @media (max-width: 768px) {
      display: contents;
    }
  }

  .button-icon {
    margin-left: 0.25rem;
  }

  #breadcrumb-nav {
    padding: 1rem;

    #breadcrumb-nav__list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      list-style: none;
      padding: 0;
      margin: 0;
      gap: 0.4rem;

      li:not(:last-child)::after {
        content: "|";
        margin-left: 0.5rem;
        color: var(--dark-grey);
      }

      li:last-child {
        color: var(--dark-grey);
      }
    }

    a {
      color: var(--primary-colour);
      text-decoration: underline;

      &:hover {
        text-decoration: none;
      }
    }
  }

  .header {
    width: 100%;
  }

  #header-img {
    width: 100%;
    object-fit: cover;
    object-position: center 30%;
    display: block;

    @media (max-width: 576px) {
      object-fit: contain;
    }
  }

  #header-h1 {
    font-size: var(--heading-1);
    color: var(--primary-colour);
    line-height: 120%;
    font-weight: bold;
    margin-block: 1.5rem;

    @media (max-width: 768px) {
      order: 1;
    }
  }

  .main-grid {
    display: grid;
    grid-template-columns: 1fr 3fr;
    gap: 2rem;
    align-items: start;
    padding-inline: 1rem;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: 0;
    }
  }

  .content-body {
    margin-top: 1rem;

    /* The order belongs on .content-body, the grid item on mobile. */
    @media (max-width: 768px) {
      order: 4;
    }
  }

  #table-of-contents {
    position: sticky;
    top: 110px;

    @media (max-width: 768px) {
      order: 3;
      padding-top: 0;
      position: relative;
      top: 0;
    }

    #table-of-contents-heading {
      border-radius: 20px;
      background-color: var(--primary-colour);
      color: white;
      padding: 5px;
      text-align: center;
      font-weight: 400;
      line-height: 1.5;
      font-size: 1.2em;
      margin-block: 1.5rem 0.75em;
    }

    ul {
      padding-left: 0;
    }

    li {
      list-style: none;
      border-radius: 10px;
      padding: 10px;
      background-color: var(--secondary-colour);
      margin-left: 0;

      &:hover {
        background-color: var(--light-grey);
      }

      & + li {
        margin-top: 1rem;
      }
    }

    .toc-link {
      color: var(--primary-colour);

      &:hover {
        text-decoration: none;
      }
    }
  }

  .timestamp {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-style: italic;
    font-size: 13px;
    color: var(--dark-grey);
    padding-inline: 1rem;
  }

  .back-to-top {
    display: none;
    flex-direction: column;
    position: fixed;
    right: 2rem;
    bottom: 2rem;
    background-color: rgba(255, 255, 255, 0.8);
    border: none;
    justify-content: center;
    align-items: center;
    gap: 8px;
    color: var(--primary-colour);
    font-weight: bold;
    padding: 0.5rem 0.8rem;
    border-radius: 10px;
    cursor: pointer;
    z-index: 99;

    & > i {
      font-size: 30px;
      color: var(--primary-colour);
    }
  }

  /* ============================================================
     PLACE NEW BLOCK CSS ABOVE THIS LINE
     ============================================================ */
}
</style>`;

const BASE_JS = `<script>
// Gwella base JS · version ${BUILDER_VERSION}
// The closing script tag near the end is escaped. Keep the backslash, or it ends this script early.
// Set the top margin and anchor offset for the page container.
// Also offsets for an optional #subnav, if the page has one.
function updateScrollOffset() {
  try {
    const thinqiNavbar =
      document.querySelector("div.app-chrome") ||
      document.querySelector(".public-site-header");
    const customSubnav = document.querySelector("#subnav");
    const isMobile = window.innerWidth <= 768;
    const thinqiNav_height = thinqiNavbar ? thinqiNavbar.offsetHeight : null;
    const customSubnav_height = customSubnav ? customSubnav.offsetHeight : null;
    let totalOffset = isMobile
      ? thinqiNav_height
      : thinqiNav_height + customSubnav_height;
    if (!thinqiNav_height && !customSubnav_height) {
      totalOffset = isMobile ? 137 : 145;
    }
    document.documentElement.style.setProperty(
      "--anchor-section-offset",
      totalOffset + "px",
    );
    const fallbackHeight = isMobile ? 137 : 95;
    if (thinqiNav_height > 0) {
      document.documentElement.style.setProperty(
        "--thinqi-navbar-height",
        thinqiNav_height + "px",
      );
    } else {
      document.documentElement.style.setProperty(
        "--thinqi-navbar-height",
        fallbackHeight + "px",
      );
    }
  } catch (error) {
    console.log("updateScrollOffset failed", error);
  }
}
window.addEventListener("DOMContentLoaded", updateScrollOffset);
window.addEventListener("resize", updateScrollOffset);
// Tooltips
const tooltipList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipTriggerList = [].slice.call(tooltipList);
tooltipTriggerList.forEach(
  (el) =>
    new bootstrap.Tooltip(el, {
      container: el,
    }),
);
// Back to top
const backToTopBtn = document.querySelector(".back-to-top");
if (backToTopBtn) {
  window.addEventListener("scroll", () => {
    const isTabletOrMobileView = window.innerWidth <= 768;
    const threshold = isTabletOrMobileView
      ? window.innerHeight
      : window.innerHeight / 2;
    backToTopBtn.style.display = window.scrollY < threshold ? "none" : "flex";
  });
  backToTopBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
<\/script>`;

/* ===================================================================
   HELPERS
   =================================================================== */

/* Derives a no-ToC variant of Base HTML/CSS from the single source of
   truth above, rather than maintaining a second hand-written copy that
   could drift out of sync with the real one over time. */

function getBaseHTML(includeToc) {
  const html = includeToc
    ? BASE_HTML
    : BASE_HTML.replace(/\n\s*<!-- Each ToC href[\s\S]*?<\/nav>\n/, "\n");
  return html.replace("__THEME__", activeTheme);
}

/* Removes one top-level CSS rule (selector + its full, brace-balanced
   body) by counting braces rather than a naive regex — safe even
   though #table-of-contents contains several levels of nested rules. */
function removeCssRule(css, selectorStart) {
  const idx = css.indexOf(selectorStart);
  if (idx === -1) return css;
  const braceStart = css.indexOf("{", idx);
  let depth = 1;
  let i = braceStart + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  let end = i;
  if (css[end] === "\n") end++;
  return css.slice(0, idx) + css.slice(end);
}

function getBaseCSS(includeToc) {
  if (includeToc) return BASE_CSS;
  let css = BASE_CSS.replace("grid-template-columns: 1fr 3fr;", "grid-template-columns: 1fr;");
  css = removeCssRule(css, "#table-of-contents {");
  return css;
}

/* ===================================================================
   CUSTOM LINK FORMAT — Quill's built-in link format doesn't track
   target="_blank" at all, so a plain quill.format('link', url) has
   nowhere to remember "opens in a new tab". This extends the format
   to accept {href, target} instead of a bare string, and to persist
   target/rel as real attributes that survive Quill's own re-renders
   (unlike setting them by hand on the DOM afterwards, which Quill can
   silently overwrite on the next edit since it wouldn't know about
   them). The external-link icon itself is added separately, at
   generation time in cleanQuillHTML() — see below.
   =================================================================== */
/* ===================================================================
   LINK HELPERS — decide whether a link that opens in a new tab needs
   rel="noopener noreferrer". Only external links need it: relative
   links and links to our own hosts stay in the site, so they only
   get target="_blank". Edit INTERNAL_HOSTS when a new domain is used.
   =================================================================== */
const INTERNAL_HOSTS = [
  "leadershipportal.heiw.wales",
  "nhswalesleadershipportal.heiw.wales",
  "leadershipportal.thinqi-uat.co.uk",
  "ytydysgu.heiw.wales",
  "nhswalesytydysgu.heiw.wales",
  "ytydysgu.thinqi-uat.co.uk",
];

function linkIsExternal(url) {
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
function newTabAttrs(url, newTab) {
  if (!newTab) return "";
  return linkIsExternal(url)
    ? ' target="_blank" rel="noopener noreferrer"'
    : ' target="_blank"';
}

const QuillLink = Quill.import("formats/link");
class TargetLink extends QuillLink {
  static create(value) {
    const href = typeof value === "string" ? value : (value && value.href) || "";
    const node = super.create(href);
    if (value && typeof value === "object" && value.target === "_blank") {
      node.setAttribute("target", "_blank");
      if (linkIsExternal(href)) {
        node.setAttribute("rel", "noopener noreferrer");
      } else {
        node.removeAttribute("rel");
      }
    } else {
      node.removeAttribute("target");
      node.removeAttribute("rel");
    }
    return node;
  }
  static formats(node) {
    return {
      href: node.getAttribute("href"),
      target: node.getAttribute("target") === "_blank" ? "_blank" : false
    };
  }
}
Quill.register(TargetLink, true);

/* Shared link-insertion dialog — one instance reused by every rich
   text editor on the page. */
const linkDialogOverlay = document.createElement("div");
linkDialogOverlay.className = "link-dialog-overlay";
linkDialogOverlay.innerHTML = `
  <div class="link-dialog">
    <label>Link URL</label>
    <input type="text" class="link-dialog-url" placeholder="https://..." />
    <label class="link-dialog-checkbox-label">
      <input type="checkbox" class="link-dialog-newtab" />
      Open in a new tab
    </label>
    <div class="link-dialog-actions">
      <button type="button" class="link-dialog-cancel">Cancel</button>
      <button type="button" class="link-dialog-insert">Insert link</button>
    </div>
  </div>`;
document.body.appendChild(linkDialogOverlay);

const linkDialogUrl = linkDialogOverlay.querySelector(".link-dialog-url");
const linkDialogNewTab = linkDialogOverlay.querySelector(".link-dialog-newtab");
const linkDialogCancelBtn = linkDialogOverlay.querySelector(".link-dialog-cancel");
const linkDialogInsertBtn = linkDialogOverlay.querySelector(".link-dialog-insert");

let linkDialogActiveQuill = null;
let linkDialogActiveRange = null;

function openLinkDialog(quill) {
  const range = quill.getSelection();
  if (!range || range.length === 0) {
    alert("Select some text first, then click the link button to turn it into a link.");
    return;
  }
  linkDialogActiveQuill = quill;
  linkDialogActiveRange = range;

  const existing = quill.getFormat(range).link;
  if (existing && typeof existing === "object") {
    linkDialogUrl.value = existing.href || "";
    linkDialogNewTab.checked = existing.target === "_blank";
  } else if (typeof existing === "string") {
    linkDialogUrl.value = existing;
    linkDialogNewTab.checked = false;
  } else {
    linkDialogUrl.value = "";
    linkDialogNewTab.checked = false;
  }

  linkDialogOverlay.classList.add("visible");
  linkDialogUrl.focus();
}

function closeLinkDialog() {
  linkDialogOverlay.classList.remove("visible");
  linkDialogActiveQuill = null;
  linkDialogActiveRange = null;
}

linkDialogCancelBtn.addEventListener("click", closeLinkDialog);

linkDialogOverlay.addEventListener("click", (e) => {
  if (e.target === linkDialogOverlay) closeLinkDialog();
});

linkDialogInsertBtn.addEventListener("click", () => {
  if (!linkDialogActiveQuill || !linkDialogActiveRange) return;
  const url = linkDialogUrl.value.trim();
  const quillRef = linkDialogActiveQuill;
  const rangeRef = linkDialogActiveRange;
  if (url) {
    quillRef.format("link", {
      href: url,
      target: linkDialogNewTab.checked ? "_blank" : false
    });
  }
  closeLinkDialog();
  quillRef.setSelection(rangeRef.index + rangeRef.length, 0);
});

function escapeHTML(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildPreviewDoc(block, html, css, js, theme) {
  const baseRules = BASE_CSS.replace(/<\/?style>/g, "");
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

function updatePreview(block, panel, fieldEls, previewFrame) {
  try {
    const values = {};
    block.fields.forEach((field, i) => {
      values[field.id] = collectValue(fieldEls[i], field);
    });
    const html = block.generateHTML(values);
    previewFrame.srcdoc = buildPreviewDoc(block, html, block.css, block.js, activeTheme);
  } catch (err) {
    // A field mid-edit (e.g. incomplete media URL) shouldn't break the tool —
    // just skip this update, the next keystroke will try again.
  }
}

function slugify(text) {
  const slug = (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "item";
}

/* Guarantees a unique, readable id even when two items share a title —
   this is exactly the failure mode found in the legacy corpus (the same
   id reused across dozens of unrelated headings). Collisions silently
   get a "-2", "-3" ... suffix rather than colliding. */
function uniqueSlug(base, usedSlugs) {
  let slug = base;
  let n = 2;
  while (usedSlugs.has(slug)) {
    slug = `${base}-${n}`;
    n++;
  }
  usedSlugs.add(slug);
  return slug;
}

function randomId(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8);
}

function indentLines(html, spaces) {
  const pad = " ".repeat(spaces);
  return html.split("\n").map(line => line.trim() ? pad + line : line).join("\n");
}

/* Quill represents BOTH bulleted and numbered lists as <ol> with a
   data-list="bullet"/"ordered" attribute, and relies on its own
   stylesheet to draw the markers — it never outputs a real <ul>.
   Pasted as-is, that wouldn't render correctly outside the editor.
   This rebuilds genuine <ul>/<ol> elements and strips every
   Quill-specific attribute/class before anything reaches the output. */
function cleanQuillHTML(html) {
  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, "text/html");
  const root = doc.getElementById("__root");

  // Remove Quill's internal editing-only UI markers
  root.querySelectorAll(".ql-ui").forEach(el => el.remove());

  // Rebuild real <ul>/<ol> from Quill's data-list <ol> items
  Array.from(root.querySelectorAll("ol")).forEach(ol => {
    const fragment = doc.createDocumentFragment();
    let currentList = null;
    let currentTag = null;

    Array.from(ol.children).forEach(li => {
      const listType = li.getAttribute("data-list"); // "bullet" or "ordered"
      li.removeAttribute("data-list");
      const tag = listType === "bullet" ? "ul" : "ol";
      if (tag !== currentTag) {
        currentList = doc.createElement(tag);
        fragment.appendChild(currentList);
        currentTag = tag;
      }
      currentList.appendChild(li);
    });

    ol.replaceWith(fragment);
  });

  // Strip any remaining Quill-specific classes/attributes
  root.querySelectorAll("[class]").forEach(el => {
    const cleaned = el.className.split(" ").filter(c => c && !c.startsWith("ql-")).join(" ");
    if (cleaned) el.className = cleaned; else el.removeAttribute("class");
  });

  // Add the external-link icon to any link set to open in a new tab —
  // matches the convention used across every other block. Added here,
  // at generation time, rather than kept live inside the editor, so it
  // can never desync from Quill's own tracked content.
  root.querySelectorAll('a[target="_blank"]').forEach(a => {
    if (!a.querySelector(".fa-up-right-from-square")) {
      a.appendChild(doc.createTextNode(" "));
      const icon = doc.createElement("i");
      icon.className = "fa-solid fa-up-right-from-square button-icon inline-icon";
      a.appendChild(icon);
    }
  });

  // Drop empty trailing paragraphs Quill leaves behind
  root.querySelectorAll("p").forEach(p => {
    if (p.innerHTML.trim() === "" || p.innerHTML.trim() === "<br>") p.remove();
  });

  return root.innerHTML.trim();
}

/* Finds the first <p> in already-cleaned rich-text HTML and adds a
   class to it — used by Hero text to guarantee its opening paragraph
   is always styled larger, structurally, regardless of what's typed.
   Only ever adds the class; never touches anything else. */
function markFirstParagraphLarge(html, className) {
  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, "text/html");
  const root = doc.getElementById("__root");
  const firstP = root.querySelector("p");
  if (firstP) {
    const existing = firstP.getAttribute("class");
    firstP.setAttribute("class", existing ? `${existing} ${className}` : className);
  }
  return root.innerHTML.trim();
}

function toYouTubeEmbed(input) {
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

/* ===================================================================
   BLOCK REGISTRY — add a new entry here once a block's HTML/CSS is
   locked in the spec. Each block becomes its own tab automatically.
   Field types available: "bullet-list", "select", "media-picker",
   "item-list". Add new field types in buildField()/collectValue()
   below if a future block needs one not listed here.
   =================================================================== */

const BLOCKS = {

  "section": {
    label: "Section",
    description: "Start here for every new bit of content — wraps it in a properly-idd <section> with its heading, and generates the matching table-of-contents entry at the same time, so those two ids can never drift apart.",
    fields: [
      { type: "text", id: "title", label: "Section title", placeholder: "e.g. Putting into practice" }
    ],
    htmlOutputLabel: "HTML for this section — paste into .content-body, then paste other blocks' content where marked",
    generateHTML: (values) => {
      const title = values.title.trim();
      return `<section id="${slugify(title)}">
  <h2>${escapeHTML(title)}</h2>

  <!-- Content goes here -->

</section>`;
    },
    secondaryHTML: {
      label: "Table of contents entry — paste inside &lt;nav id=\"table-of-contents\"&gt;",
      generate: (values) => {
        const title = values.title.trim();
        return `<li><a href="#${slugify(title)}" class="toc-link">${escapeHTML(title)}</a></li>`;
      }
    }
  },

  "nav-cards": {
    label: "Navigation cards",
    description: "A row of cards, two styles available: icon + description + button (only the button is clickable, unlike resource-cards), or numbered heading + plain icon with no button at all. Choose the style once — it applies to every card in the row.",
    fields: [
      { type: "nav-card-items", id: "cardsData", label: "Cards", defaultCount: 3 }
    ],
    warnings: (values) => {
      const { style, cards } = values.cardsData;
      if (style === "numbered") {
        const usable = cards.filter(c => c.heading.trim().length > 0).length;
        return usable === 0
          ? ["Numbered style needs a heading on at least one card, so nothing was generated. Headings are separate from the standard style's description and button label."]
          : [];
      }
      const usable = cards.filter(c => c.buttonLabel.trim().length > 0).length;
      return usable === 0
        ? ["Standard style needs a button label on at least one card, so nothing was generated. Button labels are separate from the numbered style's headings."]
        : [];
    },
    generateHTML: (values) => {
      const { style, autoNumber, cards } = values.cardsData;

      if (style === "numbered") {
        const items = cards.filter(c => c.heading.trim().length > 0);
        const cardsHTML = items.map((c, i) => {
          const numberSpan = autoNumber ? `<span class="nav-card__number">${i + 1}.</span> ` : "";
          const targetAttr = newTabAttrs(c.targetUrl, c.newTab);
          const icon = c.newTab ? ` <i class="fa-solid fa-up-right-from-square button-icon inline-icon"></i>` : "";
          return `  <div class="nav-card nav-card--numbered">
    <a href="${escapeHTML(c.targetUrl.trim())}" class="stretched-link"${targetAttr} aria-label="${escapeHTML(c.heading.trim())}"></a>
    <h3>${numberSpan}${escapeHTML(c.heading.trim())}${icon}</h3>
    <div class="nav-card__icon-plain">
      <img src="${escapeHTML(c.iconUrl.trim())}" alt="${escapeHTML(c.iconAlt.trim())}" />
    </div>
  </div>`;
        }).join("\n");

        return `<div class="nav-cards-grid nav-cards-grid--numbered">
${cardsHTML}
</div>`;
      }

      const items = cards.filter(c => c.buttonLabel.trim().length > 0);
      const cardsHTML = items.map(c => {
        const targetAttr = newTabAttrs(c.buttonUrl, c.newTab);
        const icon = c.newTab ? ` <i class="fa-solid fa-up-right-from-square button-icon inline-icon"></i>` : "";
        return `  <div class="nav-card">
    <div class="nav-card__icon">
      <img src="${escapeHTML(c.iconUrl.trim())}" alt="${escapeHTML(c.iconAlt.trim())}" />
    </div>
    <p>${escapeHTML(c.description.trim())}</p>
    <a href="${escapeHTML(c.buttonUrl.trim())}" class="nav-card__button"${targetAttr}>${escapeHTML(c.buttonLabel.trim())}${icon}</a>
  </div>`;
      }).join("\n");

      return `<div class="nav-cards-grid">
${cardsHTML}
</div>`;
    },
    css: `  .nav-cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  /* Auto-fits 185–210px cards, wrapping as needed. */
  .nav-cards-grid.nav-cards-grid--numbered {
    grid-template-columns: repeat(auto-fit, minmax(185px, 210px));
    justify-content: center;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  .nav-card {
    background-color: var(--secondary-colour);
    border-top: 6px solid var(--primary-colour);
    border-radius: 0 0 10px 10px;
    padding: 1.75rem 1.5rem;
    text-align: left;

    .nav-card__icon {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background-color: var(--primary-colour);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;

      img {
        width: 34px;
        height: 34px;
        display: block;
      }
    }

    p {
      margin: 0 0 1.25rem;
      color: #000;
      font-weight: 500;
    }

    .nav-card__button {
      display: block;
      width: 100%;
      text-align: center;
      background: var(--primary-colour);
      color: #fff !important;
      font-weight: 700;
      text-decoration: none !important;
      padding: 0.6rem 2rem;
      border-radius: 15px;

      &:hover {
        background: color-mix(in srgb, var(--primary-colour), black 15%);
        text-decoration: none;
      }
    }

    &.nav-card--numbered {
      display: flex;
      flex-direction: column;
      position: relative;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      max-width: 210px;
      min-width: 185px;
      padding: 16px;

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
      }

      h3 {
        font-size: 16px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 0;
      }

      .nav-card__number {
        color: var(--primary-colour);
      }

      .nav-card__icon-plain {
        margin-top: auto;
        padding-top: 1.5rem;

        img {
          width: 78px;
          height: 78px;
          object-fit: contain;
          display: block;
        }
      }

      @media (max-width: 768px) {
        flex-direction: row;
        align-items: center;
        max-width: none;
        min-width: 0;

        h3 {
          flex: 1;
        }

        .nav-card__icon-plain {
          margin-top: 0;
          padding-top: 0;
          margin-left: 1rem;
          flex-shrink: 0;
        }
      }
    }
  }`
  },

  "at-a-glance": {
    label: "At-a-glance",
    description: "A short bulleted summary box that sits above the table of contents on the page.",
    fields: [
      { type: "bullet-list", id: "bullets", label: "Bullet points", defaultCount: 2 }
    ],
    generateHTML: (values) => {
      const items = values.bullets
        .filter(b => b.trim().length > 0)
        .map(b => `    <li>${escapeHTML(b.trim())}</li>`)
        .join("\n");
      return `<div id="at-a-glance">
  <h3 id="at-a-glance-heading">At a glance</h3>
  <ul>
${items}
  </ul>
</div>`;
    },
    css: `  #at-a-glance {
    background-color: #e8e8e8;
    border-bottom: 4px solid var(--primary-colour);
    border-radius: 20px 20px 0 0;
    padding: 20px;

    @media (max-width: 768px) {
      order: 2;
    }

    #at-a-glance-heading {
      margin-block: 0 10px;
      font-size: 18px;
      font-weight: bold;
    }

    ul {
      margin-block: 0;

      li + li {
        margin-top: 10px;
      }
    }
  }`
  },

  "hero-text": {
    label: "Hero text",
    description: "Sits just below at-a-glance and just above the first section — one rich text editor, same as elsewhere. The first paragraph you write is automatically rendered larger (1.25em); everything after it is normal size. No separate field for the opening line — the tool finds it for you.",
    fields: [
      { type: "rich-text", id: "content", label: "Content", placeholder: "Write freely — the first paragraph is automatically styled larger..." }
    ],
    generateHTML: (values) => {
      const html = markFirstParagraphLarge(values.content, "hero-text__intro");
      return `<div class="hero-text">
${indentLines(html, 2)}
</div>`;
    },
    css: `  .hero-text {
    .hero-text__intro {
      font-size: 1.25em;
    }
  }`
  },

  "image-text-section": {
    label: "Image-text-section",
    description: "Free-form content — headings, lists, paragraphs, whatever the page needs — with an optional image or video floated alongside it. The content always flows around the media correctly; you don't need to manage that yourself.",
    fields: [
      { type: "media-picker", id: "media", label: "Media", allowSize: true },
      { type: "rich-text", id: "content", label: "Content", placeholder: "Write the content that sits alongside the image or video..." }
    ],
    generateHTML: (values) => {
      const media = values.media;
      let mediaHTML = "";
      if (media.type === "image" && media.imageUrl.trim()) {
        const sizeClass = media.imageSize === "large" ? ' class="media-large"' : "";
        mediaHTML = `  <img${sizeClass} src="${escapeHTML(media.imageUrl.trim())}" alt="${escapeHTML(media.imageAlt.trim())}" />\n`;
      } else if (media.type === "video" && media.videoUrl.trim()) {
        const embedUrl = toYouTubeEmbed(media.videoUrl);
        mediaHTML = `  <iframe src="${escapeHTML(embedUrl)}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n`;
      }

      return `<div class="image-text-section">
${mediaHTML}  <div>
${indentLines(values.content, 4)}
  </div>
</div>`;
    },
    css: `  .image-text-section {
    > img,
    > iframe {
      float: right;
      width: 100%;
      max-width: 275px;
      margin: 0 0 1rem 1.5rem;
      border-radius: 16px;
    }

    > iframe {
      aspect-ratio: 16 / 9;
      height: auto;
      border: none;
    }

    > img.media-large {
      width: 340px;
      max-width: 45%;
    }

    > div {
      min-width: 0;
    }

    &::after {
      content: "";
      display: block;
      clear: both;
    }

    h3 {
      color: var(--primary-colour);
      font-size: var(--numbered-subheading);
      font-weight: 600;
    }

    @media (max-width: 768px) {
      margin-top: 0;

      > img,
      > iframe {
        float: none;
        display: block;
        max-width: none;
        width: 100%;
        margin: 0 auto 1rem;
      }

      > img {
        aspect-ratio: 3 / 2;
        object-fit: cover;
        object-position: top;
        margin: 0 auto 1rem;
      }

      > img.media-large {
        float: right;
        display: inline;
        width: 200px;
        max-width: 40%;
        aspect-ratio: auto;
        object-fit: initial;
        margin: 0 0 1.5rem 2.5rem;
      }
    }
  }`
  },

  "accordion": {
    label: "Accordion",
    description: "A stack of expandable items — only one open at a time. This block only builds the structure (titles + correctly-linked ids); the content inside each panel is left as a placeholder for you to fill in — paste generated content from another tab, or write it directly.",
    fields: [
      { type: "text", id: "groupName", label: "Group name (used to build a readable id — leave blank to fall back to a random id)", placeholder: "e.g. Digital literacy resources" },
      { type: "bullet-list", id: "titles", label: "Item titles", defaultCount: 2,
        itemPlaceholder: "Item title", addLabel: "+ Add item" }
    ],
    generateHTML: (values) => {
      const accordionId = values.groupName.trim()
        ? `accordion-${slugify(values.groupName)}`
        : randomId("accordion");
      const titles = values.titles.filter(t => t.trim().length > 0);
      const usedSlugs = new Set();

      const itemsHTML = titles.map(title => {
        const slug = uniqueSlug(slugify(title), usedSlugs);
        const headingId = `heading-${slug}`;
        const collapseId = `collapse-${slug}`;
        return `  <div class="accordion-item">
    <h3 class="accordion-header" id="${headingId}">
      <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
        <span class="accordion-button-text">${escapeHTML(title.trim())}</span>
      </button>
    </h3>
    <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headingId}" data-bs-parent="#${accordionId}">
      <div class="accordion-body">
        <!-- Content goes here -->
      </div>
    </div>
  </div>`;
      }).join("\n");

      return `<div class="accordion" id="${accordionId}">
${itemsHTML}
</div>`;
    },
    css: `  .accordion {
    margin-block: 1rem 1.5rem;

    .accordion-header {
      margin: 0;
    }

    .accordion-item {
      border: none !important;
    }

    .accordion-button {
      color: var(--primary-colour) !important;
      background-color: transparent !important;
      padding: 0.5rem 0 !important;
      box-shadow: none !important;
      font-weight: 600;

      .accordion-button-text {
        text-decoration: underline;
      }

      &:hover .accordion-button-text {
        text-decoration: none;
      }

      &::after {
        display: none;
      }

      &::before {
        content: "▸";
        scale: 2;
        margin-right: 8px;
        transition: transform 0.2s ease-in-out;
        color: var(--primary-colour);
      }

      &:not(.collapsed) {
        background-color: transparent !important;
        color: var(--primary-colour) !important;
        box-shadow: none !important;

        &::before {
          transform: rotate(90deg);
        }
      }
    }

    .accordion-body {
      padding: 1rem 0;
    }
  }`
  },

  "icon-toggle": {
    label: "Icon-toggle",
    description: "A grid of clickable icons; clicking one reveals its own content panel below (and closes any other open panel). Content is left as a placeholder for you to fill in, same as accordion. Note: only one icon-toggle group per page — the click behaviour tracks 'the currently open panel' globally, not per-group.",
    fields: [
      { type: "text", id: "groupName", label: "Group name (used to build a readable id — leave blank to fall back to a random id)", placeholder: "e.g. Communication scenarios" },
      { type: "icon-toggle-items", id: "items", label: "Icons", defaultCount: 3 }
    ],
    generateHTML: (values) => {
      const gridId = values.groupName.trim()
        ? `data-icons-grid-${slugify(values.groupName)}`
        : randomId("data-icons-grid");
      const items = values.items.filter(it => it.label.trim().length > 0);
      const usedSlugs = new Set();

      const contentIds = items.map(item => `content-${uniqueSlug(slugify(item.label), usedSlugs)}`);

      const triggersHTML = items.map((item, i) => {
        const contentId = contentIds[i];
        return `  <div class="data-icon-trigger" onclick="openAccordion(this, '${contentId}')" onkeydown="openAccordionKey(event, this, '${contentId}')" tabindex="0">
    <div class="data-icon-card">
      <img src="${escapeHTML(item.iconUrl.trim())}" alt="${escapeHTML(item.iconAlt.trim())}" />
      <h5>${escapeHTML(item.label.trim())}</h5>
    </div>
  </div>`;
      }).join("\n");

      const panelsHTML = items.map((item, i) => {
        const contentId = contentIds[i];
        const panelImage = item.separateImage && item.panelImageUrl.trim()
          ? item.panelImageUrl.trim()
          : item.iconUrl.trim();
        return `<div class="content-display" id="${contentId}">
  <div class="content-display-inner-grid">
    <div>
      <!-- Content goes here -->
    </div>
    <img src="${escapeHTML(panelImage)}" alt="${escapeHTML(item.iconAlt.trim())}" />
  </div>
</div>`;
      }).join("\n");

      return `<div class="data-icons-grid" id="${gridId}">
${triggersHTML}
</div>
${panelsHTML}`;
    },
    css: `  .data-icons-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-block: 1.5rem;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }

    h5 {
      font-size: 14px;
      margin: 0.5rem 0 0;
      color: var(--primary-colour);
      font-weight: 600;
    }
  }

  .data-icon-trigger {
    cursor: pointer;
  }

  .data-icon-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border: 1px solid var(--mid-grey);
    border-radius: 15px;
    padding: 0.5rem 0.2rem;
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
    }

    &.active {
      border: 3px solid var(--primary-colour);
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    }

    img {
      width: 45px;
    }
  }

  .content-display {
    display: none;
    margin-block: 1rem;
    padding: 1.2rem;
    border: 2px solid var(--primary-colour);
    background-color: transparent;
    border-radius: 12px;
    /* Extra offset so the clicked icon stays visible above the panel. */
    scroll-margin-top: calc(var(--anchor-section-offset, 145px) + 110px);

    &.active {
      display: block;
    }
  }

  .content-display-inner-grid {
    display: grid;
    grid-template-columns: 3fr 1fr;
    gap: 2rem;
    align-items: center;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;

      img {
        order: -1;
      }
    }

    img {
      width: 150px;
      height: auto;
      justify-self: center;
    }
  }`,
    js: `function openAccordion(tileColumn, contentId) {
  const tile = tileColumn.querySelector(".data-icon-card");
  const openContent = document.querySelector(".content-display.active");
  const activeTile = document.querySelector(".data-icon-card.active");
  if (openContent && openContent.id !== contentId) {
    openContent.classList.remove("active");
    openContent.style.display = "none";
  }
  if (activeTile && activeTile !== tile) {
    activeTile.classList.remove("active");
  }
  const content = document.getElementById(contentId);
  if (content.style.display === "block") {
    content.style.display = "none";
    content.classList.remove("active");
    tile.classList.remove("active");
  } else {
    content.style.display = "block";
    content.classList.add("active");
    tile.classList.add("active");
    if (window.innerWidth <= 768) {
      tileColumn.insertAdjacentElement("afterend", content);
    }
    content.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}
function openAccordionKey(event, tileColumn, contentID) {
  if (event.key === "Enter") {
    openAccordion(tileColumn, contentID);
  }
}`
  },

  "resource-cards": {
    label: "Resource cards",
    description: "A grid of linked resource cards — image, title, type, and an optional duration/length. Generates just the card grid; wrap it in your own <section> with a heading, same as every other block.",
    fields: [
      { type: "resource-card-items", id: "cards", label: "Cards", defaultCount: 2 }
    ],
    generateHTML: (values) => {
      const cards = values.cards.filter(c => c.title.trim().length > 0);
      const cardsHTML = cards.map(c => {
        const targetAttr = newTabAttrs(c.linkUrl, c.newTab);
        const durationHTML = c.duration.trim()
          ? `<span>${escapeHTML(c.duration.trim())}</span>`
          : "";
        return `  <div class="card">
    <img src="${escapeHTML(c.imageUrl.trim())}" alt="${escapeHTML(c.imageAlt.trim())}" class="resource-card__img" />
    <div>
      <a href="${escapeHTML(c.linkUrl.trim())}" class="stretched-link"${targetAttr}>
        <strong>${escapeHTML(c.title.trim())} <i class="fa-solid fa-up-right-from-square"></i></strong>
      </a>
      <p><strong>${escapeHTML(c.type.trim())}</strong>${durationHTML}</p>
    </div>
  </div>`;
      }).join("\n");

      return `<div class="cards-grid">
${cardsHTML}
</div>`;
    },
    css: `  .cards-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    justify-items: center;
    align-items: stretch;
    gap: 1rem;

    @media (max-width: 576px) {
      grid-template-columns: repeat(1, 90%);
      justify-content: center;
    }

    .card {
      display: flex;
      flex-direction: column;
      width: 100%;
      border-radius: 10px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
      transition: 0.2s;

      &:hover {
        transform: translateY(-3px);
        box-shadow: 8px 12px 29px -3px rgba(26, 26, 26, 0.4);
      }

      @media (max-width: 576px) {
        max-width: 300px;
      }

      > div {
        flex: 1;
        padding: 1rem 1rem 0 1rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 180px;

        > a {
          margin-bottom: 2rem;
          color: var(--primary-colour);
        }
      }

      p {
        display: flex;
        justify-content: space-between;
      }
    }

    .resource-card__img {
      width: 100%;
      height: auto;
      object-fit: cover;
      border-radius: 10px 10px 0 0;
    }
  }`
  },

  "buttons": {
    label: "Buttons",
    description: "A row of call-to-action buttons (e.g. 'Sign the pledge'). Wraps as needed on smaller screens.",
    fields: [
      { type: "button-items", id: "buttons", label: "Buttons", defaultCount: 1 }
    ],
    generateHTML: (values) => {
      const buttons = values.buttons.filter(b => b.label.trim().length > 0);
      const buttonsHTML = buttons.map(b => {
        const label = escapeHTML(b.label.trim());
        const targetAttr = newTabAttrs(b.url, b.newTab);
        const ariaSuffix = b.newTab ? " (opens in a new tab)" : "";
        const icon = b.newTab ? `\n    <i class="fa-solid fa-up-right-from-square button-icon inline-icon"></i>` : "";
        return `  <a href="${escapeHTML(b.url.trim())}"${targetAttr} aria-label="${label}${ariaSuffix}">
    ${label}${icon}
  </a>`;
      }).join("\n");

      return `<div class="buttons">
${buttonsHTML}
</div>`;
    },
    css: `  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;

    a {
      display: inline-block;
      width: 250px;
      max-width: 100%;
      text-align: center;
      background: var(--primary-colour);
      color: #fff !important;
      padding: 14px 28px;
      border-radius: 10px;
      text-decoration: none !important;
      font-weight: 600;
      transition: 0.2s;

      &:hover {
        background: color-mix(in srgb, var(--primary-colour), black 15%);
        text-decoration: none;
      }
    }
  }

  .flex-section .buttons,
  .two-column .buttons {
    flex-direction: column;
    align-items: stretch;
    margin-top: 1.5rem;
  }

  .flex-section .buttons a,
  .two-column .buttons a {
    max-width: none;
    width: 100%;
  }`
  },

  "flex-section": {
    label: "Flex-section",
    description: "A genuine two-column layout — left side is always free-form content (the rich text editor), right side is your choice: an image, a video, or another content block from a different tab. Different from image-text-section: this doesn't wrap text around media, it's a true side-by-side split, so the right column is always shown (there's no 'None' option here).",
    fields: [
      { type: "rich-text", id: "content", label: "Left column — content", placeholder: "Write the content for this side..." },
      { type: "media-picker", id: "media", label: "Right column", allowNone: false, allowOther: true }
    ],
    generateHTML: (values) => {
      const media = values.media;
      let mediaInner = "";
      if (media.type === "image" && media.imageUrl.trim()) {
        mediaInner = `<img src="${escapeHTML(media.imageUrl.trim())}" alt="${escapeHTML(media.imageAlt.trim())}" />`;
      } else if (media.type === "video" && media.videoUrl.trim()) {
        const embedUrl = toYouTubeEmbed(media.videoUrl);
        mediaInner = `<iframe src="${escapeHTML(embedUrl)}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
      } else if (media.type === "other") {
        mediaInner = `<!-- CONTENT BLOCK GOES HERE -->`;
      }

      return `<div class="flex-section">
  <div class="text-content">
${indentLines(values.content, 4)}
  </div>
  <div class="video-content">
    ${mediaInner}
  </div>
</div>`;
    },
    css: `  .flex-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 3rem;

    @media (max-width: 768px) {
      flex-direction: column;
    }
  }

  .text-content {
    flex: 1;
    min-width: 0;
  }

  .video-content {
    flex: 1;
    display: flex;
    justify-content: flex-end;

    @media (max-width: 768px) {
      justify-content: center;
      order: -1;
    }

    img {
      width: 100%;
      max-width: 320px;
      height: auto;
      display: block;
      border-radius: 16px;

      @media (max-width: 768px) {
        aspect-ratio: 3 / 2;
        object-fit: cover;
        object-position: top;
        max-width: 100%;
        margin: 0 auto;
      }
    }

    iframe {
      width: 100%;
      aspect-ratio: 16 / 9;
      height: auto;
      border-radius: 16px;
      border: none;
    }
  }`
  },

  "two-column": {
    label: "Two-column layout",
    description: "One media item in one column, free text (and buttons, or other blocks pasted into the text) in the other. Media sits on the left by default; switch the layout to flip it. Top-aligned on desktop, and stacked with media first on mobile.",
    fields: [
      { type: "select", id: "flip", label: "Layout", default: "media-left",
        options: [
          { value: "media-left", label: "Media left (default)" },
          { value: "media-right", label: "Media right" }
        ] },
      { type: "media-picker", id: "media", label: "Media column", allowNone: false, allowOther: true },
      { type: "rich-text", id: "content", label: "Text column", placeholder: "Write the text for this column, then paste any buttons or other blocks here..." }
    ],
    generateHTML: (values) => {
      const media = values.media;
      let mediaInner = "";
      if (media.type === "image" && media.imageUrl.trim()) {
        mediaInner = `<img src="${escapeHTML(media.imageUrl.trim())}" alt="${escapeHTML(media.imageAlt.trim())}" />`;
      } else if (media.type === "video" && media.videoUrl.trim()) {
        const embedUrl = toYouTubeEmbed(media.videoUrl);
        mediaInner = `<iframe src="${escapeHTML(embedUrl)}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
      } else if (media.type === "other") {
        mediaInner = `<!-- CONTENT BLOCK GOES HERE -->`;
      }
      const flipClass = values.flip === "media-right" ? " two-column--flipped" : "";

      return `<div class="two-column${flipClass}">
  <div class="two-column__media">
    ${mediaInner}
  </div>
  <div class="two-column__content">
${indentLines(values.content, 4)}
  </div>
</div>`;
    },
    css: `  .two-column {
    display: flex;
    align-items: flex-start;
    gap: 2rem;

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: stretch;
      gap: 1.5rem;
    }

    @media (min-width: 769px) {
      &.two-column--flipped {
        flex-direction: row-reverse;
      }
    }
  }

  .two-column__media {
    flex: 0.8 1 0;
    min-width: 0;
  }

  .two-column__content {
    flex: 1 1 0;
    min-width: 0;
  }

  .two-column__media img,
  .two-column__media iframe {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 16px;
  }

  .two-column__media iframe {
    aspect-ratio: 16 / 9;
    border: none;
  }

  @media (min-width: 769px) {
    .two-column__media {
      margin-top: 1.5rem;
    }
  }

  @media (max-width: 768px) {
    .two-column__media img {
      aspect-ratio: 3 / 2;
      object-fit: cover;
      object-position: top;
      margin: 0 auto;
    }
  }`
  },

  // Next block goes here, following the same shape as above.

};

/* ===================================================================
   HOW IT WORKS — plain-English explanations shown in a collapsible
   section at the bottom of each block's tab. Keyed by the same block
   id used in BLOCKS above.
   =================================================================== */

const HOW_IT_WORKS = {

  "section": `
    <p>Think of this as starting a new chapter in a book — before you write anything, you give the chapter a title, add it to the contents page at the front, and set up a blank page for it to live on. That's exactly what this does, in one go.</p>
    <h4>The HTML — two pieces, two destinations</h4>
    <p>This is the one block that produces two separate outputs, because a table of contents entry and the actual section live in two different places on the page. The section wrapper:</p>
    <pre><code>&lt;section id="putting-into-practice"&gt;
  &lt;h2&gt;Putting into practice&lt;/h2&gt;

  (content goes here)

&lt;/section&gt;</code></pre>
    <p>...and, separately, the matching table of contents entry:</p>
    <pre><code>&lt;li&gt;&lt;a href="#putting-into-practice" class="toc-link"&gt;Putting into practice&lt;/a&gt;&lt;/li&gt;</code></pre>
    <p>Notice the id (<code>putting-into-practice</code>) and the link's <code>href</code> are exactly the same text — that's what makes clicking the table of contents entry actually jump down to this section. Both get built from the same title you type, once, so there's no way for them to quietly drift apart the way hand-typed ids sometimes do.</p>
    <h4>Where the other blocks fit in</h4>
    <p>The comment in the middle — <code>&lt;!-- Content goes here --&gt;</code> — is where you paste whatever you build on the other tabs: an image-text-section, an accordion, at-a-glance, anything. One section can hold more than one block if the content calls for it; just paste them one after another in place of the comment.</p>
    <h4>Why there's no CSS output for this one</h4>
    <p>Unlike every other tab, this block doesn't need its own CSS — spacing, scroll behaviour and heading styles for sections are already part of the Base CSS every page starts with, so there's nothing extra to add.</p>
  `,

  "nav-cards": `
    <p>Two styles live in this one block, chosen once for the whole row via "Card style":</p>
    <h4>Style 1 — Icon + description + button</h4>
    <p>Three (or however many) signposts side by side — an icon, a line explaining what's over there, and a button to actually go. The important bit: only the button is clickable, not the whole card — unlike resource-cards, where the entire card is one big link.</p>
    <pre><code>&lt;div class="nav-card"&gt;
  &lt;div class="nav-card__icon"&gt;
    &lt;img src="..." alt="" /&gt;
  &lt;/div&gt;
  &lt;p&gt;Learn what compassionate leadership means&lt;/p&gt;
  &lt;a href="..." class="nav-card__button"&gt;Understand it&lt;/a&gt;
&lt;/div&gt;</code></pre>
    <p>Notice the &lt;img&gt; and the &lt;a&gt; button are separate elements, not nested inside one another — that's the structural difference from resource-cards, where the whole card is one clickable link. Here, clicking the icon or the description text does nothing; only the green button is an actual link.</p>
    <h4>The circle behind the icon (style 1 only)</h4>
    <p>The navy circle isn't part of the icon image at all — it's plain CSS, a box made perfectly round with <code>border-radius: 50%</code>, coloured navy, with the icon centred inside it using flexbox. That's why the icon itself needs to be a <strong>transparent PNG</strong>: the navy circle is the actual background, showing through wherever the icon image is transparent. A white-icon-on-transparent-background PNG is what makes this look right — a PNG with its own solid background would show up as an ugly box over the circle instead of blending in.</p>
    <h4>New tab, off by default (style 1 only)</h4>
    <p>Unlike buttons and resource-cards (which default to opening in a new tab), this block defaults to the <strong>same</strong> tab — matching the reference design, where these are meant to feel like in-site navigation rather than links out to something external. Ticking the box adds <code>target="_blank"</code> and the little arrow icon, same as everywhere else.</p>
    <h4>Style 2 — Numbered heading + plain icon</h4>
    <p>No visible button — but the whole card is clickable, using the same trick as resource-cards.</p>
    <pre><code>&lt;div class="nav-card nav-card--numbered"&gt;
  &lt;a href="..." class="stretched-link" aria-label="..."&gt;&lt;/a&gt;
  &lt;h3&gt;&lt;span class="nav-card__number"&gt;1.&lt;/span&gt; Agree direction and ensure alignment and commitment&lt;/h3&gt;
  &lt;div class="nav-card__icon-plain"&gt;
    &lt;img src="..." alt="" /&gt;
  &lt;/div&gt;
&lt;/div&gt;</code></pre>
    <p>That empty <code>&lt;a class="stretched-link"&gt;</code> has no visible content of its own — <code>stretched-link</code> is what invisibly expands its clickable area to cover the entire card, the same way resource-cards works. The <code>aria-label</code> is filled in automatically from the heading text, so a screen reader still announces something meaningful even though there's no visible link text to read. Hovering the card lifts it slightly and adds a shadow (matching the lift effect used on resource cards and icon-toggle triggers), and the cursor switches to a pointer — both there specifically to signal "this whole box is clickable" even though nothing looks like a traditional button.</p>
    <p>Two more things worth knowing: the icon here has <strong>no navy circle behind it</strong> — these icons are already full-colour transparent PNGs with their own colours baked in, so no CSS circle is needed or wanted. And numbering is automatic (a checkbox, on by default) rather than typed — the number is based on each card's position, so reordering or removing a card never leaves you with "1, 3, 4" or a stale number stuck on the wrong card.</p>
    <h4>How the icon always sits at the bottom</h4>
    <p><code>margin-top: auto</code> on the icon's wrapper is a neat flexbox trick — inside a flex column, an automatic margin greedily eats up all the leftover space above it, pushing everything after it to the very bottom of the box. That's what keeps the icons lined up at the bottom of every card even when headings run to different lengths.</p>
  `,

  "at-a-glance": `
    <p>Think of this like the little summary box you sometimes see at the top of a recipe, before the actual steps — a quick "here's what you're getting" before the reader dives into the page.</p>
    <h4>The HTML</h4>
    <p>It's just a box with a heading and a list:</p>
    <pre><code>&lt;div id="at-a-glance"&gt;
  &lt;h3 id="at-a-glance-heading"&gt;At a glance&lt;/h3&gt;
  &lt;ul&gt;
    &lt;li&gt;Your bullet point&lt;/li&gt;
  &lt;/ul&gt;
&lt;/div&gt;</code></pre>
    <p>The heading text "At a glance" never changes, so the tool writes it for you — one less thing to type or accidentally misspell. Each &lt;li&gt; is one bullet; add or remove as many as you like in the form and the tool builds the list to match.</p>
    <h4>The CSS</h4>
    <p><code>id="at-a-glance"</code> is how the CSS finds this exact box to give it its grey background and the navy line underneath. <code>border-radius: 20px 20px 0 0</code> means "round the top-left and top-right corners, leave the bottom two square" — that's why it looks like a rounded card sitting on a flat base.</p>
    <p><code>li + li { margin-top: 10px; }</code> means "add a gap above any bullet that comes right after another bullet" — the <code>+</code> is CSS-speak for "the one right after". That's why the first bullet sits flush at the top, but every bullet after it gets a bit of breathing room.</p>
    <h4>On mobile</h4>
    <p><code>order: 2</code> is like a seating chart that only applies on small screens — it tells this box "you're in seat 2" so it lands in the right spot (title, then this box, then the table of contents, then everything else) even though the actual HTML order underneath never changes.</p>
  `,

  "hero-text": `
    <p>The bit of writing that greets the reader right after the summary box — one editor, write it exactly like any other rich text field. The only special thing about this block is what happens automatically to whatever paragraph comes first.</p>
    <h4>Write normally — the sizing takes care of itself</h4>
    <p>You don't tell the tool which paragraph is the "opening" one, and there's no separate box for it. When you hit Generate, the tool looks at your finished content and finds the very first paragraph, wherever it is, and marks it:</p>
    <pre><code>&lt;p class="hero-text__intro"&gt;Your opening sentence.&lt;/p&gt;
&lt;p&gt;Everything else, at normal size.&lt;/p&gt;</code></pre>
    <p>The size (1.25em, a quarter bigger than normal text) lives on that <code>hero-text__intro</code> class in the CSS, not on the text itself — so it's <strong>always</strong> applied to whatever the first paragraph turns out to be, structurally guaranteed, rather than depending on someone remembering to size it themselves every time they write one of these.</p>
    <h4>Everything else</h4>
    <p>This is the exact same rich text editor used elsewhere in the tool (headings, bold, italic, lists, links) — full flexibility. The only thing that's different about the output is that one added class on the first paragraph.</p>
  `,

  "image-text-section": `
    <p>Picture a newspaper column with a photo tucked into the corner and the text flowing around it, wrapping underneath once it runs past the photo's height. That's exactly what this block does — except the "photo" can also be a video, or nothing at all.</p>
    <h4>The HTML</h4>
    <pre><code>&lt;div class="image-text-section"&gt;
  &lt;img src="..." alt="..." /&gt;
  &lt;div&gt;
    (your content goes here)
  &lt;/div&gt;
&lt;/div&gt;</code></pre>
    <p>Two things sit side by side inside the wrapper: the image (or video, or nothing), and a &lt;div&gt; holding whatever you wrote in the rich text editor. Whatever formatting you used — headings, bullet points, plain paragraphs — gets carried straight through into that div as real HTML.</p>
    <h4>The CSS trick — floating</h4>
    <p>The image is told to <code>float: right</code>, which is an old but still very useful CSS trick: it pulls the image out to the right-hand side and lets everything else (the text in the div) flow around it like water round a rock, wrapping underneath once the image ends.</p>
    <pre><code>.image-text-section::after {
  content: "";
  display: block;
  clear: both;
}</code></pre>
    <p>This last bit is called a "clearfix" — without it, a floated image can spill outside its own box and overlap whatever comes after it on the page. This rule tells the browser "stop, don't let anything float past this point" — it's invisible, but it's what keeps the layout tidy underneath.</p>
    <h4>The "Large" image size</h4>
    <p>Choosing "Large" adds a <code>media-large</code> class to the image, which swaps its size (250px max normally, 340px/45% when Large) — this is how the old "badge" image style (like the pledge certificate graphic) got folded into this same block instead of being a separate one.</p>
  `,

  "accordion": `
    <p>Think of a filing cabinet: each drawer has a label, you click the label to slide it open, and — because this is a well-behaved cabinet — opening one drawer closes whichever one was already open.</p>
    <h4>The HTML — and why the ids matter so much</h4>
    <pre><code>&lt;button data-bs-target="#collapse-digital-literacy" ...&gt;
  Digital literacy
&lt;/button&gt;

&lt;div id="collapse-digital-literacy" ...&gt;
  (content goes here)
&lt;/div&gt;</code></pre>
    <p>The button doesn't know what "digital literacy" means — it just knows to look for an element whose id exactly matches its <code>data-bs-target</code>, like dialling a phone number. If those two ids don't match <em>exactly</em> — a typo, a missing letter — clicking the button does nothing at all, with no error message telling you why. That's precisely why this tool generates both ids together automatically from your item's title, so they can never drift apart.</p>
    <h4>How "only one open at a time" works</h4>
    <p>Every panel also carries <code>data-bs-parent="#accordion-..."</code>, pointing back at the outer wrapper. This is Bootstrap's own JavaScript (already loaded by Base HTML) reading that attribute as an instruction: "when I open, ask every other panel sharing this same parent to close." That's the whole mechanism — no custom code needed for this block.</p>
    <h4>The "Group name" field</h4>
    <p>This just gives the outer wrapper's id something readable to be built from (e.g. "digital-literacy-resources" instead of a random string) — purely for humans reading the pasted code later, it doesn't change how anything behaves.</p>
  `,

  "icon-toggle": `
    <p>Imagine a row of light switches: flick one, and a message board underneath lights up with that switch's message. Flick a different one, and the board swaps to the new message — only one message shows at a time.</p>
    <h4>The HTML</h4>
    <pre><code>&lt;div onclick="openAccordion(this, 'content-hosting-a-meeting')" ...&gt;
  &lt;div class="data-icon-card"&gt;
    &lt;img src="..." /&gt;
    &lt;h5&gt;Hosting a meeting&lt;/h5&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;div class="content-display" id="content-hosting-a-meeting"&gt;
  (content goes here)
&lt;/div&gt;</code></pre>
    <p>Clicking an icon calls a function called <code>openAccordion</code>, telling it two things: "here's the icon I clicked" and "here's the id of the panel it should open" — like calling a friend and saying "open that box, and close whatever else is open." That id has to match the panel's own id exactly, which is why the tool generates both from the same label text automatically.</p>
    <h4>Why the JS is separate from the HTML/CSS</h4>
    <p>Unlike the accordion (which reuses Bootstrap's own built-in behaviour), this block needs its own small helper function — <code>openAccordion</code> — that isn't part of Bootstrap. It only needs to exist <strong>once</strong> on the page no matter how many icons you add, which is why it's pasted into the shared script area rather than repeated per icon — like one shared tool in a toolbox, not a new copy for every job.</p>
    <h4>The scroll behaviour</h4>
    <p>When a panel opens, the page automatically scrolls down to it (<code>scrollIntoView</code>) — with some extra breathing room added above it, deliberately, so the icon you just clicked stays visible on screen. That way you can find it again to close the panel without having to scroll back up.</p>
  `,

  "resource-cards": `
    <p>Picture a stack of business cards laid out in a neat grid — each one clickable, each one the same height as its neighbours in the same row, however short or long its title happens to be.</p>
    <h4>The HTML</h4>
    <pre><code>&lt;div class="card"&gt;
  &lt;img src="..." class="resource-card__img" /&gt;
  &lt;div&gt;
    &lt;a href="..." class="stretched-link" target="_blank"&gt;
      &lt;strong&gt;Title text &lt;i class="fa-solid fa-up-right-from-square"&gt;&lt;/i&gt;&lt;/strong&gt;
    &lt;/a&gt;
    &lt;p&gt;&lt;strong&gt;Type&lt;/strong&gt;&lt;span&gt;Duration&lt;/span&gt;&lt;/p&gt;
  &lt;/div&gt;
&lt;/div&gt;</code></pre>
    <p>The <code>stretched-link</code> class is a neat CSS trick: it stretches the clickable area of that link invisibly to cover the <em>entire</em> card, even though the actual link text is only a few words. That's why clicking anywhere on the card — the image, the empty space, not just the title — opens the link.</p>
    <h4>Why every card in a row matches height</h4>
    <p>By default, a grid lets each item size itself to fit its own content — so a card with a two-line title would end up shorter than one with a three-line title next to it. Telling the grid to <code>stretch</code> instead makes every card fill the full height of its row, and then the card's own layout (a flexbox column with <code>justify-content: space-between</code>) pushes the type/duration line down to the bottom either way — like a bookend holding the price tag at the bottom of the shelf no matter how thick the book is.</p>
    <h4>The new-tab checkbox</h4>
    <p>Ticking it adds <code>target="_blank"</code> and the little arrow icon, tied to the one checkbox so neither can be forgotten. The builder also adds <code>rel="noopener noreferrer"</code> (a safety measure for links that open a new tab) but only to external links. Relative links and links to our own domains (listed in <code>INTERNAL_HOSTS</code>) keep just <code>target="_blank"</code>.</p>
  `,

  "buttons": `
    <p>The simplest block here — a row of "go do this" buttons, like "Sign the pledge" or "Download the guide".</p>
    <h4>The HTML</h4>
    <pre><code>&lt;div class="buttons"&gt;
  &lt;a href="..." target="_blank" aria-label="Sign the pledge (opens in a new tab)"&gt;
    Sign the pledge
    &lt;i class="fa-solid fa-up-right-from-square"&gt;&lt;/i&gt;
  &lt;/a&gt;
&lt;/div&gt;</code></pre>
    <p>The <code>aria-label</code> is what a screen reader announces instead of the visible text — it's there so someone who can't see the little arrow icon still gets told "this link opens in a new tab" out loud. Both the icon and that spoken warning are tied to the same "open in a new tab" checkbox, so they always agree with each other; you'll never end up with the icon showing but the label not mentioning it, or vice versa.</p>
    <h4>The CSS</h4>
    <p><code>display: flex; flex-wrap: wrap;</code> on the row means the buttons sit side by side and automatically drop onto a new line if they run out of horizontal space — no extra work needed for that to happen responsively.</p>
  `,

  "flex-section": `
    <p>Picture a book lying open — content on the left-hand page, a picture or video on the right-hand page, side by side, both taking up roughly equal space. That's the whole idea of this block, and it's genuinely different from image-text-section: nothing wraps around anything here, it's a clean two-column split.</p>
    <h4>The HTML</h4>
    <pre><code>&lt;div class="flex-section"&gt;
  &lt;div class="text-content"&gt;
    (your content goes here)
  &lt;/div&gt;
  &lt;div class="video-content"&gt;
    &lt;iframe src="..."&gt;&lt;/iframe&gt;
  &lt;/div&gt;
&lt;/div&gt;</code></pre>
    <h4>The CSS</h4>
    <p><code>display: flex</code> on the outer wrapper lines the two inner boxes up side by side. <code>flex: 1</code> on both of them means "split the available space evenly between us" — like cutting a sandwich exactly in half, regardless of how wide the page actually is.</p>
    <p>On phones, <code>flex-direction: column</code> switches that same layout from side-by-side to stacked — the same two boxes, just rearranged vertically once the screen gets too narrow for two columns to sit comfortably next to each other.</p>
    <h4>Why media is required here</h4>
    <p>Unlike image-text-section, there's no "None" option for the right column — an empty second column wouldn't make sense in a layout whose entire point is two columns side by side.</p>
    <h4>The "Another content block" option</h4>
    <p>Picking this for the right column doesn't generate any media at all — it just leaves a marker instead:</p>
    <pre><code>&lt;div class="video-content"&gt;
  &lt;!-- CONTENT BLOCK GOES HERE --&gt;
&lt;/div&gt;</code></pre>
    <p>Same idea as the placeholder used in accordion and icon-toggle panels: build whatever you actually need on another tab (buttons, for instance) and paste its generated HTML in place of that comment. This block only ever handles the two-column structure itself — it doesn't try to generate every possible thing that could go in the right column.</p>
  `,

  "two-column": `
    <p>Think of a magazine spread: a photo on one page, the story on the other. This block is that layout, with the photo on the left by default.</p>
    <h4>Flip the layout</h4>
    <p>The Layout option switches the media to the right. The HTML stays in the same order either way; the change is made in CSS, so the text is always read after the media by screen readers.</p>
    <h4>Mobile</h4>
    <p>On phones the two columns stack, media first, and the image is shown at 3:2 and centred.</p>
    <h4>Buttons in the text column</h4>
    <p>Generate buttons in the Buttons tab and paste them into the text column. Inside a two-column layout they automatically become full width and stack with a gap.</p>
  `

};

/* ===================================================================
   GENERIC FIELD SYSTEM — one place to add new field types as future
   blocks need them.
   =================================================================== */

function buildField(field) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.dataset.fieldId = field.id;

  if (field.label) {
    const label = document.createElement("label");
    label.textContent = field.label;
    wrap.appendChild(label);
  }

  if (field.type === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "text-field-input";
    input.placeholder = field.placeholder || "";
    wrap.appendChild(input);
  }

  else if (field.type === "bullet-list") {
    const rowsContainer = document.createElement("div");
    rowsContainer.className = "bullet-rows";
    wrap.appendChild(rowsContainer);

    function addRow(value) {
      const row = document.createElement("div");
      row.className = "bullet-row";
      const input = document.createElement("input");
      input.type = "text";
      input.value = value || "";
      input.placeholder = field.itemPlaceholder || "Bullet text";
      const remove = document.createElement("button");
      remove.className = "bullet-remove";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove bullet");
      remove.onclick = () => row.remove();
      row.appendChild(input);
      row.appendChild(remove);
      rowsContainer.appendChild(row);
    }

    for (let i = 0; i < field.defaultCount; i++) addRow("");

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "bullet-add";
    addBtn.textContent = field.addLabel || "+ Add bullet";
    addBtn.onclick = () => addRow("");
    wrap.appendChild(addBtn);
  }

  else if (field.type === "select") {
    const select = document.createElement("select");
    field.options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === field.default) o.selected = true;
      select.appendChild(o);
    });
    wrap.appendChild(select);
  }

  else if (field.type === "media-picker") {
    const select = document.createElement("select");
    select.className = "media-type-select";
    const typeOptions = [["image", "Image"], ["video", "Video embed"]];
    if (field.allowOther) typeOptions.push(["other", "Another content block"]);
    if (field.allowNone !== false) typeOptions.push(["none", "None"]);
    typeOptions.forEach(([val, txt]) => {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = txt;
      select.appendChild(o);
    });
    wrap.appendChild(select);

    const imageGroup = document.createElement("div");
    imageGroup.className = "subfield media-image-group";
    imageGroup.innerHTML = `
      <label>Image URL</label>
      <input type="text" class="media-image-url" placeholder="https://..." />
      <label style="margin-top:0.6rem;">Alt text</label>
      <input type="text" class="media-image-alt" placeholder="Leave blank for decorative images" />
      <p class="field-help">Only describe the image if it's needed to understand the content. Purely decorative images should be left blank.</p>
      ${field.allowSize ? `<label style="margin-top:0.6rem;">Image size</label>
      <select class="media-image-size">
        <option value="standard">Standard</option>
        <option value="large">Large (e.g. a badge or certificate graphic)</option>
      </select>` : ""}`;
    wrap.appendChild(imageGroup);

    const videoGroup = document.createElement("div");
    videoGroup.className = "subfield media-video-group";
    videoGroup.innerHTML = `
      <label>YouTube URL or video ID</label>
      <input type="text" class="media-video-url" placeholder="https://youtube.com/watch?v=... or the video ID" />`;
    wrap.appendChild(videoGroup);

    function updateVisibility() {
      imageGroup.style.display = select.value === "image" ? "block" : "none";
      videoGroup.style.display = select.value === "video" ? "block" : "none";
    }
    select.addEventListener("change", updateVisibility);
    updateVisibility();
  }

  else if (field.type === "rich-text") {
    const editorContainer = document.createElement("div");
    editorContainer.className = "rich-text-editor";
    wrap.appendChild(editorContainer);

    // Most rich-text fields get the full toolbar; a field can opt into
    // a restricted one (e.g. "minimal" = bold only) via field.toolbar.
    const toolbarConfig = field.toolbar === "minimal"
      ? [["bold"], ["clean"]]
      : [
          [{ header: [3, false] }],
          ["bold", "italic"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link"],
          ["clean"]
        ];
    const hasLinkButton = toolbarConfig.some(group => group.includes("link"));

    const quill = new Quill(editorContainer, {
      theme: "snow",
      placeholder: field.placeholder || "",
      modules: {
        toolbar: {
          container: toolbarConfig,
          handlers: hasLinkButton ? { link: () => openLinkDialog(quill) } : {}
        }
      }
    });

    // Strip everything from pasted content except the formats this
    // editor's own toolbar actually offers — guards against Word/Outlook
    // paste junk (fonts, colours, inline styles), and stops the minimal
    // (bold-only) toolbar from gaining a heading or list via paste that
    // its own buttons don't offer.
    const allowedPasteFormats = field.toolbar === "minimal"
      ? ["bold"]
      : ["bold", "italic", "link", "header", "list"];
    quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
      delta.ops.forEach(op => {
        if (op.attributes) {
          Object.keys(op.attributes).forEach(key => {
            if (!allowedPasteFormats.includes(key)) delete op.attributes[key];
          });
        }
      });
      return delta;
    });

    wrap._quillInstance = quill;
  }

  else if (field.type === "button-items") {
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Button</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Label</label>
        <input type="text" class="btn-label" placeholder="e.g. Sign the pledge" />
        <label style="margin-top:0.6rem;">URL</label>
        <input type="text" class="btn-url" placeholder="https://..." />
        <label style="margin-top:0.8rem; display:flex; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer;">
          <input type="checkbox" class="btn-new-tab" style="width:auto;" checked />
          Open in a new tab
        </label>`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      itemsContainer.appendChild(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add button";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);
  }

  else if (field.type === "nav-card-items") {
    const styleField = document.createElement("div");
    styleField.className = "field";
    styleField.innerHTML = `<label>Card style</label>`;
    const styleSelect = document.createElement("select");
    styleSelect.className = "navcard-style-select";
    [["standard", "Icon + description + button"], ["numbered", "Numbered heading + icon (no button)"]].forEach(([val, txt]) => {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = txt;
      styleSelect.appendChild(o);
    });
    styleField.appendChild(styleSelect);
    wrap.appendChild(styleField);

    const autoNumberLabel = document.createElement("label");
    autoNumberLabel.style.cssText = "display:none; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer; margin-bottom:1rem;";
    autoNumberLabel.innerHTML = `<input type="checkbox" class="navcard-auto-number" style="width:auto;" checked /> Number the cards automatically (1, 2, 3...)`;
    wrap.appendChild(autoNumberLabel);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function updateCardVisibility(card) {
      const style = styleSelect.value;
      card.querySelector(".navcard-standard-fields").style.display = style === "standard" ? "block" : "none";
      card.querySelector(".navcard-numbered-fields").style.display = style === "numbered" ? "block" : "none";
    }

    function updateAllVisibility() {
      itemsContainer.querySelectorAll(".item-card").forEach(updateCardVisibility);
      autoNumberLabel.style.display = styleSelect.value === "numbered" ? "flex" : "none";
    }

    styleSelect.addEventListener("change", updateAllVisibility);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Card</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Icon image URL (transparent PNG — colours are part of the image itself)</label>
        <input type="text" class="navcard-icon-url" placeholder="https://..." />
        <label style="margin-top:0.6rem;">Icon alt text</label>
        <input type="text" class="navcard-icon-alt" placeholder="Usually blank — the text already says what it does" />
        <div class="navcard-standard-fields">
          <label style="margin-top:0.6rem;">Description</label>
          <textarea class="navcard-description" rows="2" placeholder="Short, one or two lines"></textarea>
          <label style="margin-top:0.6rem;">Button label</label>
          <input type="text" class="navcard-button-label" placeholder="e.g. Understand it" />
        </div>
        <div class="navcard-numbered-fields" style="display:none;">
          <label style="margin-top:0.6rem;">Heading</label>
          <textarea class="navcard-heading" rows="2" placeholder="e.g. Agree direction and ensure alignment and commitment"></textarea>
        </div>
        <label style="margin-top:0.6rem;">Link URL (the button in standard style, the whole card in numbered style)</label>
        <input type="text" class="navcard-url" placeholder="https://..." />
        <label style="margin-top:0.8rem; display:flex; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer;">
          <input type="checkbox" class="navcard-new-tab" style="width:auto;" />
          Open in a new tab
        </label>`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      itemsContainer.appendChild(card);
      updateCardVisibility(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add card";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);

    wrap._navCardStyleSelect = styleSelect;
    wrap._navCardAutoNumber = autoNumberLabel.querySelector(".navcard-auto-number");
  }

  else if (field.type === "resource-card-items") {
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Card</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Image URL</label>
        <input type="text" class="card-image-url" placeholder="https://..." />
        <label style="margin-top:0.6rem;">Image alt text</label>
        <input type="text" class="card-image-alt" placeholder="Leave blank for decorative images" />
        <label style="margin-top:0.6rem;">Title</label>
        <input type="text" class="card-title" placeholder="Resource title" />
        <label style="margin-top:0.6rem;">Link URL</label>
        <input type="text" class="card-link-url" placeholder="https://..." />
        <label style="margin-top:0.8rem; display:flex; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer;">
          <input type="checkbox" class="card-new-tab" style="width:auto;" checked />
          Open in a new tab
        </label>
        <label style="margin-top:0.6rem;">Type</label>
        <input type="text" class="card-type" placeholder="e.g. Video, Publication, Course" />
        <label style="margin-top:0.6rem;">Duration / length (optional)</label>
        <input type="text" class="card-duration" placeholder="e.g. 36 Minutes, Long Read — leave blank to omit" />`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      itemsContainer.appendChild(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add card";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);
  }

  else if (field.type === "icon-toggle-items") {
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Item</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Icon image URL</label>
        <input type="text" class="icon-url" placeholder="https://..." />
        <label style="margin-top:0.6rem;">Icon alt text</label>
        <input type="text" class="icon-alt" placeholder="Leave blank for decorative images" />
        <label style="margin-top:0.6rem;">Label</label>
        <input type="text" class="icon-label" placeholder="Shown under the icon" />
        <label style="margin-top:0.8rem; display:flex; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer;">
          <input type="checkbox" class="separate-image-toggle" style="width:auto;" />
          Use a separate image in the content panel
        </label>
        <div class="subfield separate-image-group" style="display:none;">
          <label>Content panel image URL</label>
          <input type="text" class="panel-image-url" placeholder="https://..." />
        </div>`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      const checkbox = card.querySelector(".separate-image-toggle");
      const group = card.querySelector(".separate-image-group");
      checkbox.addEventListener("change", () => {
        group.style.display = checkbox.checked ? "block" : "none";
      });
      itemsContainer.appendChild(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add item";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);
  }

  else if (field.type === "item-list") {
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Item</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Heading</label>
        <input type="text" class="item-heading" placeholder="Heading text (number is added automatically)" />
        <label style="margin-top:0.6rem;">Content — one line per ${itemsContainer.dataset.formatHint || "list item / paragraph"}</label>
        <textarea class="item-content-textarea" rows="3" placeholder="One line per point"></textarea>`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      itemsContainer.appendChild(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add item";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);
  }

  return wrap;
}

function collectValue(wrap, field) {
  if (field.type === "text") {
    return wrap.querySelector(".text-field-input").value;
  }
  if (field.type === "bullet-list") {
    return Array.from(wrap.querySelectorAll(".bullet-row input")).map(i => i.value);
  }
  if (field.type === "select") {
    return wrap.querySelector("select").value;
  }
  if (field.type === "media-picker") {
    const type = wrap.querySelector(".media-type-select").value;
    const sizeEl = wrap.querySelector(".media-image-size");
    return {
      type,
      imageUrl: wrap.querySelector(".media-image-url").value,
      imageAlt: wrap.querySelector(".media-image-alt").value,
      imageSize: sizeEl ? sizeEl.value : "standard",
      videoUrl: wrap.querySelector(".media-video-url").value
    };
  }
  if (field.type === "rich-text") {
    return cleanQuillHTML(wrap._quillInstance.root.innerHTML);
  }
  if (field.type === "button-items") {
    return Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      label: card.querySelector(".btn-label").value,
      url: card.querySelector(".btn-url").value,
      newTab: card.querySelector(".btn-new-tab").checked
    }));
  }
  if (field.type === "nav-card-items") {
    const cards = Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      iconUrl: card.querySelector(".navcard-icon-url").value,
      iconAlt: card.querySelector(".navcard-icon-alt").value,
      description: card.querySelector(".navcard-description").value,
      buttonLabel: card.querySelector(".navcard-button-label").value,
      buttonUrl: card.querySelector(".navcard-url").value,
      newTab: card.querySelector(".navcard-new-tab").checked,
      heading: card.querySelector(".navcard-heading").value,
      targetUrl: card.querySelector(".navcard-url").value
    }));
    return {
      style: wrap._navCardStyleSelect.value,
      autoNumber: wrap._navCardAutoNumber.checked,
      cards
    };
  }
  if (field.type === "resource-card-items") {
    return Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      imageUrl: card.querySelector(".card-image-url").value,
      imageAlt: card.querySelector(".card-image-alt").value,
      title: card.querySelector(".card-title").value,
      linkUrl: card.querySelector(".card-link-url").value,
      newTab: card.querySelector(".card-new-tab").checked,
      type: card.querySelector(".card-type").value,
      duration: card.querySelector(".card-duration").value
    }));
  }
  if (field.type === "icon-toggle-items") {
    return Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      iconUrl: card.querySelector(".icon-url").value,
      iconAlt: card.querySelector(".icon-alt").value,
      label: card.querySelector(".icon-label").value,
      separateImage: card.querySelector(".separate-image-toggle").checked,
      panelImageUrl: card.querySelector(".panel-image-url").value
    }));
  }
  if (field.type === "item-list") {
    return Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      heading: card.querySelector(".item-heading").value,
      content: card.querySelector(".item-content-textarea").value
    }));
  }
  return null;
}

/* ===================================================================
   WIRING
   =================================================================== */

const includeTocToggle = document.getElementById("include-toc-toggle");

document.getElementById("download-html-btn").addEventListener("click", () => {
  const includeToc = includeTocToggle.checked;
  const filename = includeToc ? "gwella-base-html.txt" : "gwella-base-html-no-toc.txt";
  downloadText(filename, getBaseHTML(includeToc));
});

document.getElementById("download-css-btn").addEventListener("click", () => {
  const includeToc = includeTocToggle.checked;
  const filename = includeToc ? "gwella-base-css.txt" : "gwella-base-css-no-toc.txt";
  downloadText(filename, getBaseCSS(includeToc));
});

document.getElementById("download-js-btn").addEventListener("click", () => {
  downloadText("gwella-base-js.txt", BASE_JS);
});

/* ===================================================================
   PREVIEW THEME — the header toggle switches every block preview
   between the two theme classes. The Base HTML download uses the
   same class, so what's previewed is what gets pasted.
   =================================================================== */
let activeTheme = "gwella";
const previewRefreshers = [];

function setTheme(theme) {
  activeTheme = theme;
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    btn.setAttribute("aria-pressed", String(btn.dataset.theme === theme));
  });
  previewRefreshers.forEach(refresh => refresh());
}

document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
  btn.addEventListener("click", () => setTheme(btn.dataset.theme));
});


/* ===================================================================
   CHANGELOG AND UPGRADE CHECKER
   CHANGELOG is the source for release notes and the Upgrade checker.
   Edit it here; this page is the only copy.
   =================================================================== */
const CHANGELOG = {
  "releases": [
    {
      "version": "3.1.1",
      "date": "2026-11-12",
      "summary": "Patch: the page container background is set explicitly to white, so the supplier's grey default no longer shows.",
      "changes": [
        {
          "id": "CHG-3.1.1-01",
          "type": "fix",
          "scope": "base-css",
          "blocks": [],
          "summary": "The #page-container background is set to white. The supplier's default page background changed to grey, so pages built on the base CSS showed grey.",
          "detect": {
            "patterns": ["id=\"page-container\""]
          },
          "outdated": {
            "missing": ["background-color:\\s*white\\s*!important"]
          },
          "action": "copy",
          "page_rebuild": false,
          "notes": "Replace the base CSS. In the #page-container block, background-color must be white !important. Pages on 3.1.0 have it as transparent, which is the line to change."
        }
      ],
      "deprecations": []
    },
    {
      "version": "3.1.0",
      "date": "2026-11-05",
      "summary": "First set of updates on version 3.0.0: colour tokens, theme toggle, two-column block, mobile layout fixes, ordered list numbering, link rel handling, back-to-top icon, nav card and upgrade tooling.",
      "changes": [
        {
          "id": "CHG-3.1.0-01",
          "type": "breaking",
          "scope": "base-css",
          "blocks": [
            "*"
          ],
          "summary": "Colour tokens renamed to the template's names: --navy, --green and --burgundy become --primary-colour; --tertiary-colour becomes --secondary-colour. The old --secondary-colour (navy) is removed, so the name --secondary-colour now means a different colour.",
          "detect": {
            "patterns": [
              "--primary-colour",
              "--secondary-colour",
              "var\\(--(navy|green|burgundy|tertiary-colour)\\)"
            ]
          },
          "action": "copy",
          "notes": "Pages are self-consistent with their own pasted CSS, so they only break if base CSS and block CSS are mixed from different versions. Replace the base CSS and the CSS of every block on the page together. No deprecation aliases existed for this change, so it cannot be done gradually. Note that --secondary-colour changed meaning. It is not a detection pattern, because new pages use it too: check pages that set it by hand.",
          "outdated": {
            "present": [
              "var\\(--(navy|green|burgundy|tertiary-colour)\\)"
            ]
          }
        },
        {
          "id": "CHG-3.1.0-02",
          "type": "visual",
          "scope": "base-css",
          "blocks": [
            "*"
          ],
          "summary": "Ordered lists show their numbers again. The platform strips them from <ol> elements, so the base CSS now restores decimal numbering.",
          "detect": {
            "patterns": [
              "<ol"
            ]
          },
          "action": "copy",
          "notes": "Only pages with ordered lists are affected.",
          "outdated": {
            "missing": [
              "list-style-type:\\s*decimal"
            ]
          }
        },
        {
          "id": "CHG-3.1.0-03",
          "type": "fix",
          "scope": "tool",
          "blocks": [
            "*"
          ],
          "summary": "Double quotes in headings, labels, URLs and alt text are now escaped. Previously they broke the generated attributes.",
          "detect": {
            "patterns": []
          },
          "action": "hand-edit",
          "notes": "Only pages containing a double quote in an attribute value are affected. Replace each such quote with &quot;. Most pages have none.",
          "outdated": {}
        },
        {
          "id": "CHG-3.1.0-04",
          "type": "behaviour",
          "scope": "tool",
          "blocks": [
            "nav-cards",
            "resource-cards",
            "buttons",
            "rich-text"
          ],
          "summary": "rel=\"noopener noreferrer\" is now added only to external links opening in a new tab. Internal links keep target=\"_blank\" alone.",
          "detect": {
            "patterns": []
          },
          "action": "none",
          "notes": "Older pages still carry rel on internal links. That is harmless, so no page change is needed.",
          "outdated": {}
        },
        {
          "id": "CHG-3.1.0-05",
          "type": "visual",
          "scope": "base-html",
          "blocks": [],
          "summary": "The back-to-top button uses the Font Awesome circle-chevron-up icon, coloured with the primary colour, instead of an image.",
          "detect": {
            "patterns": [
              "fa-circle-chevron-up",
              "28516050-c6f7-4b2f-80ac-8bf8b962427a"
            ]
          },
          "action": "copy",
          "notes": "Requires Font Awesome 7, which the base HTML already loads.",
          "outdated": {
            "present": [
              "28516050-c6f7-4b2f-80ac-8bf8b962427a"
            ]
          }
        },
        {
          "id": "CHG-3.1.0-06",
          "type": "visual",
          "scope": "block:flex-section",
          "blocks": [
            "flex-section"
          ],
          "summary": "Flexible content: images are vertically centred on desktop, and on mobile they stack image-first, at 3:2, full width and centred.",
          "detect": {
            "patterns": [
              "class=\"flex-section\""
            ]
          },
          "action": "copy",
          "notes": "Copy the block's CSS. The HTML is unchanged.",
          "outdated": {
            "present": [
              "\\.flex-section\\s*\\{[^}]*align-items:\\s*flex-start"
            ]
          }
        },
        {
          "id": "CHG-3.1.0-07",
          "type": "visual",
          "scope": "block:image-text-section",
          "blocks": [
            "image-text-section"
          ],
          "summary": "Image-text: on mobile, 3:2 images are full width, centred and show the top of the image.",
          "detect": {
            "patterns": [
              "class=\"image-text-section\""
            ]
          },
          "action": "copy",
          "notes": "Copy the block's CSS. The HTML is unchanged.",
          "outdated": {
            "missing": [
              "margin:\\s*0 auto 1rem"
            ]
          }
        },
        {
          "id": "CHG-3.1.0-08",
          "type": "additive",
          "scope": "block:two-column",
          "blocks": [
            "two-column"
          ],
          "summary": "New two-column layout block, with media on the left by default and a flip option.",
          "detect": {
            "patterns": [
              "class=\"two-column"
            ]
          },
          "action": "none",
          "notes": "Existing pages are unaffected. Pages can adopt the block when they are next edited.",
          "outdated": {}
        },
        {
          "id": "CHG-3.1.0-09",
          "type": "visual",
          "scope": "block:buttons",
          "blocks": [
            "buttons"
          ],
          "summary": "Buttons: fixed 250px width by default, centred and wrapping. Inside a two-column or flexible-content block they are full width and stacked.",
          "detect": {
            "patterns": [
              "class=\"buttons\""
            ]
          },
          "action": "copy",
          "notes": "Copy the block's CSS. The HTML is unchanged.",
          "outdated": {
            "missing": [
              "width:\\s*250px"
            ]
          }
        },
        {
          "id": "CHG-3.1.0-10",
          "type": "tool-only",
          "scope": "tool",
          "blocks": [
            "nav-cards"
          ],
          "summary": "Nav cards: link URL and new-tab settings are shared between the two styles. Generate warns when a style has no usable cards.",
          "detect": {
            "patterns": []
          },
          "action": "none",
          "notes": "Form change only. Output is unchanged.",
          "outdated": {}
        },
        {
          "id": "CHG-3.1.0-11",
          "type": "additive",
          "scope": "base-html",
          "blocks": [],
          "summary": "Base HTML, CSS and JS carry a version header, and the page container carries data-base-version.",
          "detect": {
            "patterns": []
          },
          "outdated": {},
          "action": "none",
          "notes": "Pages without the marker are checked against the version chosen in the upgrade tab."
        }
      ],
      "deprecations": []
    },
    {
      "version": "3.0.0",
      "date": "2026-11-05",
      "origin": true,
      "summary": "ORIGIN. The information-hub template page (leadershipportal.thinqi-uat.co.uk/templates/information-hub) as received. Its code is stored unmodified in baseline/3.0.0/. Every later change is recorded against this point.",
      "changes": [],
      "deprecations": []
    }
  ],
  "origin": {
    "version": "3.0.0",
    "source": "https://leadershipportal.thinqi-uat.co.uk/templates/information-hub",
    "baseline_dir": "baseline/3.0.0",
    "status": "code received, stored in baseline/3.0.0"
  }
};

// Schema rules, shown in the Changelog tab.
const SCHEMA_DOC = "# Builder changelog schema (draft v0)\n\nThis design is version 3. Versions 1 and 2 are earlier page builds.\n\nThe changelog is data. Release notes, the upgrade report and the\n\"which pages are affected\" list are all generated from `changelog.json`.\n\n## Release\n\n| Field      | Type   | Notes |\n|------------|--------|-------|\n| `version`  | string | Semver, e.g. `3.0.0`. The major number moves only for a page rebuild (see Versioning). Matches the base version marker. |\n| `date`     | string | ISO date of release. |\n| `summary`  | string | One sentence for the release notes header. |\n| `changes`  | array  | One or more change entries (below). |\n| `deprecations` | array | Optional. Names kept working for one version, then removed. |\n\n## Change\n\n| Field      | Type   | Notes |\n|------------|--------|-------|\n| `id`       | string | Unique, e.g. `CHG-3.0.0-01`. Never reused. |\n| `type`     | enum   | See types below. |\n| `scope`    | string | `base-css`, `base-js`, `base-html`, `block:<id>`, or `tool`. |\n| `blocks`   | array  | Block ids affected. Empty for base or tool-only changes. |\n| `summary`  | string | Plain English, written for the team. |\n| `detect`   | object | `patterns`: regular expressions that find the feature on a page (whether current or outdated). Empty for changes with no page-level signature. |\n| `outdated` | object | `present`: regular expressions that match only the OUTDATED form. `missing`: regular expressions that should appear on a current page; if the feature is on the page and none match, the page is outdated. A page is outdated if any `present` pattern matches, or any `missing` check fails. Required for `copy`, `hand-edit` and `rebuild` changes that have `detect` patterns. |\n| `action`   | enum   | What a page needs. See actions below. |\n| `page_rebuild` | boolean | `true` only if a page cannot be upgraded piece by piece and must be rebuilt from scratch in the tool. Requires `action: rebuild`. Default `false`. |\n| `notes`    | string | Optional. Anything a reviewer must know. |\n\n### Types\n\n- `additive`: new blocks or options. Existing pages unaffected.\n- `visual`: existing output looks different. Pages should be updated to match.\n- `behaviour`: output changes without changing appearance (e.g. attributes). Updated pages behave correctly.\n- `fix`: corrects broken output. Pages built with the bug should be updated.\n- `breaking`: a name or contract changed. Pages may fail unless updated. Must have a deprecation entry or a note explaining why not.\n- `tool-only`: changes to the builder form only. No page output changes, so no page action.\n\n### Actions (map to the three report buckets)\n\n- `none`: no page change needed. (Reports as \"no action\".)\n- `copy`: replace the base CSS, JS or HTML as a whole. (Reports as \"copy directly into the new base code\".)\n- `hand-edit`: a small change that can be made on the page by hand. Describe it in `notes`.\n- `rebuild`: regenerate the block in the builder. (Reports as \"rebuild in the tool\".)\n\n## Deprecation\n\n| Field         | Notes |\n|---------------|-------|\n| `name`        | The old name, e.g. `--navy`. |\n| `replacement` | The new name, e.g. `--primary-colour`. |\n| `removed_in`  | Version in which the old name stops working. At least one minor version after introduction. |\n\nDeprecated names stay in the base CSS, defined as aliases of the new names,\nuntil `removed_in`.\n\n## Reporting\n\nA change is reported for a page only if:\n1. the page is on a version older than the change's release, and\n2. the page uses the feature (`detect`), and\n3. the page is outdated (`outdated`).\n\nPages that use the feature but are already current are listed as \"already current\", so the team can see they were checked.\n\n## Versioning\n\n- Version 3 is this design. Versions 1 and 2 are earlier page builds.\n- Patch (3.0.x): fixes and changes a page can absorb with a copy or hand edit.\n- Minor (3.x.0): additive changes, and visual or behaviour changes that can be copied in.\n- Major (4.0.0): only when a change sets `page_rebuild: true`, meaning an affected page must be rebuilt from scratch.\n\nBreaking changes do not by themselves move the major number. A breaking change that can be handled by copying or editing stays within 3.x.\n";

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const ACTION_LABELS = {
  copy: "Copy the new code in",
  "hand-edit": "Hand edit the page",
  rebuild: "Rebuild in the tool",
};

function copyTargetFor(scope) {
  if (scope === "base-css") return "Replace the base CSS";
  if (scope === "base-js") return "Replace the base JS";
  if (scope === "base-html") return "Replace the base HTML";
  if (scope.startsWith("block:")) return "Replace the CSS of the " + scope.slice(6) + " block";
  return "Replace the affected code";
}

function changeCard(change, label) {
  const card = makeEl("div", "change-card");
  const head = makeEl("div", "change-card-head");
  head.appendChild(makeEl("span", "change-id", change.id));
  head.appendChild(makeEl("span", "change-type change-type--" + change.type, change.type));
  if (label) head.appendChild(makeEl("span", "change-type change-type--action", label));
  card.appendChild(head);
  card.appendChild(makeEl("p", "change-summary", change.summary));
  const meta = [change.scope];
  if (change.blocks && change.blocks.length) meta.push("blocks: " + change.blocks.join(", "));
  card.appendChild(makeEl("p", "change-meta", meta.join(" · ")));
  if (change.notes) card.appendChild(makeEl("p", "change-notes", change.notes));
  return card;
}

function buildChangelogPanel() {
  const panel = makeEl("div", "panel");
  panel.id = "panel-changelog";
  panel.appendChild(makeEl("p", "panel-desc",
    "Release notes for the page builder, newest first. The current version is " + BUILDER_VERSION + "."));
  CHANGELOG.releases.forEach(rel => {
    const section = makeEl("section", "release");
    section.appendChild(makeEl("h3", "release-title", "Version " + rel.version + " · " + rel.date));
    if (!rel.origin) section.appendChild(makeEl("p", "release-summary", rel.summary));
    rel.changes.forEach(c => {
      section.appendChild(changeCard(c, c.action === "none" ? null : ACTION_LABELS[c.action]));
    });
    panel.appendChild(section);
  });
  const errors = validateChangelog(CHANGELOG);
  const count = CHANGELOG.releases.reduce((n, r) => n + r.changes.length, 0);
  panel.appendChild(makeEl("p", "changelog-check " + (errors.length ? "changelog-check--fail" : "changelog-check--pass"),
    errors.length ? "Changelog check failed: " + errors.join("; ") : "Changelog check passed: " + count + " changes."));
  const schema = makeEl("section", "schema-section");
  schema.appendChild(makeEl("h3", "release-title", "Changelog schema"));
  schema.appendChild(makeEl("p", "release-summary", "The rules behind the changelog and the Upgrade checker."));
  const pre = makeEl("pre", "schema-doc", SCHEMA_DOC);
  schema.appendChild(pre);
  panel.appendChild(schema);
  return panel;
}

// Checks the changelog data against the schema rules.
function validateChangelog(cl) {
  const TYPES = ["additive", "visual", "behaviour", "fix", "breaking", "tool-only"];
  const ACTIONS = ["none", "copy", "hand-edit", "rebuild"];
  const errors = [];
  const ids = new Set();
  cl.releases.forEach(rel => {
    if (!/^\d+\.\d+\.\d+$/.test(rel.version)) errors.push("bad version " + rel.version);
    rel.changes.forEach(c => {
      if (ids.has(c.id)) errors.push("duplicate id " + c.id);
      ids.add(c.id);
      if (!c.id.startsWith("CHG-" + rel.version + "-")) errors.push(c.id + " does not match version " + rel.version);
      if (!TYPES.includes(c.type)) errors.push(c.id + " unknown type " + c.type);
      if (!ACTIONS.includes(c.action)) errors.push(c.id + " unknown action " + c.action);
      if (c.type === "tool-only" && c.action !== "none") errors.push(c.id + " tool-only must have action none");
      if (c.type === "breaking" && c.action === "none") errors.push(c.id + " breaking change cannot be action none");
      if (!c.summary) errors.push(c.id + " missing summary");
      if (c.page_rebuild === true && c.action !== "rebuild") errors.push(c.id + " page_rebuild requires action rebuild");
      const o = c.outdated || {};
      const hasOutdated = (o.present || []).length + (o.missing || []).length > 0;
      if (["copy", "hand-edit", "rebuild"].includes(c.action) && c.detect.patterns.length > 0 && !hasOutdated) {
        errors.push(c.id + " needs an outdated rule (present or missing) so pages can be checked");
      }
    });
  });
  cl.releases.forEach(rel => {
    const major = Number(rel.version.split(".")[0]);
    const needsRebuild = rel.changes.some(c => c.page_rebuild === true);
    if (major > 3 && !needsRebuild) errors.push(rel.version + ": major bump needs a change with page_rebuild true");
    if (major === 3 && needsRebuild) errors.push(rel.version + ": page_rebuild requires a major bump");
  });
  return errors;
}

// Returns either {error} or the report for a pasted page.
function checkPage(text, choice) {
  const marker = (text.match(/data-base-version="([\d.]+)"/) || [])[1] || null;
  const pageVersion = choice === "auto" ? marker : choice;
  if (!pageVersion) {
    return { error: "No version marker was found in this page, so its version can't be read. Choose the version it was built from." };
  }
  const legacy = pageVersion === "legacy";
  const from = legacy ? "0.0.0" : pageVersion;
  const matches = list => (list || []).some(pattern => new RegExp(pattern).test(text));
  const groups = { rebuild: [], copy: [], "hand-edit": [], manual: [], current: [], none: [] };
  let newer = false;
  let pageRebuild = false;
  CHANGELOG.releases.forEach(rel => {
    if (compareVersions(rel.version, from) <= 0) return;
    newer = true;
    rel.changes.forEach(c => {
      if (c.page_rebuild === true) pageRebuild = true;
      if (c.detect.patterns.length === 0) {
        if (c.action !== "none") groups.manual.push(c);
        return;
      }
      const o = c.outdated || {};
      const relevant = matches(c.detect.patterns) || matches(o.present);
      if (!relevant) return;
      const outdated = matches(o.present) || ((o.missing || []).length > 0 && !matches(o.missing));
      if (c.action === "none") groups.none.push(c);
      else if (!outdated) groups.current.push(c);
      else groups[c.action].push(c);
    });
  });
  return {
    legacy,
    pageVersion,
    groups,
    upToDate: !newer,
    pageRebuild,
  };
}

function renderGroup(container, title, changes, labelFor) {
  if (changes.length === 0) return;
  container.appendChild(makeEl("h4", "upgrade-group", title + " (" + changes.length + ")"));
  changes.forEach(c => container.appendChild(changeCard(c, labelFor(c))));
}

function renderReport(container, report) {
  if (report.error) {
    container.appendChild(makeEl("p", "upgrade-message", report.error));
    return;
  }
  const from = report.legacy ? "a version before 3.0.0" : "version " + report.pageVersion;
  container.appendChild(makeEl("p", "upgrade-message", report.upToDate
    ? "This page is already at version " + BUILDER_VERSION + ". Nothing to change."
    : "This page is on " + from + ". Current version: " + BUILDER_VERSION + "."));

  if (report.legacy && !report.upToDate) {
    container.appendChild(makeEl("p", "upgrade-warning",
      "The changelog starts at version 3.0.0, so this report may be incomplete for older pages. Rebuilding in the tool is the safer route."));
  }
  if (report.pageRebuild) {
    container.appendChild(makeEl("p", "upgrade-banner",
      "At least one change needs this page rebuilt from scratch in the tool. Upgrading piece by piece won't be enough."));
  }

  const g = report.groups;
  renderGroup(container, "Rebuild in the tool", g.rebuild, () => ACTION_LABELS.rebuild);
  renderGroup(container, "Copy directly into the new code", g.copy, c => copyTargetFor(c.scope));
  renderGroup(container, "Hand edit", g["hand-edit"], () => ACTION_LABELS["hand-edit"]);
  renderGroup(container, "Check manually", g.manual, () => "Check manually");
  renderGroup(container, "Already current (checked, no change needed)", g.current, () => "Already current");
  renderGroup(container, "No action needed", g.none, () => null);

  if (!report.upToDate) {
    container.appendChild(makeEl("p", "upgrade-message",
      "When the changes are made, set data-base-version on #page-container to \"" + BUILDER_VERSION + "\"."));
  }
}

function buildUpgradePanel() {
  const panel = makeEl("div", "panel");
  panel.id = "panel-upgrade";
  panel.appendChild(makeEl("p", "panel-desc",
    "Paste the page's HTML, CSS and JS into their boxes. The checker reads the version marker and lists what the page needs to reach the current version."));

  const inputs = {};
  [["html", "HTML", "Paste the page's HTML here..."], ["css", "CSS", "Paste the page's CSS here (leave empty if none)..."], ["js", "JS", "Paste the page's JS here (leave empty if none)..."]]
    .forEach(([key, label, placeholder]) => {
      const wrap = makeEl("div", "upgrade-field");
      wrap.appendChild(makeEl("label", "upgrade-label", label));
      const area = document.createElement("textarea");
      area.rows = 8;
      area.className = "upgrade-input";
      area.placeholder = placeholder;
      area.setAttribute("aria-label", label + " code");
      wrap.appendChild(area);
      panel.appendChild(wrap);
      inputs[key] = area;
    });

  const row = makeEl("div", "upgrade-row");
  const select = document.createElement("select");
  select.className = "upgrade-version";
  const options = [["auto", "Detect from the page"], ["legacy", "Built before version 3"]]
    .concat(CHANGELOG.releases.map(r => [r.version, "Built on version " + r.version]));
  options.forEach(([value, label]) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  });
  row.appendChild(select);

  const button = makeEl("button", "generate-btn", "Check page");
  button.type = "button";
  row.appendChild(button);
  panel.appendChild(row);

  const result = makeEl("div", "upgrade-result");
  panel.appendChild(result);

  button.addEventListener("click", () => {
    result.replaceChildren();
    const code = Object.values(inputs).map(a => a.value).join("\n");
    if (!code.trim()) {
      result.appendChild(makeEl("p", "upgrade-message", "Paste the page's code first."));
      return;
    }
    renderReport(result, checkPage(code, select.value));
  });
  return panel;
}

const tabbar = document.getElementById("tabbar");
const panelsEl = document.getElementById("panels");
const blockKeys = Object.keys(BLOCKS);

blockKeys.forEach((key, index) => {
  const block = BLOCKS[key];

  const tabBtn = document.createElement("button");
  tabBtn.className = "tab-btn" + (index === 0 ? " active" : "");
  tabBtn.textContent = block.label;
  tabBtn.dataset.tabTarget = key;
  tabbar.appendChild(tabBtn);

  const panel = document.createElement("div");
  panel.className = "panel" + (index === 0 ? " active" : "");
  panel.id = "panel-" + key;

  const desc = document.createElement("p");
  desc.className = "panel-desc";
  desc.textContent = block.description || "";
  panel.appendChild(desc);

  const previewWrap = document.createElement("div");
  previewWrap.className = "preview-wrap";
  previewWrap.innerHTML = `<h3>Live preview</h3><iframe class="live-preview"></iframe>`;
  panel.appendChild(previewWrap);
  const previewFrame = previewWrap.querySelector(".live-preview");

  const fieldEls = block.fields.map(field => {
    const el = buildField(field);
    panel.appendChild(el);
    return el;
  });

  const refreshPreview = () => updatePreview(block, panel, fieldEls, previewFrame);
  previewRefreshers.push(refreshPreview);
  panel.addEventListener("input", refreshPreview);
  panel.addEventListener("change", refreshPreview);
  fieldEls.forEach(el => {
    if (el._quillInstance) el._quillInstance.on("text-change", refreshPreview);
  });
  refreshPreview();

  const generateBtn = document.createElement("button");
  generateBtn.className = "generate-btn";
  generateBtn.textContent = "Generate " + block.label.toLowerCase();
  panel.appendChild(generateBtn);

  const htmlOutputBlock = document.createElement("div");
  htmlOutputBlock.className = "output-block hidden";
  htmlOutputBlock.innerHTML = `
    <h3>${block.htmlOutputLabel || "HTML for this block — paste into .content-body"}</h3>
    <div class="output-wrap">
      <button class="copy-btn">Copy</button>
      <textarea rows="9" readonly></textarea>
    </div>`;
  const warningBox = document.createElement("div");
  warningBox.className = "note generate-warning";
  warningBox.style.cssText = "display:none; margin-top:1rem; padding:0.7rem 0.9rem; border-radius:6px; background:#fff4e5; color:#7a4a00; font-weight:600;";
  panel.appendChild(warningBox);
  panel.appendChild(htmlOutputBlock);

  let secondaryHtmlOutputBlock = null;
  if (block.secondaryHTML) {
    secondaryHtmlOutputBlock = document.createElement("div");
    secondaryHtmlOutputBlock.className = "output-block hidden";
    secondaryHtmlOutputBlock.innerHTML = `
      <h3>${block.secondaryHTML.label}</h3>
      <div class="output-wrap">
        <button class="copy-btn">Copy</button>
        <textarea rows="4" readonly></textarea>
      </div>`;
    panel.appendChild(secondaryHtmlOutputBlock);
  }

  let cssOutputBlock = null;
  if (block.css) {
    cssOutputBlock = document.createElement("div");
    cssOutputBlock.className = "output-block hidden";
    cssOutputBlock.innerHTML = `
      <h3>CSS for this block — paste inside #page-container { ... }</h3>
      <div class="output-wrap">
        <button class="copy-btn">Copy</button>
        <textarea rows="9" readonly></textarea>
      </div>
      <p class="note">This CSS only styles this one block — it doesn't include the base page styling, which you already have from the Base CSS download above.</p>`;
    panel.appendChild(cssOutputBlock);
  }

  let jsOutputBlock = null;
  if (block.js) {
    jsOutputBlock = document.createElement("div");
    jsOutputBlock.className = "output-block hidden";
    jsOutputBlock.innerHTML = `
      <h3>JS for this block — paste inside the Base JS script block</h3>
      <div class="output-wrap">
        <button class="copy-btn">Copy</button>
        <textarea rows="9" readonly></textarea>
      </div>
      <p class="note">Doesn't include its own &lt;script&gt; tags — add this inside the script block from Base JS, not as a separate one. Only needed once even if this block appears multiple times on the same page.</p>`;
    panel.appendChild(jsOutputBlock);
  }

  panelsEl.appendChild(panel);

  if (HOW_IT_WORKS[key]) {
    const howItWorks = document.createElement("details");
    howItWorks.className = "how-it-works";
    howItWorks.innerHTML = `
      <summary>How it works</summary>
      <div class="how-it-works-body">${HOW_IT_WORKS[key]}</div>`;
    panel.appendChild(howItWorks);
  }

  const htmlTextarea = htmlOutputBlock.querySelector("textarea");
  const secondaryHtmlTextarea = secondaryHtmlOutputBlock ? secondaryHtmlOutputBlock.querySelector("textarea") : null;
  const cssTextarea = cssOutputBlock ? cssOutputBlock.querySelector("textarea") : null;
  const jsTextarea = jsOutputBlock ? jsOutputBlock.querySelector("textarea") : null;

  generateBtn.addEventListener("click", () => {
    const values = {};
    block.fields.forEach((field, i) => {
      values[field.id] = collectValue(fieldEls[i], field);
    });
    const warnings = block.warnings ? block.warnings(values) : [];
    warningBox.textContent = warnings.join(" ");
    warningBox.style.display = warnings.length ? "block" : "none";
    htmlTextarea.value = block.generateHTML(values);
    htmlOutputBlock.classList.remove("hidden");
    if (secondaryHtmlOutputBlock) {
      secondaryHtmlTextarea.value = block.secondaryHTML.generate(values);
      secondaryHtmlOutputBlock.classList.remove("hidden");
    }
    if (cssOutputBlock) {
      cssTextarea.value = block.css;
      cssOutputBlock.classList.remove("hidden");
    }
    if (jsOutputBlock) {
      jsTextarea.value = block.js;
      jsOutputBlock.classList.remove("hidden");
    }
  });

  const outputBlocks = [htmlOutputBlock];
  if (secondaryHtmlOutputBlock) outputBlocks.push(secondaryHtmlOutputBlock);
  if (cssOutputBlock) outputBlocks.push(cssOutputBlock);
  if (jsOutputBlock) outputBlocks.push(jsOutputBlock);

  outputBlocks.forEach(outputBlock => {
    const copyBtn = outputBlock.querySelector(".copy-btn");
    const textarea = outputBlock.querySelector("textarea");
    copyBtn.addEventListener("click", () => {
      textarea.select();
      navigator.clipboard.writeText(textarea.value).then(() => {
        const original = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = original;
          copyBtn.classList.remove("copied");
        }, 1500);
      });
    });
  });
});

const toolsTabbar = document.getElementById("tools-tabbar");
const toolsPanels = document.getElementById("tools-panels");
const toolsMenu = document.getElementById("tools-menu");
const toolsToggle = document.getElementById("tools-toggle");

[["upgrade", "Upgrade page", buildUpgradePanel], ["changelog", "Changelog", buildChangelogPanel]].forEach(([key, label, build], index) => {
  const btn = makeEl("button", "tools-tab" + (index === 0 ? " active" : ""), label);
  btn.dataset.toolTarget = key;
  toolsTabbar.appendChild(btn);
  const panel = build();
  panel.classList.toggle("active", index === 0);
  toolsPanels.appendChild(panel);
});

toolsTabbar.querySelectorAll(".tools-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    toolsTabbar.querySelectorAll(".tools-tab").forEach(b => b.classList.remove("active"));
    toolsPanels.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.toolTarget).classList.add("active");
  });
});

function setToolsOpen(open) {
  toolsMenu.classList.toggle("open", open);
  toolsToggle.setAttribute("aria-expanded", String(open));
  toolsToggle.hidden = open;
}
toolsToggle.addEventListener("click", () => setToolsOpen(true));
document.getElementById("tools-close").addEventListener("click", () => setToolsOpen(false));
document.addEventListener("keydown", e => { if (e.key === "Escape") setToolsOpen(false); });

tabbar.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    tabbar.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    panelsEl.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.tabTarget).classList.add("active");
  });
});


// Opens the reference template in its own window.
document.getElementById("open-template-btn").addEventListener("click", () => {
  window.open("template/", "_blank");
});
