import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML, slugify } from "../../lib/html.js";

export default {
  id: "section",
  label: "Section",
  // How the block appears in the builder's tab bar (display only).
  group: "Structure",
  tabLabel: "Section",
  description: "Start here for every new bit of content — wraps it in a properly-idd <section> with its heading, and generates the matching table-of-contents entry at the same time, so those two ids can never drift apart.",
  fields: [
    { type: "text", id: "title", label: "Section title", placeholder: "e.g. Putting into practice" },
    { type: "checkbox", id: "tightHeading", label: "This section comes directly below the page title",
      help: "Tick this for the first section on a page that has no At a glance box. It closes the large gap between the page title and this heading." }
  ],
  htmlOutputLabel: "HTML for this section — paste into .content-body, then paste other blocks' content where marked",
  generateHTML: (values) => {
    const title = values.title.trim();
    const headingClass = values.tightHeading ? ' class="tight-heading"' : "";
    return `<section id="${slugify(title)}">
  <h2${headingClass}>${escapeHTML(title)}</h2>

  <!-- Content goes here -->

</section>`;
  },
  secondaryHTML: {
    label: "Table of contents entry — paste inside &lt;nav id=\"table-of-contents\"&gt;",
    generate: (values) => {
      const title = values.title.trim();
      return `<li><a href="#${slugify(title)}" class="toc-link">${escapeHTML(title)}</a></li>`;
    }
  },
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};
