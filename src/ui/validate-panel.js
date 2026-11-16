// "Validate code": paste HTML, CSS and JS, and get a report of what is wrong with it, next to the code. All the checking is in
// src/validate/ (pure); this file only shows it.
//
//   left   the code, one tab per language, with a line gutter; lines with findings are marked
//   right  the findings, most serious first, filterable by severity
// The two are linked both ways: choosing a finding scrolls to and highlights its range (and the other places it names); choosing a
// marked line in the code chooses the first finding on it, and again goes on to the next.
import { makeEl } from "../lib/dom.js";
import { validate, SEVERITIES } from "../validate/index.js";
import { associateLabels } from "./a11y.js";

const LANGS = [["html", "HTML"], ["css", "CSS"], ["js", "JS"]];
const SEV_LABEL = { error: "Error", warning: "Warning", info: "Note" };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function buildValidatePanel() {
  const panel = makeEl("div", "view");
  panel.id = "view-validate";
  panel.appendChild(makeEl("h2", "view-title", "Validate code"));
  panel.appendChild(makeEl("p", "panel-desc", "Paste a page's HTML, CSS and JS and get a report of what is wrong with it, with line numbers, next to the code. It checks the markup (tags that are never closed, ids used twice, links to nothing), the CSS (braces that don't balance) and, across the two, CSS that is never used by the HTML. It reports; it never changes your code."));

  // ---- paste ----
  const step = makeEl("section", "step");
  step.appendChild(makeEl("h3", "step-title", "Paste the code"));
  const inputs = {};
  [["html", "HTML", "Paste the HTML here..."], ["css", "CSS", "Paste the CSS here, with or without the <style> tags (leave empty if none)..."], ["js", "JS", "Paste the JS here, with or without the <script> tags (leave empty if none)..."]].forEach(([key, label, placeholder]) => {
    const wrap = makeEl("div", "upgrade-field");
    wrap.appendChild(makeEl("label", "upgrade-label", label));
    const area = document.createElement("textarea");
    area.rows = 6;
    area.className = "upgrade-input";
    area.placeholder = placeholder;
    area.spellcheck = false;
    wrap.appendChild(area);
    step.appendChild(wrap);
    inputs[key] = area;
  });
  const run = makeEl("button", "primary-btn", "Validate");
  run.type = "button";
  step.appendChild(run);
  panel.appendChild(step);

  // ---- report ----
  const report = makeEl("section", "validate-report");
  report.hidden = true;
  report.setAttribute("aria-label", "Validation report");
  const bar = makeEl("div", "validate-bar");
  const summary = makeEl("p", "validate-summary");
  summary.setAttribute("aria-live", "polite");
  const filters = makeEl("div", "validate-filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Show findings of these kinds");
  const edit = makeEl("button", "copy-btn copy-btn--inline", "Edit the code");
  edit.type = "button";
  bar.append(summary, filters, edit);
  const split = makeEl("div", "validate-split");
  const codePane = makeEl("div", "validate-codepane");
  const tabs = makeEl("div", "validate-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Code");
  const code = makeEl("div", "validate-code");
  code.setAttribute("role", "tabpanel");
  code.tabIndex = 0;
  codePane.append(tabs, code);
  const listPane = makeEl("div", "validate-listpane");
  const list = makeEl("ul", "validate-findings");
  listPane.appendChild(list);
  split.append(codePane, listPane);
  report.append(bar, split);
  panel.appendChild(report);

  // ---- state ----
  const state = { source: { html: "", css: "", js: "" }, result: null, lang: "html", selected: null, show: { error: true, warning: true, info: true }, cycle: new Map() };
  const visible = () => state.result.findings.filter((f) => state.show[f.severity]);
  const worst = (fs) => SEVERITIES.find((s) => fs.some((f) => f.severity === s));

  // ---- the code, one tab at a time ----
  let lineEls = [], lineText = [];
  function renderCode() {
    const text = state.source[state.lang];
    code.setAttribute("aria-label", `${state.lang.toUpperCase()} code`);
    code.replaceChildren();
    lineEls = []; lineText = [];
    if (!text.trim()) { code.appendChild(makeEl("p", "validate-empty", `No ${state.lang.toUpperCase()} was pasted.`)); return; }
    const byLine = new Map();
    for (const f of visible().filter((f) => f.language === state.lang)) for (let l = f.line; l <= Math.max(f.line, f.endLine); l++) (byLine.get(l) || byLine.set(l, []).get(l)).push(f);
    const frag = document.createDocumentFragment();
    text.split("\n").forEach((line, i) => {
      const n = i + 1, row = makeEl("div", "vline"), found = byLine.get(n);
      row.dataset.line = n;
      const gutter = found ? makeEl("button", `vno vno--${worst(found)}`, String(n)) : makeEl("span", "vno", String(n));
      if (found) {
        gutter.type = "button";
        gutter.setAttribute("aria-label", `Line ${n}: ${plural(found.length, "finding", "findings")}`);
        gutter.addEventListener("click", () => {
          const here = visible().filter((f) => f.language === state.lang && f.line <= n && n <= Math.max(f.line, f.endLine));
          const at = (state.cycle.get(`${state.lang}:${n}`) ?? -1) + 1;
          state.cycle.set(`${state.lang}:${n}`, at % here.length);
          select(here[at % here.length]);
        });
        row.classList.add(`vline--${worst(found)}`);
      }
      const t = makeEl("span", "vtext", line || " ");
      row.append(gutter, t);
      frag.appendChild(row);
      lineEls.push(row); lineText.push(line);
    });
    code.appendChild(frag);
    paintSelection();
  }

  // Highlight the chosen finding's range, and the other places it names that are in this tab.
  function paintSelection() {
    lineEls.forEach((row, i) => { row.classList.remove("vline--sel", "vline--rel"); row.querySelector(".vtext").textContent = lineText[i] || " "; });
    const f = state.selected;
    if (!f) return;
    if (f.language === state.lang) {
      for (let l = f.line; l <= Math.max(f.line, f.endLine); l++) lineEls[l - 1]?.classList.add("vline--sel");
      if (f.endLine === f.line && f.endColumn > f.column) {
        const t = lineText[f.line - 1] || "", span = lineEls[f.line - 1]?.querySelector(".vtext");
        if (span) span.replaceChildren(t.slice(0, f.column - 1), Object.assign(makeEl("mark", "vmark", t.slice(f.column - 1, f.endColumn - 1)), {}), t.slice(f.endColumn - 1));
      }
    }
    f.related.filter((r) => r.language === state.lang).forEach((r) => lineEls[r.line - 1]?.classList.add("vline--rel"));
  }

  // Scroll the code pane (never the page) so a line sits in the middle.
  function reveal(line) {
    const row = lineEls[line - 1];
    if (row) code.scrollTop = Math.max(0, row.offsetTop - code.clientHeight / 2 + row.offsetHeight / 2);
  }

  function showLang(lang) {
    state.lang = lang;
    tabs.querySelectorAll("button").forEach((b) => { const on = b.dataset.lang === lang; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    renderCode();
  }

  function renderTabs() {
    tabs.replaceChildren();
    LANGS.forEach(([id, label]) => {
      const n = visible().filter((f) => f.language === id).length;
      const b = makeEl("button", "validate-tab", n ? `${label} (${n})` : label);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.dataset.lang = id;
      b.addEventListener("click", () => showLang(id));
      b.addEventListener("keydown", (e) => {
        const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        const next = LANGS[(LANGS.findIndex(([x]) => x === id) + dir + LANGS.length) % LANGS.length][0];
        showLang(next);
        tabs.querySelector(`[data-lang="${next}"]`).focus();
      });
      tabs.appendChild(b);
    });
    tabs.querySelectorAll("button").forEach((b) => { const on = b.dataset.lang === state.lang; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  }

  // ---- the findings ----
  function jump(language, line) {
    if (language !== state.lang) showLang(language);
    reveal(line);
    const row = lineEls[line - 1];
    if (row) { row.classList.add("vline--flash"); setTimeout(() => row.classList.remove("vline--flash"), 1200); }
  }

  function select(f) {
    state.selected = f;
    if (f.language !== state.lang) showLang(f.language); else paintSelection();
    reveal(f.line);
    list.querySelectorAll(".vf-item").forEach((li) => {
      const on = li.__finding === f;
      li.classList.toggle("vf-item--sel", on);
      li.querySelector(".vf").setAttribute("aria-current", on ? "true" : "false");
      li.querySelector(".vf-detail").hidden = !on;
    });
    // Bring the chosen item into view inside the list only (scrollIntoView would scroll the whole page too).
    const item = list.querySelector(".vf-item--sel");
    if (item) {
      if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
      else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
    }
  }

  function renderList() {
    list.replaceChildren();
    const shown = visible();
    if (!shown.length) {
      list.appendChild(makeEl("li", "validate-none", state.result.findings.length ? "Nothing to show with these filters." : "No problems found."));
      return;
    }
    for (const f of shown) {
      const li = makeEl("li", `vf-item vf-item--${f.severity}`);
      li.__finding = f;
      const b = makeEl("button", "vf");
      b.type = "button";
      b.dataset.id = f.id;
      b.setAttribute("aria-current", "false");
      b.append(makeEl("span", `vf-sev vf-sev--${f.severity}`, SEV_LABEL[f.severity]), makeEl("span", "vf-where", `${f.language.toUpperCase()} ${f.line}:${f.column}`), makeEl("span", "vf-msg", f.message));
      b.addEventListener("click", () => select(f));
      const detail = makeEl("div", "vf-detail");
      detail.hidden = true;
      if (f.why) detail.appendChild(makeEl("p", "vf-why", f.why));
      detail.appendChild(makeEl("p", "vf-id", f.id));
      if (f.related.length) {
        const rel = makeEl("ul", "vf-related");
        f.related.forEach((r) => {
          const item = makeEl("li");
          const jumpBtn = makeEl("button", "upgrade-link", `${r.language.toUpperCase()} line ${r.line}`);
          jumpBtn.type = "button";
          jumpBtn.addEventListener("click", () => jump(r.language, r.line));
          item.append(jumpBtn, ` — ${r.note}`);
          rel.appendChild(item);
        });
        detail.appendChild(rel);
      }
      li.append(b, detail);
      list.appendChild(li);
    }
  }

  function renderFilters() {
    filters.replaceChildren();
    SEVERITIES.forEach((sev) => {
      const n = state.result.counts[sev];
      const b = makeEl("button", `validate-filter validate-filter--${sev}`, `${SEV_LABEL[sev]} ${n}`);
      b.type = "button";
      b.dataset.severity = sev;
      b.setAttribute("aria-pressed", String(state.show[sev]));
      b.disabled = n === 0;
      b.addEventListener("click", () => { state.show[sev] = !state.show[sev]; state.selected = null; refresh(); });
      filters.appendChild(b);
    });
  }

  function refresh() {
    const { counts } = state.result;
    summary.textContent = counts.error + counts.warning + counts.info === 0
      ? "No problems found."
      : `${plural(counts.error, "error", "errors")}, ${plural(counts.warning, "warning", "warnings")}, ${plural(counts.info, "note", "notes")}.`;
    renderFilters();
    renderTabs();
    renderList();
    renderCode();
  }

  run.addEventListener("click", () => {
    state.source = { html: inputs.html.value, css: inputs.css.value, js: inputs.js.value };
    state.result = validate(state.source);
    state.selected = null;
    state.cycle.clear();
    state.show = { error: true, warning: true, info: true };
    // Open on the first tab that has something to say.
    const first = state.result.findings[0];
    state.lang = first ? first.language : "html";
    step.hidden = true;
    report.hidden = false;
    refresh();
  });
  edit.addEventListener("click", () => { report.hidden = true; step.hidden = false; inputs.html.focus(); });

  associateLabels(panel);
  return panel;
}
