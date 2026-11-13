// The migration half of "Upgrade a page", for pages built before version 3.1.0. It fills the sections the upgrade flow
// uses, plus one of its own, so the page keeps one shape:
//   2 why this is a migration   3 the page's own components (kept: the template has nothing to replace them with)
//   4 THE REVIEW: where the page differs from the template, one decision at a time (the template is the default)
//   5 theme + HTML changes   6 check (problems, before/after)   7 copy (locked until the review is finished)
//   8 the report: what was decided and why (once the review is finished), to download
// All the thinking is in src/changelog/ (migrate.js, review.js); this file only shows it.
import { makeEl, downloadText, copyToClipboard } from "../lib/dom.js";
import { buildMigration, THEMES } from "../changelog/migrate.js";
import { buildReview, ledgerLine, REASONS } from "../changelog/review.js";
import { buildReport, reportMarkdown } from "../changelog/report.js";
import { loadBaseline } from "../lib/baseline.js";
import { outputCard, renderCheck, pageDoc, plural } from "./upgrade-parts.js";
import { createCloseup } from "./closeup.js";

const codeBlock = (text) => makeEl("pre", "upgrade-diff", text);

// els: { found, tweaks, review, changes, check, copy, report } (the section elements). code(): the pasted { html, css, js }.
// onUpgradeInstead(): the author wants the normal upgrade flow for this page.
export function createMigrationView(els, { code, onUpgradeInstead }) {
  const state = {
    theme: undefined, reference: null, result: null,
    keep: new Set(),          // the page's own components to carry
    steps: [], decisions: new Map(), reviewed: new Set(), index: 0, // the review
  };
  let htmlList = null;

  // Decisions are per RULE (a "row" of a step), keyed by the row's id.
  const decisionOf = (row) => state.decisions.get(row.id) || { choice: "template", reason: "", note: "" };
  const rowsOf = (steps = state.steps) => steps.flatMap((s) => s.rows);
  const keptRows = (steps = state.steps) => rowsOf(steps).filter((r) => decisionOf(r).choice === "keep");
  const keptKeys = (steps = state.steps) => keptRows(steps).flatMap((r) => r.keys);
  const ledger = () => keptRows().map((r) => ledgerLine(r, decisionOf(r)));
  const reviewDone = () => state.steps.every((s) => state.reviewed.has(s.id));
  const migrate = (keys, withLedger) => buildMigration(code(), { theme: state.theme, keepGroups: keys, reference: state.reference, ledger: withLedger ? ledger() : [] });
  const recompute = () => { state.result = migrate([...state.keep, ...keptKeys()], true); };

  // ---- 2. why this is a migration ---------------------------------------------
  function renderFound() {
    const r = state.result;
    els.found.hidden = false;
    els.found.replaceChildren(makeEl("h3", "step-title", "2. This page needs migrating, not upgrading"));
    els.found.appendChild(makeEl("p", "upgrade-message", "This page was built before version 3.1.0, so it can't be brought up to date piece by piece."));
    els.found.appendChild(makeEl("p", "", "Instead, your HTML is read to see what the page really uses, and the page is moved onto the current template. The template is where this is heading: your page's own components are kept, and you'll decide each place where it differs from the template."));
    const list = makeEl("ul", "upgrade-signals");
    r.fit.signals.forEach((s) => list.appendChild(makeEl("li", "", s)));
    els.found.appendChild(list);
    const back = makeEl("button", "copy-btn copy-btn--inline", "Treat it as a normal upgrade instead");
    back.type = "button";
    back.addEventListener("click", onUpgradeInstead);
    els.found.appendChild(back);
  }

  // ---- 3. the page's own components ---------------------------------------------------------------------
  function renderComponents() {
    const r = state.result;
    const custom = r.groups.filter((g) => g.kind === "custom");
    els.tweaks.hidden = false;
    els.tweaks.replaceChildren(makeEl("h3", "step-title", `3. Your page's own components (${plural(custom.length, "group", "groups")})`));
    els.tweaks.appendChild(makeEl("p", "upgrade-hint", "These style classes your HTML uses that the template has no equivalent of, so there is nothing to replace them with. They are kept unless you untick them (unticking removes their styling), and go in a labelled block at the end of the new CSS. Old colour tokens have been renamed to the current ones."));
    const list = makeEl("ul", "upgrade-tweaks upgrade-custom");
    custom.forEach((g) => {
      const li = makeEl("li", "upgrade-tweak");
      const label = makeEl("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = g.kept;
      box.addEventListener("change", () => {
        box.checked ? state.keep.add(g.key) : state.keep.delete(g.key);
        recompute();
        renderChecksAndCopy();
      });
      label.append(box, " ", makeEl("strong", "", g.key));
      li.appendChild(label);
      li.appendChild(codeBlock(g.text));
      g.notes.forEach((n) => li.appendChild(makeEl("p", /not defined/.test(n) ? "upgrade-flag" : "upgrade-hint", n)));
      list.appendChild(li);
    });
    els.tweaks.appendChild(list);

    const leftovers = [
      ["base", "Replaced by the new base", "Old rules for plain elements (p, a, body…) that match what the new base does, or that the template has no equivalent of."],
      ["standard", "Replaced by the new template's CSS", "Parts of rules for classes the current template styles itself, which match what it does."],
      ["unused", "Not used on this page", "Rules for classes that are not in your HTML, left over from other pages. They are dropped."],
    ];
    leftovers.forEach(([key, title, hint]) => {
      const items = r.dropped[key];
      if (!items.length) return;
      const details = document.createElement("details");
      details.appendChild(makeEl("summary", "", `${title} (${items.length})`));
      details.appendChild(makeEl("p", "upgrade-hint", hint));
      details.appendChild(codeBlock(items.map((d) => `${d.media ? `${d.media} ` : ""}${d.selector} { ${d.css} }`).join("\n")));
      els.tweaks.appendChild(details);
    });
  }

  // ---- 4. the review --------------------------------------------------------------------------------------
  // Two frames of the page for one step: the template's way, and yours (as you wrote it) with the affected elements outlined.
  // `focus` is one row: then only that rule is shown, and only its elements are outlined.
  function stepFrames(step, focus) {
    const others = keptKeys(state.steps.filter((s) => s !== step));
    const base = [...state.keep, ...others];
    const mine = focus ? focus.keys : step.keys, outline = focus ? focus.selectors : step.selectors;
    const variants = [["The template", migrate(base, false)], [focus ? `Yours: just ${focus.label}` : "Yours, as you wrote it", migrate([...base, ...mine], false)]];
    const phone = step.width === "phone";
    const wrap = makeEl("div", `upgrade-compare${phone ? " upgrade-compare--phone" : ""}`);
    variants.forEach(([label, r]) => {
      const cell = makeEl("div", "upgrade-compare-cell");
      cell.appendChild(makeEl("strong", "upgrade-compare-label", label));
      const frame = document.createElement("iframe");
      frame.className = `upgrade-frame upgrade-frame--small${phone ? " upgrade-frame--phone" : ""}`;
      frame.title = `${label}: ${step.title}`;
      frame.setAttribute("sandbox", "allow-scripts");
      frame.style.width = phone ? "390px" : "100%";
      frame.srcdoc = pageDoc({ html: r.html, css: r.css, js: r.js }, { highlight: outline, scroll: step.scroll });
      cell.appendChild(frame);
      wrap.appendChild(cell);
    });
    return wrap;
  }

  function reviewStep(step) {
    const n = state.steps.length, i = state.index;
    const card = makeEl("div", "upgrade-review-card");
    const progress = makeEl("p", "upgrade-review-progress", `Group ${i + 1} of ${n}`);
    progress.setAttribute("aria-live", "polite");
    card.append(progress, makeEl("h4", "upgrade-review-title", step.title));
    card.appendChild(makeEl("p", "upgrade-review-headline", `${plural(step.rows.length, "rule", "rules")} to decide. ${step.elements === null ? "" : step.elements === 0 ? "No element on this page matches, so this has no effect here." : `Together they affect ${plural(step.elements, "element", "elements")} on this page.`}`));
    card.appendChild(makeEl("p", "upgrade-hint", step.why));

    card.appendChild(makeEl("p", "upgrade-guide", "How to read this: each rule below has a close-up of one element it changes. The template's version is first, then yours, so you are comparing the same thing both ways. The orange outline marks the element on show (solid) and the others the rule touches (dashed). Use Previous and Next to step through the elements that look different."));
    const whole = document.createElement("details");
    whole.className = "upgrade-whole";
    whole.appendChild(makeEl("summary", "", "See the whole page instead, template and yours"));
    let wholeBuilt = false;
    whole.addEventListener("toggle", () => { if (whole.open && !wholeBuilt) { wholeBuilt = true; whole.appendChild(stepFrames(step, null)); } });
    card.appendChild(whole);

    // Each close-up compares ONE rule with the template, so it does not depend on what is decided for the other rules.
    let templatePage = null;
    const pagesFor = (row) => () => {
      templatePage ||= (() => { const r = migrate([...state.keep], false); return { html: r.html, css: r.css, js: r.js }; })();
      const y = migrate([...state.keep, ...row.keys], false);
      return { template: templatePage, yours: { html: y.html, css: y.css, js: y.js } };
    };

    const next = makeEl("button", "primary-btn", i === n - 1 ? "Finish the review" : "Next group");
    const controls = []; // one per row: { row, sync() }
    const sync = () => {
      controls.forEach((c) => c.sync());
      const missing = step.rows.filter((r) => decisionOf(r).choice === "keep" && !decisionOf(r).reason).length;
      next.disabled = missing > 0;
      next.title = missing ? `Say why you're keeping ${missing === 1 ? "the rule" : "each rule"} you kept first` : "";
    };
    const set = (row, patch) => state.decisions.set(row.id, { ...decisionOf(row), ...patch });
    const changed = () => { recompute(); sync(); renderChecksAndCopy(); };

    // Shortcuts for the whole group. The template is still the default; "keep all" is a deliberate act.
    if (step.rows.length > 1) {
      const bar = makeEl("div", "upgrade-review-shortcuts");
      const all = (choice, label, cls) => {
        const b = makeEl("button", cls, label);
        b.type = "button";
        b.addEventListener("click", () => { step.rows.forEach((r) => set(r, { choice })); changed(); });
        return b;
      };
      const reasonAll = document.createElement("select");
      reasonAll.className = "upgrade-reason";
      reasonAll.setAttribute("aria-label", "Give every kept rule in this group the same reason");
      reasonAll.appendChild(Object.assign(document.createElement("option"), { value: "", textContent: "Same reason for every rule I keep…" }));
      REASONS.forEach(([id, label]) => reasonAll.appendChild(Object.assign(document.createElement("option"), { value: id, textContent: label })));
      reasonAll.addEventListener("change", () => {
        if (!reasonAll.value) return;
        step.rows.filter((r) => decisionOf(r).choice === "keep").forEach((r) => set(r, { reason: reasonAll.value }));
        reasonAll.value = "";
        changed();
      });
      bar.append(all("template", "Use the template for all of these", "copy-btn copy-btn--inline"), all("keep", "Keep all of mine", "copy-btn copy-btn--inline"), reasonAll);
      card.appendChild(bar);
    }

    const list = makeEl("ol", "upgrade-review-rows");
    step.rows.forEach((row, idx) => {
      const li = makeEl("li", "upgrade-review-row");
      const head = makeEl("div", "upgrade-review-row-head");
      head.appendChild(makeEl("strong", "upgrade-review-row-label", row.label));
      head.appendChild(makeEl("span", "upgrade-muted", row.elements === null ? "" : row.elements === 0 ? " — matches nothing on this page" : ` — ${plural(row.elements, "element", "elements")}`));
      li.appendChild(head);
      li.appendChild(makeEl("p", "upgrade-hint upgrade-review-hint", row.hint));
      const lines = makeEl("ul", "upgrade-review-lines");
      row.lines.forEach((l) => {
        const item = makeEl("li");
        item.append(`${l.media ? "On small screens: " : ""}${l.where} — ${l.label}: yours `, makeEl("code", "", l.mine), ", template ", makeEl("code", "", l.template ?? "not set"));
        lines.appendChild(item);
      });
      li.appendChild(lines);
      if (row.selectors.length) li.appendChild(createCloseup(row, pagesFor(row), { phone: step.width === "phone" }).el);

      const choice = makeEl("div", "upgrade-review-choice");
      const radios = {};
      [["template", "Use the template"], ["keep", "Keep mine"]].forEach(([value, label]) => {
        const lab = makeEl("label", "upgrade-review-option");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `review-choice-${step.id}-${idx}`;
        radio.value = value;
        radio.addEventListener("change", () => { set(row, { choice: value }); changed(); });
        radios[value] = radio;
        lab.append(radio, " ", makeEl("strong", "", label), value === "template" ? makeEl("span", "upgrade-muted", " (the default)") : "");
        choice.appendChild(lab);
      });
      const extras = makeEl("div", "upgrade-review-reason");
      const select = document.createElement("select");
      select.className = "upgrade-reason";
      select.setAttribute("aria-label", `Why are you keeping ${row.label}?`);
      select.appendChild(Object.assign(document.createElement("option"), { value: "", textContent: "Why are you keeping it?" }));
      REASONS.forEach(([id, label]) => select.appendChild(Object.assign(document.createElement("option"), { value: id, textContent: label })));
      const note = document.createElement("input");
      note.type = "text";
      note.className = "upgrade-note";
      note.placeholder = "Optional: say a little more. This is saved in your CSS.";
      note.setAttribute("aria-label", `A note about ${row.label}`);
      select.addEventListener("change", () => { set(row, { reason: select.value }); changed(); });
      note.addEventListener("input", () => { set(row, { note: note.value }); changed(); });
      extras.append(select, note);
      choice.appendChild(extras);
      li.appendChild(choice);
      list.appendChild(li);
      controls.push({ row, sync() {
        const d = decisionOf(row);
        radios.template.checked = d.choice !== "keep";
        radios.keep.checked = d.choice === "keep";
        extras.hidden = d.choice !== "keep";
        if (select.value !== d.reason) select.value = d.reason;
        if (document.activeElement !== note && note.value !== d.note) note.value = d.note;
      } });
    });
    card.appendChild(list);

    const nav = makeEl("div", "upgrade-review-nav");
    const back = makeEl("button", "copy-btn copy-btn--inline", "Back");
    back.type = "button";
    back.disabled = i === 0;
    back.addEventListener("click", () => go(i - 1));
    next.type = "button";
    next.addEventListener("click", () => { state.reviewed.add(step.id); renderChecksAndCopy(); go(i + 1); });
    nav.append(back, next);
    if (i < n - 1) {
      const rest = makeEl("button", "upgrade-link", "Use the template for everything in the remaining groups");
      rest.type = "button";
      rest.addEventListener("click", () => {
        state.steps.slice(i).forEach((s) => { s.rows.forEach((r) => set(r, { choice: "template", reason: "", note: "" })); state.reviewed.add(s.id); });
        recompute();
        renderChecksAndCopy();
        go(n);
      });
      nav.appendChild(rest);
    }
    card.appendChild(nav);
    sync();
    return card;
  }

  function reviewSummary() {
    const rows = rowsOf(), kept = keptRows();
    const box = makeEl("div", "upgrade-review-card upgrade-review-summary");
    box.appendChild(makeEl("h4", "upgrade-review-title", kept.length
      ? `You're keeping ${plural(kept.length, "rule", "rules")} of your own; the template covers the other ${rows.length - kept.length}`
      : "Your page will follow the template"));
    box.appendChild(makeEl("p", "upgrade-hint", kept.length ? "The ones you kept are written into the CSS with your reasons, so they can be revisited at the next upgrade." : "Everything your page overrode now comes from the template, so it matches every other page."));
    const list = makeEl("ul", "upgrade-review-lines");
    state.steps.forEach((s, idx) => {
      const k = s.rows.filter((r) => decisionOf(r).choice === "keep"), li = makeEl("li");
      li.append(makeEl("strong", "", s.title), ` — ${k.length ? `keeping ${k.length} of ${s.rows.length}` : `using the template for all ${s.rows.length}`} `);
      const change = makeEl("button", "upgrade-link", "Change");
      change.type = "button";
      change.addEventListener("click", () => go(idx));
      li.appendChild(change);
      if (k.length) {
        const inner = makeEl("ul");
        k.forEach((r) => { const d = decisionOf(r); inner.appendChild(makeEl("li", "", `${r.label}: ${(REASONS.find(([id]) => id === d.reason) || REASONS[2])[1].toLowerCase()}${d.note.trim() ? `, ${d.note.trim()}` : ""}`)); });
        li.appendChild(inner);
      }
      list.appendChild(li);
    });
    box.appendChild(list);
    return box;
  }

  // After moving between decisions, put the new card's top (its number, title and headline) where it can be read, instead of
  // leaving the page wherever the old card's buttons were. Focus goes to the title too, for screen readers, without scrolling.
  function showCard() {
    const card = els.review.querySelector(".upgrade-review-card");
    if (!card) return;
    card.scrollIntoView({ block: "start", behavior: "auto" });
    const title = card.querySelector(".upgrade-review-title");
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  const go = (index) => { state.index = index; renderReview(); showCard(); };

  function renderReview() {
    els.review.hidden = state.steps.length === 0;
    if (!state.steps.length) return;
    const total = state.result.groups.filter((g) => g.kind === "deviation").length;
    els.review.replaceChildren(makeEl("h3", "step-title", "4. Where your page differs from the template"));
    els.review.appendChild(makeEl("p", "upgrade-hint", `Your page overrides the template in ${plural(total, "place", "places")}, grouped by purpose into ${plural(state.steps.length, "group", "groups")}. Every rule has its own choice. The template is where this is heading, so "Use the template" is already chosen. To keep one of yours, choose it and say why. Each group shows the page both ways, with what it affects outlined.`));
    els.review.appendChild(state.index >= state.steps.length ? reviewSummary() : reviewStep(state.steps[state.index]));
  }

  // ---- 5. theme and HTML ----------------------------------------------------------
  function renderHtml() {
    const r = state.result;
    els.changes.hidden = false;
    els.changes.replaceChildren(makeEl("h3", "step-title", "5. Your HTML"));

    const fieldset = document.createElement("fieldset");
    fieldset.className = "upgrade-theme";
    fieldset.appendChild(makeEl("legend", "", "Which theme is this page?"));
    Object.entries(THEMES).forEach(([id, theme]) => {
      const label = makeEl("label", "upgrade-theme-option");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "migrate-theme";
      radio.value = id;
      radio.checked = r.theme === id;
      radio.addEventListener("change", () => {
        state.theme = id;
        recompute();
        renderComponents();
        renderHtmlList();
        renderChecksAndCopy();
      });
      label.append(radio, ` ${theme.label}`);
      if (r.themeDetected === id) label.appendChild(makeEl("span", "upgrade-found", "detected"));
      fieldset.appendChild(label);
    });
    fieldset.appendChild(makeEl("p", "upgrade-hint", r.themeDetected
      ? "Read from your old CSS's brand colour. Change it if that's wrong."
      : "The old CSS doesn't say which theme this is, so choose one. The theme decides the page's colours."));
    els.changes.appendChild(fieldset);

    htmlList = makeEl("div", "upgrade-html-changes");
    els.changes.appendChild(htmlList);
    renderHtmlList();
  }

  function renderHtmlList() {
    const r = state.result;
    htmlList.replaceChildren();
    if (!r.htmlChanges.length) htmlList.appendChild(makeEl("p", "upgrade-hint", "No changes to your HTML are needed."));
    else htmlList.appendChild(makeEl("p", "upgrade-hint", "These are the only changes made to your HTML. Everything else is exactly as you wrote it."));
    r.htmlChanges.forEach((c) => {
      const card = makeEl("div", "upgrade-output");
      card.appendChild(makeEl("strong", "", c.summary));
      card.appendChild(makeEl("p", "upgrade-hint", "Before"));
      card.appendChild(codeBlock(c.before));
      card.appendChild(makeEl("p", "upgrade-hint", "After"));
      card.appendChild(codeBlock(c.after));
      htmlList.appendChild(card);
    });
  }

  // ---- 6 and 7 ------------------------------------------------------------------------
  function renderChecksAndCopy() {
    const r = state.result;
    const wasOpen = els.check.querySelector(".upgrade-preview")?.open;
    els.check.hidden = false;
    renderCheck(els.check, { before: code(), after: { html: r.html, css: r.css, js: r.js }, lint: r.lint, number: 6 });
    if (wasOpen) els.check.querySelector(".upgrade-preview").open = true;

    els.copy.hidden = false;
    els.copy.replaceChildren(makeEl("h3", "step-title", "7. Copy your migrated page"));
    els.copy.appendChild(makeEl("p", "upgrade-hint", "Replace the old HTML, CSS and JS on the page with these. After that it is an ordinary template page, and future upgrades carry your styles and your reasons forward."));
    const left = state.steps.filter((s) => !state.reviewed.has(s.id)).length;
    const blocked = !r.ready ? "Choose the page's theme in step 5 first." : left ? `Finish the review in step 4 first (${plural(left, "group", "groups")} left).` : null;
    const keptOwn = r.groups.filter((g) => g.kept).length;
    const blocksText = r.blocks.length ? plural(r.blocks.length, "block", "blocks") : "no blocks";
    els.copy.appendChild(outputCard("HTML", `Your HTML, with ${plural(r.htmlChanges.length, "change", "changes")} (see step 5).`, r.html, { blocked }));
    els.copy.appendChild(outputCard("CSS", `The current CSS for ${blocksText}, plus ${plural(keptOwn, "style group", "style groups")} of yours.`, r.css, { blocked }));
    els.copy.appendChild(outputCard("JS", "The current JS. It replaces your old JS, which only did what the current JS does.", r.js));
    r.notes.forEach((n) => els.copy.appendChild(makeEl("p", "upgrade-warning", n)));
    renderReport();
  }

  // ---- 8. the report ------------------------------------------------------------------------
  function renderReport() {
    const r = state.result;
    els.report.hidden = !reviewDone();
    if (els.report.hidden) { els.report.replaceChildren(); return; }
    const rep = buildReport(r, state.steps, state.decisions, { date: new Date().toISOString().slice(0, 10) });
    const t = rep.totals;
    els.report.replaceChildren(makeEl("h3", "step-title", "8. Your migration report"));
    els.report.appendChild(makeEl("p", "upgrade-hint", "What was decided about every place your page differed from the template, and why. Keep it with the page, or give it to whoever looks after the template."));
    const summary = makeEl("ul", "upgrade-report-summary");
    [`${plural(t.differences, "difference", "differences")} from the template, decided as ${plural(t.decisions, "rule", "rules")}.`,
      `Kept as your own: ${t.kept}. Following the template: ${t.template}.`,
      `Your own components carried over: ${t.componentsKept} of ${t.components}.`,
      `${plural(t.htmlChanges, "change", "changes")} to your HTML.`].forEach((x) => summary.appendChild(makeEl("li", "", x)));
    els.report.appendChild(summary);

    els.report.appendChild(makeEl("h4", "upgrade-group", `Kept as your own (${t.kept})`));
    if (!rep.kept.length) els.report.appendChild(makeEl("p", "upgrade-hint", "Nothing: the page follows the template everywhere."));
    rep.kept.forEach((k) => {
      const card = makeEl("div", "upgrade-output upgrade-report-kept");
      card.appendChild(makeEl("strong", "", k.title));
      card.appendChild(makeEl("p", "", `Why: ${k.reason}${k.note ? `. ${k.note}` : ""}`));
      if (k.elements !== null) card.appendChild(makeEl("p", "upgrade-hint", `Affects ${plural(k.elements, "element", "elements")} on this page.`));
      const details = document.createElement("details");
      details.appendChild(makeEl("summary", "", "What it overrides"));
      details.appendChild(codeBlock(k.lines.map((l) => `${l.media ? "On small screens: " : ""}${l.where} — ${l.label}: yours ${l.mine}, template ${l.template ?? "not set"}`).join("\n")));
      card.appendChild(details);
      els.report.appendChild(card);
    });

    const following = document.createElement("details");
    following.appendChild(makeEl("summary", "", `Following the template (${t.template})`));
    following.appendChild(makeEl("p", "upgrade-hint", "The page now takes these from the template, so it matches every other page."));
    following.appendChild(codeBlock(rep.template.map((s) => s.title).join("\n") || "Nothing: every difference was kept."));
    els.report.appendChild(following);

    els.report.appendChild(makeEl("h4", "upgrade-group", "Still worth a look"));
    if (!rep.toCheck.length) els.report.appendChild(makeEl("p", "upgrade-hint", "Nothing flagged."));
    else { const list = makeEl("ul", "upgrade-report-check"); rep.toCheck.forEach((c) => list.appendChild(makeEl("li", "", c))); els.report.appendChild(list); }

    const markdown = reportMarkdown(rep);
    const actions = makeEl("div", "upgrade-review-nav");
    const download = makeEl("button", "primary-btn", "Download report");
    download.type = "button";
    download.addEventListener("click", () => downloadText("migration-report.md", markdown));
    const copy = makeEl("button", "copy-btn copy-btn--inline", "Copy report");
    copy.type = "button";
    copy.addEventListener("click", () => copyToClipboard(markdown, copy));
    actions.append(download, copy);
    els.report.appendChild(actions);
  }

  return {
    async start() {
      state.theme = undefined;
      // What the template said when it was first stored: a rule that matches that is the OLD template, not the author's choice.
      state.reference ||= await loadBaseline("3.1.1");
      const first = buildMigration(code(), { reference: state.reference, keepGroups: [] });
      state.keep = new Set(first.groups.filter((g) => g.kind === "custom").map((g) => g.key));
      state.decisions = new Map();
      state.reviewed = new Set();
      state.index = 0;
      state.steps = buildReview(first, code().html);
      recompute();
      renderFound();
      renderComponents();
      renderReview();
      renderHtml();
      renderChecksAndCopy();
    },
  };
}
