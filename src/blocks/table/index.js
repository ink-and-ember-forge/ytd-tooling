import { loadBlockAsset } from "../../lib/assets.js";
import { escapeHTML } from "../../lib/html.js";

export default {
  id: "table",
  label: "Table",
  group: "Content",
  tabLabel: "Table",
  // How the upgrade tool recognises this block on a page (class names / ids in its HTML).
  detect: { classes: ["table-scroll"] },
  description: "A data table in the template's look: a themed header row and thin dividers, or striped rows. It sits in a box that scrolls sideways on a phone, so a wide table never breaks the page. Cells are plain text.",
  fields: [
    { type: "text", id: "caption", label: "Caption (shown above the table; also names the scrolling box for screen readers)", placeholder: "e.g. Preceptorship support by band" },
    { type: "select", id: "style", label: "Rows", default: "light",
      options: [
        { value: "light", label: "Light: dividers between rows (default)" },
        { value: "striped", label: "Striped: every other row tinted" }
      ] },
    { type: "checkbox", id: "headerRow", label: "The first row is a header", default: true },
    { type: "checkbox", id: "headerCol", label: "The first column is a header (each row starts with a label)", default: false },
    { type: "table-grid", id: "cells", label: "Table content", defaultRows: 3, defaultCols: 3 },
  ],
  warnings: (values) => {
    const w = [];
    if (!rowsOf(values).length) w.push("Type something into the table, so nothing was generated.");
    else if (!(values.caption || "").trim()) w.push("Add a caption: it is what a screen reader announces for the scrolling box, and it tells every reader what the table is.");
    return w;
  },
  generateHTML: (values) => {
    const rows = rowsOf(values);
    if (!rows.length) return "";
    const caption = (values.caption || "").trim();
    const headerRow = values.headerRow !== false && rows.length > 1; // a header needs at least one row under it
    const headerCol = values.headerCol === true;
    const cell = (text, c, inHeader) => {
      const t = escapeHTML(text.trim());
      if (inHeader) return `<th scope="col">${t}</th>`;
      return headerCol && c === 0 ? `<th scope="row">${t}</th>` : `<td>${t}</td>`;
    };
    const tr = (cells, inHeader) => `      <tr>${cells.map((t, c) => cell(t, c, inHeader)).join("")}</tr>`;
    const head = headerRow ? `    <thead>\n${tr(rows[0], true)}\n    </thead>\n` : "";
    const bodyRows = headerRow ? rows.slice(1) : rows;
    const cls = values.style === "striped" ? ` class="table--striped"` : "";
    return `<div class="table-scroll" role="region" aria-label="${escapeHTML(caption || "Table")}" tabindex="0">
  <table${cls}>${caption ? `\n    <caption>${escapeHTML(caption)}</caption>` : ""}
${head}    <tbody>
${bodyRows.map((r) => tr(r, false)).join("\n")}
    </tbody>
  </table>
</div>`;
  },
  css: await loadBlockAsset(import.meta.url, "block.css"),
  guide: await loadBlockAsset(import.meta.url, "how-it-works.html"),
};

// The grid as rows of cell text: trailing empty rows and columns are dropped, and every row is padded to the same width.
function rowsOf(values) {
  let rows = (values.cells || []).map((r) => r.map((c) => (c || "").trim()));
  while (rows.length && rows[rows.length - 1].every((c) => !c)) rows.pop();
  if (!rows.length) return [];
  const width = Math.max(...rows.map((r) => { let n = r.length; while (n > 0 && !r[n - 1]) n--; return n; }));
  if (!width) return [];
  return rows.map((r) => Array.from({ length: width }, (_, i) => r[i] || ""));
}
