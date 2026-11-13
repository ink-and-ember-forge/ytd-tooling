// The migration half of "Upgrade a page", for pages built before version 3.1.0. It fills the sections the upgrade flow
// uses, plus one of its own, so the page keeps one shape:
//   2 why this is a migration   3 the page's own components (kept: the template has nothing to replace them with)
//   4 THE REVIEW: where the page differs from the template, one decision at a time (the template is the default)
//   5 theme + HTML changes   6 check (problems, before/after)   7 copy (locked until the review is finished)
// All the thinking is in src/changelog/ (migrate.js, review.js); this file only shows it.
import { makeEl } from "../lib/dom.js";
import { buildMigration, THEMES } from "../changelog/migrate.js";
import { buildReview, ledgerLine, REASONS } from "../changelog/review.js";
import { loadBaseline } from "../lib/baseline.js";
import { outputCard, renderCheck, pageDoc, plural } from "./upgrade-parts.js";

const codeBlock = (text) => makeEl("pre", "upgrade-diff", text);

// els: { found, tweaks, review, changes, check, copy } (the section elements). code(): the pasted { html, css, js }.
// onUpgradeInstead(): the author wants the normal upgrade flow for this page.
export function createMigrationView(els, { code, onUpgradeInstead }) {
  const state = {
    theme: undefined, reference: null, result: null,
    keep: new Set(),          // the page's own components to carry
    steps: [], decisions: new Map(), reviewed: new Set(), index: 0, // the review
  };
  let htmlList = null;

  const decisionOf = (step) => state.decisions.get(step.id) || { choice: "template", reason: "", note: "" };
  const keptKeys = (steps = state.steps) => steps.filter((s) => decisionOf(s).choice === "keep").flatMap((s) => s.keys);
  const ledger = () => state.steps.filter((s) => decisionOf(s).choice === "keep").map((s) => ledgerLine(s, decisionOf(s)));
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
  // Two frames of the page for one decision: the template's way and yours, with the affected elements outlined.
  function stepFrames(step) {
    const others = keptKeys(state.steps.filter((s) => s !== step));
    const base = [...state.keep, ...others];
    const variants = [["The template", migrate(base, false)], ["Yours", migrate([...base, ...step.keys], false)]];
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
      frame.srcdoc = pageDoc({ html: r.html, css: r.css, js: r.js }, { highlight: step.selectors, scroll: step.scroll });
      cell.appendChild(frame);
      wrap.appendChild(cell);
    });
    return wrap;
  }

  function reviewStep(step) {
    const n = state.steps.length, i = state.index, dec = decisionOf(step);
    const card = makeEl("div", "upgrade-review-card");
    const progress = makeEl("p", "upgrade-review-progress", `Decision ${i + 1} of ${n}`);
    progress.setAttribute("aria-live", "polite");
    card.append(progress, makeEl("h4", "upgrade-review-title", step.title));
    card.appendChild(makeEl("p", "upgrade-review-headline", `${step.headline}. ${step.elements === null ? "" : step.elements === 0 ? "No element on this page matches, so this has no effect here." : `It affects ${plural(step.elements, "element", "elements")} on this page.`}`));
    card.appendChild(makeEl("p", "upgrade-hint", step.why));

    const list = makeEl("ul", "upgrade-review-lines");
    step.lines.forEach((l) => {
      const li = makeEl("li");
      li.append(makeEl("strong", "", `${l.media ? "On small screens: " : ""}${l.where}`), ` — ${l.label}: yours `, makeEl("code", "", l.mine), ", template ", makeEl("code", "", l.template ?? "not set"));
      list.appendChild(li);
    });
    card.appendChild(list);
    card.appendChild(stepFrames(step));

    const fieldset = document.createElement("fieldset");
    fieldset.className = "upgrade-review-choice";
    fieldset.appendChild(makeEl("legend", "", "Your decision"));
    const extras = makeEl("div", "upgrade-review-reason");
    const next = makeEl("button", "primary-btn", i === n - 1 ? "Finish the review" : "Next decision");
    const sync = () => {
      const d = decisionOf(step);
      extras.hidden = d.choice !== "keep";
      next.disabled = d.choice === "keep" && !d.reason;
      next.title = next.disabled ? "Say why you're keeping it first" : "";
    };
    [["template", "Use the template", "recommended"], ["keep", "Keep mine", "this page will differ from the template"]].forEach(([value, label, hint]) => {
      const row = makeEl("label", "upgrade-review-option");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "review-choice";
      radio.value = value;
      radio.checked = dec.choice === value;
      radio.addEventListener("change", () => {
        state.decisions.set(step.id, { ...decisionOf(step), choice: value });
        recompute();
        sync();
        renderChecksAndCopy();
      });
      row.append(radio, " ", makeEl("strong", "", label), makeEl("span", "upgrade-muted", ` — ${hint}`));
      fieldset.appendChild(row);
    });

    const select = document.createElement("select");
    select.className = "upgrade-reason";
    select.setAttribute("aria-label", "Why are you keeping it?");
    select.appendChild(Object.assign(document.createElement("option"), { value: "", textContent: "Why are you keeping it?" }));
    REASONS.forEach(([id, label]) => select.appendChild(Object.assign(document.createElement("option"), { value: id, textContent: label, selected: dec.reason === id })));
    const note = document.createElement("input");
    note.type = "text";
    note.className = "upgrade-note";
    note.placeholder = "Optional: say a little more. This is saved in your CSS.";
    note.setAttribute("aria-label", "A note about why");
    note.value = dec.note;
    const save = () => {
      state.decisions.set(step.id, { ...decisionOf(step), reason: select.value, note: note.value });
      recompute();
      sync();
      renderChecksAndCopy();
    };
    select.addEventListener("change", save);
    note.addEventListener("input", save);
    extras.append(select, note);
    fieldset.appendChild(extras);
    card.appendChild(fieldset);

    const nav = makeEl("div", "upgrade-review-nav");
    const back = makeEl("button", "copy-btn copy-btn--inline", "Back");
    back.type = "button";
    back.disabled = i === 0;
    back.addEventListener("click", () => { state.index = i - 1; renderReview(); });
    next.type = "button";
    next.addEventListener("click", () => { state.reviewed.add(step.id); state.index = i + 1; renderReview(); renderChecksAndCopy(); });
    nav.append(back, next);
    if (i < n - 1) {
      const rest = makeEl("button", "upgrade-link", "Use the template for all the remaining decisions");
      rest.type = "button";
      rest.addEventListener("click", () => {
        state.steps.slice(i).forEach((s) => { state.decisions.set(s.id, { choice: "template", reason: "", note: "" }); state.reviewed.add(s.id); });
        state.index = n;
        recompute();
        renderReview();
        renderChecksAndCopy();
      });
      nav.appendChild(rest);
    }
    card.appendChild(nav);
    sync();
    return card;
  }

  function reviewSummary() {
    const kept = state.steps.filter((s) => decisionOf(s).choice === "keep");
    const box = makeEl("div", "upgrade-review-card upgrade-review-summary");
    box.appendChild(makeEl("h4", "upgrade-review-title", kept.length
      ? `You're keeping ${plural(kept.length, "of your own choices", "of your own choices")}; the template covers the other ${state.steps.length - kept.length}`
      : "Your page will follow the template"));
    box.appendChild(makeEl("p", "upgrade-hint", kept.length ? "The ones you kept are written into the CSS with your reasons, so they can be revisited at the next upgrade." : "Everything your page overrode now comes from the template, so it matches every other page."));
    const list = makeEl("ul", "upgrade-review-lines");
    state.steps.forEach((s, idx) => {
      const d = decisionOf(s), li = makeEl("li");
      li.append(makeEl("strong", "", s.title), d.choice === "keep" ? ` — keeping yours (${(REASONS.find(([id]) => id === d.reason) || REASONS[2])[1].toLowerCase()}${d.note.trim() ? `, ${d.note.trim()}` : ""}) ` : " — using the template ");
      const change = makeEl("button", "upgrade-link", "Change");
      change.type = "button";
      change.addEventListener("click", () => { state.index = idx; renderReview(); });
      li.appendChild(change);
      list.appendChild(li);
    });
    box.appendChild(list);
    return box;
  }

  function renderReview() {
    els.review.hidden = state.steps.length === 0;
    if (!state.steps.length) return;
    const total = state.result.groups.filter((g) => g.kind === "deviation").length;
    els.review.replaceChildren(makeEl("h3", "step-title", "4. Where your page differs from the template"));
    els.review.appendChild(makeEl("p", "upgrade-hint", `Your page overrides the template in ${plural(total, "place", "places")}, grouped into ${plural(state.steps.length, "decision", "decisions")}. The template is where this is heading, so "Use the template" is already chosen. To keep one of yours, choose it and say why. Each decision shows the page both ways, with what it affects outlined.`));
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
    const blocked = !r.ready ? "Choose the page's theme in step 5 first." : left ? `Finish the review in step 4 first (${plural(left, "decision", "decisions")} left).` : null;
    const keptOwn = r.groups.filter((g) => g.kept).length;
    const blocksText = r.blocks.length ? plural(r.blocks.length, "block", "blocks") : "no blocks";
    els.copy.appendChild(outputCard("HTML", `Your HTML, with ${plural(r.htmlChanges.length, "change", "changes")} (see step 5).`, r.html, { blocked }));
    els.copy.appendChild(outputCard("CSS", `The current CSS for ${blocksText}, plus ${plural(keptOwn, "style group", "style groups")} of yours.`, r.css, { blocked }));
    els.copy.appendChild(outputCard("JS", "The current JS. It replaces your old JS, which only did what the current JS does.", r.js));
    r.notes.forEach((n) => els.copy.appendChild(makeEl("p", "upgrade-warning", n)));
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
