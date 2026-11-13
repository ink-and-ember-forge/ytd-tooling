// The migration half of "Upgrade a page", for pages built before version 3.1.0. It is a WIZARD: one thing at a time, each on its
// own full slide with Back and Next, instead of one long page:
//   found          why this is a migration
//   components     the page's own components (kept: the template has nothing to replace them with)
//   review         where the page differs from the template: ONE RULE PER SLIDE, with a large preview (the template is the default)
//                  and a summary slide at the end
//   html           the theme, and the changes to the HTML
//   check          problems found, and the page before and after
//   copy           the new HTML, CSS and JS (locked until the review is finished)
//   report         what was decided and why, to download
// The sections it shows are the same elements the ordinary upgrade uses; only one is visible at a time.
// All the thinking is in src/changelog/ (migrate.js, review.js, report.js); this file only shows it.
import { makeEl, downloadText, copyToClipboard } from "../lib/dom.js";
import { buildMigration, THEMES } from "../changelog/migrate.js";
import { buildReview, ledgerLine, REASONS } from "../changelog/review.js";
import { buildReport, reportMarkdown } from "../changelog/report.js";
import { loadBaseline } from "../lib/baseline.js";
import { outputCard, renderCheck, pageDoc, plural } from "./upgrade-parts.js";
import { createCloseup } from "./closeup.js";
import { scanRules, quietRules } from "./scan.js";

const codeBlock = (text) => makeEl("pre", "upgrade-diff", text);
const STEPS = [["found", "What we found"], ["components", "Your components"], ["review", "Review"], ["html", "Theme and HTML"], ["check", "Check"], ["copy", "Copy"], ["report", "Report"]];

// els: { found, tweaks, review, changes, check, copy, report, paste } (the section elements; paste is the paste step, hidden
// while the wizard is open). code(): the pasted { html, css, js }. onUpgradeInstead(): the author wants the normal upgrade flow.
export function createMigrationView(els, { code, onUpgradeInstead }) {
  const state = {
    theme: undefined, reference: null, result: null,
    keep: new Set(),          // the page's own components to carry
    steps: [], rules: [],     // the review: groups, and the flat list of rules (one slide each)
    decisions: new Map(), reviewed: new Set(), // by rule id
    measured: new Map(),      // by rule id: what its preview measured (kept for the report)
    auto: new Set(), quiet: { same: [], none: [] }, autoOn: true, // the rules that make no visible difference, decided for the author
    pos: 0, visited: new Set(), active: false,
    prefs: { mode: "stacked", show: "template" }, // how previews are shown, shared by every slide
  };
  let htmlList = null;
  const bar = makeEl("nav", "wizard-bar");
  bar.setAttribute("aria-label", "Migration steps");
  const foot = makeEl("div", "wizard-foot");
  const back = makeEl("button", "copy-btn copy-btn--inline", "Back");
  const next = makeEl("button", "primary-btn", "Next");
  const hint = makeEl("span", "wizard-foot-hint");
  back.type = next.type = "button";
  foot.append(back, hint, next);
  els.found.parentElement.insertBefore(bar, els.found);
  els.found.parentElement.appendChild(foot);
  bar.hidden = foot.hidden = true;

  // ---- decisions: one per rule, keyed by the rule's id ---------------------------------------------------
  const decisionOf = (row) => state.decisions.get(row.id) || { choice: "template", reason: "", note: "" };
  const setDecision = (row, patch) => state.decisions.set(row.id, { ...decisionOf(row), ...patch });
  const keptRows = () => state.rules.map((r) => r.row).filter((r) => decisionOf(r).choice === "keep");
  const keptKeys = () => keptRows().flatMap((r) => r.keys);
  const ledger = () => keptRows().map((r) => ledgerLine(r, decisionOf(r)));
  const reviewLeft = () => state.rules.filter((r) => !state.reviewed.has(r.row.id)).length;
  const reviewDone = () => reviewLeft() === 0;
  const migrate = (keys, withLedger) => buildMigration(code(), { theme: state.theme, keepGroups: keys, reference: state.reference, ledger: withLedger ? ledger() : [] });
  const recompute = () => { state.result = migrate([...state.keep, ...keptKeys()], true); };

  // The rules that need the author's attention, in order: all of them, less the ones that make no visible difference on this page
  // (those use the template without a question) unless the author asks to see them. k and m number a rule within its group.
  function buildRules() {
    const all = state.steps.flatMap((step) => step.rows.map((row) => ({ row, step })));
    const asked = all.filter((r) => !(state.autoOn && state.auto.has(r.row.id)));
    const total = new Map(), seen = new Map();
    asked.forEach((r) => total.set(r.step, (total.get(r.step) || 0) + 1));
    state.rules = asked.map((r) => { const k = (seen.get(r.step) || 0) + 1; seen.set(r.step, k); return { ...r, k, m: total.get(r.step) }; });
  }
  const allRuleCount = () => state.steps.reduce((n, st) => n + st.rows.length, 0);
  const reviewBase = () => firstOf("review") + (state.auto.size ? 1 : 0); // the position of the first rule slide

  // ---- the order of the slides ----------------------------------------------------------------------------
  const customCount = () => state.result.groups.filter((g) => g.kind === "custom").length;
  function sequence() {
    const seq = [{ slide: "found" }];
    if (customCount()) seq.push({ slide: "components" });
    if (state.auto.size) seq.push({ slide: "review", quick: true }); // the rules that make no visible difference, together
    state.rules.forEach((_, index) => seq.push({ slide: "review", index }));
    if (state.rules.length) seq.push({ slide: "review", index: state.rules.length }); // the summary
    seq.push({ slide: "html" }, { slide: "check" }, { slide: "copy" }, { slide: "report" });
    return seq;
  }
  const here = () => sequence()[state.pos];
  const firstOf = (slide) => Math.max(0, sequence().findIndex((s) => s.slide === slide));

  // ---- 1. why this is a migration -------------------------------------------------------------------------
  function renderFound() {
    const r = state.result;
    els.found.replaceChildren(makeEl("h3", "step-title", "This page needs migrating, not upgrading"));
    els.found.appendChild(makeEl("p", "upgrade-message", "This page was built before version 3.1.0, so it can't be brought up to date piece by piece."));
    els.found.appendChild(makeEl("p", "", "Instead, your HTML is read to see what the page really uses, and the page is moved onto the current template. The template is where this is heading: your page's own components are kept, and you'll decide each place where your page differs from it, one rule at a time."));
    const list = makeEl("ul", "upgrade-signals");
    r.fit.signals.forEach((s) => list.appendChild(makeEl("li", "", s)));
    els.found.appendChild(list);
    const back2 = makeEl("button", "copy-btn copy-btn--inline", "Treat it as a normal upgrade instead");
    back2.type = "button";
    back2.addEventListener("click", () => { stop(); onUpgradeInstead(); });
    els.found.appendChild(back2);
  }

  // ---- 2. the page's own components -----------------------------------------------------------------------
  function renderComponents() {
    const r = state.result;
    const custom = r.groups.filter((g) => g.kind === "custom");
    els.tweaks.replaceChildren(makeEl("h3", "step-title", `Your page's own components (${plural(custom.length, "group", "groups")})`));
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
    leftovers.forEach(([key, title, hint2]) => {
      const items = r.dropped[key];
      if (!items.length) return;
      const details = document.createElement("details");
      details.appendChild(makeEl("summary", "", `${title} (${items.length})`));
      details.appendChild(makeEl("p", "upgrade-hint", hint2));
      details.appendChild(codeBlock(items.map((d) => `${d.media ? `${d.media} ` : ""}${d.selector} { ${d.css} }`).join("\n")));
      els.tweaks.appendChild(details);
    });
  }

  // ---- 3. the review: one rule per slide ------------------------------------------------------------------
  // The whole page, template and yours, for one group: still there on request, as a fold on a rule's slide.
  function wholePage(step) {
    const others = keptKeys().filter((k) => !step.keys.includes(k));
    const wrap = makeEl("div", "upgrade-compare");
    [["The template", migrate([...state.keep, ...others], false)], ["Yours, as you wrote it", migrate([...state.keep, ...others, ...step.keys], false)]].forEach(([label, r]) => {
      const cell = makeEl("div", "upgrade-compare-cell");
      cell.appendChild(makeEl("strong", "upgrade-compare-label", label));
      const frame = document.createElement("iframe");
      frame.className = "upgrade-frame upgrade-frame--small";
      frame.title = `${label}: ${step.title}`;
      frame.setAttribute("sandbox", "allow-scripts");
      frame.srcdoc = pageDoc({ html: r.html, css: r.css, js: r.js }, { highlight: step.selectors, scroll: step.scroll });
      cell.appendChild(frame);
      wrap.appendChild(cell);
    });
    return wrap;
  }

  function reviewRule(i) {
    const { row, step, k, m } = state.rules[i], n = state.rules.length;
    const card = makeEl("div", "upgrade-review-card upgrade-slide");
    const progress = makeEl("p", "upgrade-review-progress", `${step.title} · rule ${k} of ${m} · ${i + 1} of ${n} in all`);
    progress.setAttribute("aria-live", "polite");
    card.append(progress, makeEl("h4", "upgrade-review-title", row.label));

    // What the preview measured replaces guessing from the template's rule for the same selector: the template may style these
    // elements through another selector, so "not set" can be wrong. The report keeps the same numbers.
    const lineEls = [];
    const onMeasured = (m) => {
      state.measured.set(row.id, m);
      lineEls.forEach((el, idx) => {
        const l = m.lines[idx];
        el.querySelector(".upgrade-measured")?.remove();
        if (!l || !l.measurable) return;
        const span = makeEl("span", "upgrade-measured");
        span.append(" On this page the template gives ", makeEl("code", "", l.template === "" ? "not set" : l.template), ", yours gives ", makeEl("code", "", l.yours === "" ? "not set" : l.yours), l.differs ? "" : " (the same)");
        el.appendChild(span);
      });
      renderReport();
    };
    const grid = makeEl("div", "upgrade-slide-grid");
    const main = makeEl("div", "upgrade-slide-main");
    let tpl = null;
    if (row.selectors.length) {
      // Each preview compares ONE rule with the template, so it does not depend on the choices made for the other rules.
      const pages = () => {
        tpl ||= (() => { const r = migrate([...state.keep], false); return { html: r.html, css: r.css, js: r.js }; })();
        const y = migrate([...state.keep, ...row.keys], false);
        return { template: tpl, yours: { html: y.html, css: y.css, js: y.js } };
      };
      main.appendChild(createCloseup(row, pages, { phone: step.width === "phone" && row.lines.every((l) => l.media), prefs: state.prefs, onMeasured }).el);
    } else {
      main.appendChild(makeEl("p", "upgrade-closeup-summary", "This is a design variable the page defines, not a rule for one element, so there is nothing to preview. It changes whatever uses it."));
    }
    const side = makeEl("div", "upgrade-slide-side");
    side.appendChild(makeEl("p", "upgrade-review-hint", row.hint));
    side.appendChild(makeEl("h5", "upgrade-side-title", "What your rule sets"));
    const lines = makeEl("ul", "upgrade-review-lines");
    row.lines.forEach((l) => {
      const item = makeEl("li");
      item.append(`${l.media ? "On small screens: " : ""}${l.where} — ${l.label}: yours `, makeEl("code", "", l.mine), ", template ", makeEl("code", "", l.template ?? "not set"));
      lines.appendChild(item);
      lineEls.push(item);
    });
    side.appendChild(lines);
    const about = document.createElement("details");
    about.className = "upgrade-whole";
    about.appendChild(makeEl("summary", "", `About this group: ${step.title}`));
    about.appendChild(makeEl("p", "upgrade-hint", step.why));
    if (row.linked.length) about.appendChild(makeEl("p", "upgrade-hint upgrade-review-linked", `These rules work together, so they are decided together: ${row.linked.join("; ")}.`));
    const whole = document.createElement("details");
    whole.className = "upgrade-whole";
    whole.appendChild(makeEl("summary", "", "See the whole page for this group, template and yours"));
    let wholeBuilt = false;
    whole.addEventListener("toggle", () => { if (whole.open && !wholeBuilt) { wholeBuilt = true; whole.appendChild(wholePage(step)); } });
    side.append(about, whole);

    // The decision.
    const choice = makeEl("div", "upgrade-review-choice");
    choice.appendChild(makeEl("strong", "upgrade-side-title", "Your decision"));
    const radios = {};
    [["template", "Use the template"], ["keep", "Keep mine"]].forEach(([value, label]) => {
      const lab = makeEl("label", "upgrade-review-option");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "review-choice";
      radio.value = value;
      radio.addEventListener("change", () => { setDecision(row, { choice: value }); changed(); });
      radios[value] = radio;
      lab.append(radio, " ", makeEl("strong", "", label), value === "template" ? makeEl("span", "upgrade-muted", " (the default)") : "");
      choice.appendChild(lab);
    });
    const extras = makeEl("div", "upgrade-review-reason");
    const select = document.createElement("select");
    select.className = "upgrade-reason";
    select.setAttribute("aria-label", "Why are you keeping it?");
    select.appendChild(Object.assign(document.createElement("option"), { value: "", textContent: "Why are you keeping it?" }));
    REASONS.forEach(([id, label]) => select.appendChild(Object.assign(document.createElement("option"), { value: id, textContent: label })));
    const note = document.createElement("input");
    note.type = "text";
    note.className = "upgrade-note";
    note.placeholder = "Optional: say a little more. This is saved in your CSS.";
    note.setAttribute("aria-label", "A note about why");
    select.addEventListener("change", () => { setDecision(row, { reason: select.value }); changed(); });
    note.addEventListener("input", () => { setDecision(row, { note: note.value }); changed(); });
    extras.append(select, note);
    // A shortcut for the common case: the same reason as the last rule they kept.
    const earlier = state.rules.slice(0, i).map((r) => r.row).reverse().find((r) => decisionOf(r).choice === "keep" && decisionOf(r).reason);
    if (earlier) {
      const same = makeEl("button", "upgrade-link", `Same reason as ${earlier.label}`);
      same.type = "button";
      same.addEventListener("click", () => { setDecision(row, { reason: decisionOf(earlier).reason }); changed(); });
      extras.appendChild(same);
    }
    choice.appendChild(extras);
    side.appendChild(choice);

    // Shortcuts for the rest of the review. The template is the default, so these only ever choose the template.
    const rest = makeEl("div", "upgrade-review-shortcuts");
    const decideTemplate = (list, to) => {
      state.reviewed.add(row.id); // this rule's own choice stands; the others take the template
      list.forEach((r) => { setDecision(r.row, { choice: "template", reason: "", note: "" }); state.reviewed.add(r.row.id); });
      recompute();
      renderChecksAndCopy();
      go(reviewBase() + to);
    };
    const nextGroup = state.rules.findIndex((r, idx) => idx > i && r.step !== step);
    if (k < m) {
      const link = makeEl("button", "upgrade-link", "Use the template for the rest of this group");
      link.type = "button";
      link.addEventListener("click", () => decideTemplate(state.rules.filter((r, idx) => idx > i && r.step === step), nextGroup === -1 ? n : nextGroup));
      rest.appendChild(link);
    }
    if (i < n - 1) {
      const link = makeEl("button", "upgrade-link", "Use the template for everything left");
      link.type = "button";
      link.addEventListener("click", () => decideTemplate(state.rules.slice(i + 1), n));
      rest.appendChild(link);
    }
    side.appendChild(rest);
    grid.append(main, side);
    card.appendChild(grid);

    const sync = () => {
      const d = decisionOf(row);
      radios.template.checked = d.choice !== "keep";
      radios.keep.checked = d.choice === "keep";
      extras.hidden = d.choice !== "keep";
      if (select.value !== d.reason) select.value = d.reason;
      if (document.activeElement !== note && note.value !== d.note) note.value = d.note;
      rest.querySelectorAll("button").forEach((b) => { b.disabled = d.choice === "keep" && !d.reason; }); // a kept rule needs its reason first
    };
    function changed() { recompute(); sync(); renderChecksAndCopy(); renderNav(); }
    sync();
    return card;
  }

  function reviewSummary() {
    const kept = keptRows();
    const box = makeEl("div", "upgrade-review-card upgrade-review-summary upgrade-slide");
    box.appendChild(makeEl("h4", "upgrade-review-title", kept.length
      ? `You're keeping ${plural(kept.length, "rule", "rules")} of your own; the template covers the other ${allRuleCount() - kept.length}`
      : "Your page will follow the template"));
    box.appendChild(makeEl("p", "upgrade-hint", kept.length ? "The ones you kept are written into the CSS with your reasons, so they can be revisited at the next upgrade." : "Everything your page overrode now comes from the template, so it matches every other page."));
    const list = makeEl("ul", "upgrade-review-lines");
    state.steps.forEach((s) => {
      const k = s.rows.filter((r) => decisionOf(r).choice === "keep"), li = makeEl("li");
      li.append(makeEl("strong", "", s.title), ` — ${k.length ? `keeping ${k.length} of ${s.rows.length}` : `using the template for all ${s.rows.length}`} `);
      const change = makeEl("button", "upgrade-link", "Change");
      change.type = "button";
      change.addEventListener("click", () => go(reviewBase() + Math.max(0, state.rules.findIndex((r) => r.step === s))));
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

  // The rules that make no visible difference on this page. Nothing to decide: the template is used. One click confirms, and a
  // switch asks about them one by one for an author who wants to.
  function quickSlide() {
    const { same, none } = state.quiet, total = allRuleCount();
    const box = makeEl("div", "upgrade-review-card upgrade-slide upgrade-quick");
    box.appendChild(makeEl("p", "upgrade-review-progress", "Before the rule-by-rule review"));
    box.appendChild(makeEl("h4", "upgrade-review-title", `${state.auto.size} of your ${total} rules make no visible difference on this page`));
    const callout = makeEl("div", "upgrade-callout");
    callout.append(makeEl("strong", "", "Nothing to decide here. "), "With the template's version these rules look exactly the same on this page. Keeping them would only make this page differ from the others, for no visible benefit. ", makeEl("strong", "", state.autoOn ? "They already use the template." : "You have chosen to review them one by one, so they are asked about next."));
    box.appendChild(callout);
    const list = (title, rows, say) => {
      if (!rows.length) return;
      const details = document.createElement("details");
      details.open = true;
      details.appendChild(makeEl("summary", "", `${title} (${rows.length})`));
      const ul = makeEl("ul", "upgrade-review-lines");
      rows.forEach((r) => ul.appendChild(makeEl("li", "", `${r.path}${say(r)}`)));
      details.appendChild(ul);
      box.appendChild(details);
    };
    const measuredBoth = (r) => { const m = state.measured.get(r.id); const l = m && m.lines.filter((x) => x.measurable).map((x) => `${x.label} ${x.yours === "" ? "not set" : x.yours}`); return l && l.length ? ` — ${l.join(", ")} either way` : ""; };
    list("Look the same either way", same, measuredBoth);
    list("Nothing on this page uses them", none, () => " — the page has no element it applies to (it would only matter if you add one later)");
    const choice = makeEl("label", "upgrade-review-option upgrade-quick-switch");
    const box2 = document.createElement("input");
    box2.type = "checkbox";
    box2.checked = !state.autoOn;
    box2.addEventListener("change", () => {
      state.autoOn = !box2.checked;
      if (state.autoOn) state.auto.forEach((id) => { state.decisions.delete(id); }); // back to the template for all of them
      buildRules();
      recompute();
      renderChecksAndCopy();
      go(state.pos);
    });
    choice.append(box2, " ", makeEl("strong", "", "Ask me about these one by one instead"));
    box.appendChild(choice);
    box.appendChild(makeEl("p", "upgrade-hint", "Measured with the page's current content, at desktop and at phone width. Rules that only apply on hover or focus can't be measured, so those are always asked about."));
    return box;
  }

  function renderReview() {
    const h = here();
    if (h.quick) { els.review.replaceChildren(quickSlide()); return; }
    const i = h.slide === "review" ? h.index : 0;
    els.review.replaceChildren(i >= state.rules.length ? reviewSummary() : reviewRule(i));
  }

  // ---- 4. theme and HTML ----------------------------------------------------------------------------------
  function renderHtml() {
    const r = state.result;
    els.changes.replaceChildren(makeEl("h3", "step-title", "Your theme and your HTML"));

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
        renderNav();
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

  // ---- 5, 6 and 7: check, copy, report ---------------------------------------------------------------------
  function renderChecksAndCopy() {
    const r = state.result;
    const wasOpen = els.check.querySelector(".upgrade-preview")?.open;
    renderCheck(els.check, { before: code(), after: { html: r.html, css: r.css, js: r.js }, lint: r.lint, number: null });
    if (wasOpen) els.check.querySelector(".upgrade-preview").open = true;

    els.copy.replaceChildren(makeEl("h3", "step-title", "Copy your migrated page"));
    els.copy.appendChild(makeEl("p", "upgrade-hint", "Replace the old HTML, CSS and JS on the page with these. After that it is an ordinary template page, and future upgrades carry your styles and your reasons forward."));
    const left = reviewLeft();
    const blocked = !r.ready ? "Choose the page's theme first." : left ? `Finish the review first (${plural(left, "rule", "rules")} left).` : null;
    const keptOwn = r.groups.filter((g) => g.kept).length;
    const blocksText = r.blocks.length ? plural(r.blocks.length, "block", "blocks") : "no blocks";
    els.copy.appendChild(outputCard("HTML", `Your HTML, with ${plural(r.htmlChanges.length, "change", "changes")}.`, r.html, { blocked }));
    els.copy.appendChild(outputCard("CSS", `The current CSS for ${blocksText}, plus ${plural(keptOwn, "style group", "style groups")} of yours.`, r.css, { blocked }));
    els.copy.appendChild(outputCard("JS", "The current JS. It replaces your old JS, which only did what the current JS does.", r.js));
    r.notes.forEach((n) => els.copy.appendChild(makeEl("p", "upgrade-warning", n)));
    renderReport();
  }

  function renderReport() {
    const r = state.result;
    els.report.replaceChildren(makeEl("h3", "step-title", "Your migration report"));
    if (!reviewDone()) {
      els.report.appendChild(makeEl("p", "upgrade-hint", `The report appears when the review is finished (${plural(reviewLeft(), "rule", "rules")} left).`));
      return;
    }
    const rep = buildReport(r, state.steps, state.decisions, { date: new Date().toISOString().slice(0, 10), measured: state.measured });
    const t = rep.totals;
    els.report.appendChild(makeEl("p", "upgrade-hint", "What was decided about every place your page differed from the template, and why. Keep it with the page, or give it to whoever looks after the template."));
    const summary = makeEl("ul", "upgrade-report-summary");
    [`${plural(t.differences, "difference", "differences")} from the template, decided as ${plural(t.decisions, "rule", "rules")}.`,
      `Kept as your own: ${t.kept}. Following the template: ${t.template}.`,
      ...(t.template ? [`Of the rules following the template, ${t.visible} change how the page looks, ${t.invisible} make no visible difference, and ${t.unchecked} could not be checked.`] : []),
      `Your own components carried over: ${t.componentsKept} of ${t.components}.`,
      `${plural(t.htmlChanges, "change", "changes")} to your HTML.`].forEach((x) => summary.appendChild(makeEl("li", "", x)));
    els.report.appendChild(summary);

    els.report.appendChild(makeEl("h4", "upgrade-group", `Kept as your own (${t.kept})`));
    if (!rep.kept.length) els.report.appendChild(makeEl("p", "upgrade-hint", "Nothing: the page follows the template everywhere."));
    rep.kept.forEach((k) => {
      const card = makeEl("div", "upgrade-output upgrade-report-kept");
      card.appendChild(makeEl("strong", "", k.title));
      card.appendChild(makeEl("p", "", `Why: ${k.reason}${k.note ? `. ${k.note}` : ""}`));
      if (k.impact?.text) card.appendChild(makeEl("p", "upgrade-hint", `On this page: ${k.impact.text}`));
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
    const labels = { differs: "Changes you will see", unchecked: "Could not be checked", same: "No visible difference on this page" };
    following.appendChild(codeBlock(Object.entries(labels).filter(([k]) => rep.templateGroups[k].length).map(([k, label]) => `${label} (${rep.templateGroups[k].length})\n${rep.templateGroups[k].map((s) => `  ${s.title}${s.impact?.text && k === "differs" ? ` — ${s.impact.text}` : ""}`).join("\n")}`).join("\n\n") || "Nothing: every difference was kept."));
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

  // ---- the wizard chrome: the steps along the top, Back and Next along the bottom ----------------------------
  const sectionOf = { found: els.found, components: els.tweaks, review: els.review, html: els.changes, check: els.check, copy: els.copy, report: els.report };

  function renderBar() {
    const slides = sequence().map((s) => s.slide), cur = here().slide;
    bar.replaceChildren();
    const list = makeEl("ol", "wizard-steps");
    STEPS.filter(([id]) => slides.includes(id)).forEach(([id, label], n) => {
      const li = makeEl("li", "wizard-step-item");
      const b = makeEl("button", "wizard-step", id === "review" && state.rules.length ? `${label} (${state.rules.length - reviewLeft()}/${state.rules.length})` : label);
      b.type = "button";
      b.dataset.step = id;
      if (id === cur) b.setAttribute("aria-current", "step");
      b.classList.toggle("wizard-step--done", id !== cur && (id === "review" ? reviewDone() : state.visited.has(id)));
      b.addEventListener("click", () => go(firstOf(id)));
      li.append(makeEl("span", "wizard-step-number", String(n + 1)), b);
      list.appendChild(li);
    });
    const edit = makeEl("button", "upgrade-link", "Edit the pasted code");
    edit.type = "button";
    edit.addEventListener("click", stop);
    bar.append(list, edit);
  }

  // What stops Next, if anything.
  function blockedBecause() {
    const h = here();
    if (h.slide === "review" && h.index < state.rules.length) {
      const d = decisionOf(state.rules[h.index].row);
      if (d.choice === "keep" && !d.reason) return "Say why you're keeping it first";
    }
    if (h.slide === "html" && !state.result.ready) return "Choose the page's theme first";
    return null;
  }
  function renderNav() {
    const seq = sequence(), h = here();
    back.disabled = state.pos === 0;
    next.hidden = state.pos >= seq.length - 1;
    const why = blockedBecause();
    next.disabled = !!why;
    next.title = why || "";
    hint.textContent = why || "";
    next.textContent = h.slide === "review" && h.index < state.rules.length ? (h.index === state.rules.length - 1 ? "Finish the review" : "Next rule") : "Next";
  }

  function layout() {
    const cur = here().slide;
    Object.entries(sectionOf).forEach(([id, el]) => { el.hidden = id !== cur; });
    state.visited.add(cur);
    renderBar();
    renderNav();
  }

  // Show the slide at `pos`. The new slide's title takes focus (for screen readers) and the wizard is brought to the top, so a slide
  // always starts where it can be read; the builder's own page is the only thing that scrolls.
  function go(pos) {
    const seq = sequence();
    state.pos = Math.max(0, Math.min(seq.length - 1, pos));
    const h = seq[state.pos];
    if (h.slide === "review") renderReview();
    if (h.slide === "report") renderReport();
    layout();
    bar.scrollIntoView({ block: "start", behavior: "auto" });
    const title = sectionOf[h.slide].querySelector(".upgrade-review-title, .step-title");
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
  }

  back.addEventListener("click", () => go(state.pos - 1));
  next.addEventListener("click", () => {
    const h = here();
    if (h.slide === "review" && h.index < state.rules.length) { state.reviewed.add(state.rules[h.index].row.id); renderChecksAndCopy(); }
    go(state.pos + 1);
  });

  function stop() {
    state.active = false;
    bar.hidden = foot.hidden = true;
    els.paste.hidden = false;
    Object.values(sectionOf).forEach((el) => { el.hidden = true; });
  }

  return {
    stop,
    async start() {
      state.theme = undefined;
      // What the template said when it was first stored: a rule that matches that is the OLD template, not the author's choice.
      state.reference ||= await loadBaseline("3.1.1");
      const first = buildMigration(code(), { reference: state.reference, keepGroups: [] });
      state.keep = new Set(first.groups.filter((g) => g.kind === "custom").map((g) => g.key));
      state.decisions = new Map();
      state.reviewed = new Set();
      state.measured = new Map();
      state.visited = new Set();
      state.steps = buildReview(first, code().html);
      // Measure every rule at once: the ones that make no visible difference are decided for the author (the template), so the
      // review is only about what changes something. If it can't be measured, every rule is asked about, as before.
      state.auto = new Set();
      state.quiet = { same: [], none: [] };
      state.autoOn = true;
      const everyRow = state.steps.flatMap((st) => st.rows);
      const asPage = (r) => ({ html: r.html, css: r.css, js: r.js });
      const scan = await scanRules(everyRow, { template: asPage(migrate([...state.keep], false)), yours: asPage(migrate([...state.keep, ...everyRow.flatMap((r) => r.keys)], false)) });
      if (scan) {
        scan.forEach((m, id) => state.measured.set(id, m));
        const quiet = quietRules(everyRow, scan), candidates = [...quiet.same, ...quiet.none];
        // Rules can hide each other (a weight set on a parent hides the same weight on its child when both are on), so each quiet
        // rule is measured again with every OTHER rule kept: only the ones that still make no difference are decided for the author.
        const others = everyRow.filter((r) => !candidates.includes(r)).flatMap((r) => r.keys);
        const verify = candidates.length ? await scanRules(candidates, { template: asPage(migrate([...state.keep, ...others], false)), yours: asPage(migrate([...state.keep, ...others, ...candidates.flatMap((r) => r.keys)], false)) }) : new Map();
        const confirmed = candidates.filter((r) => verify && ["same", "none"].includes(verify.get(r.id)?.status));
        confirmed.forEach((r) => state.auto.add(r.id));
        state.quiet = { same: quiet.same.filter((r) => state.auto.has(r.id)), none: quiet.none.filter((r) => state.auto.has(r.id)) };
      }
      buildRules();
      recompute();
      state.active = true;
      els.paste.hidden = true;
      bar.hidden = foot.hidden = false;
      renderFound();
      renderComponents();
      renderHtml();
      renderChecksAndCopy();
      state.pos = 0;
      go(0);
    },
  };
}
