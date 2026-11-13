// "Upgrade a page": paste the page's code, check it, and get the upgraded HTML, CSS and JS
// ready to copy. All the thinking is in src/changelog/upgrade.js; this file only shows it.
//
// One page, sections unlock after "Check my page":
//   1 paste  2 what we found (version, blocks)  3 the author's own tweaks (opt in)
//   4 what is changing  5 copy the upgraded page (with a self-check)
import { makeEl, copyToClipboard } from "../lib/dom.js";
import { changeCard, ACTION_LABELS } from "./change-card.js";
import { CHANGELOG, BUILDER_VERSION } from "../changelog/index.js";
import { buildUpgrade, upgradePage } from "../changelog/upgrade.js";
import { BLOCK_LIST } from "../blocks/index.js";
import { associateLabels } from "./a11y.js";
import { toast } from "./toast.js";

const markerOf = (text) => (text.match(/data-base-version="([\d.]+)"/) || [])[1] || null;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// How a change is described to an author, in the order they are shown.
const CHANGE_GROUPS = [["breaking", "Needs attention"], ["visual", "Looks different"], ["behaviour", "Works differently"], ["fix", "Fixes"], ["additive", "New"]];

// A tweak, as [where, what, standard value].
const place = (path) => path.filter((p, i) => !(i === 0 && p === "#page-container")).join(" › ") || "The whole page";
function describeEdit(e) {
  const v = (x) => x.join(" / ");
  switch (e.kind) {
    case "changed-decl": return [place(e.path), `${e.prop} is ${v(e.to)}`, v(e.from)];
    case "added-decl": return [place(e.path), `adds ${e.prop}: ${v(e.to)}`, null];
    case "added-rule": return [place([...e.path, e.selector]), "a rule of your own", null];
    case "removed-decl": return [place(e.path), `removes ${e.prop}`, v(e.from)];
    default: return [place([...e.path, e.selector]), "rule removed", null];
  }
}

export function buildUpgradePanel() {
  const panel = makeEl("div", "view");
  panel.id = "view-upgrade";
  panel.appendChild(makeEl("h2", "view-title", "Upgrade a page"));
  panel.appendChild(makeEl("p", "panel-desc",
    "Bring a page built on an older version of the template up to version " + BUILDER_VERSION + ". Paste the page's code and you get the upgraded HTML, CSS and JS back, ready to paste over the old ones. Nothing is changed on the page itself."));

  // ---- 1. paste ----------------------------------------------------------------
  const step1 = makeEl("section", "step");
  step1.appendChild(makeEl("h3", "step-title", "1. Paste your page's code"));
  const inputs = {};
  [["html", "HTML", "Paste the page's HTML here..."], ["css", "CSS", "Paste the page's CSS here, including the <style> tags (leave empty if none)..."], ["js", "JS", "Paste the page's JS here, including the <script> tags (leave empty if none)..."]]
    .forEach(([key, label, placeholder]) => {
      const wrap = makeEl("div", "upgrade-field");
      wrap.appendChild(makeEl("label", "upgrade-label", label));
      const area = document.createElement("textarea");
      area.rows = 6;
      area.className = "upgrade-input";
      area.placeholder = placeholder;
      wrap.appendChild(area);
      step1.appendChild(wrap);
      inputs[key] = area;
    });
  const detected = makeEl("p", "upgrade-detected", "Paste the HTML above and the page's version is read from it.");
  detected.setAttribute("aria-live", "polite");
  const checkBtn = makeEl("button", "primary-btn", "Check my page");
  checkBtn.type = "button";
  step1.append(detected, checkBtn);
  panel.appendChild(step1);

  // The results: nothing here until the page has been checked.
  const results = makeEl("div", "upgrade-results");
  results.hidden = true;
  const foundEl = makeEl("section", "step");
  const tweaksEl = makeEl("section", "step");
  const changesEl = makeEl("section", "step");
  const copyEl = makeEl("section", "step");
  [foundEl, tweaksEl, changesEl, copyEl].forEach((el) => el.setAttribute("aria-live", "polite"));
  results.append(foundEl, tweaksEl, changesEl, copyEl);
  panel.appendChild(results);

  // ---- state -------------------------------------------------------------------
  const code = () => ({ html: inputs.html.value, css: inputs.css.value, js: inputs.js.value });
  const choice = { version: "auto" };   // "auto", "legacy" or a version, as chosen by the author
  const state = { result: null, baseline: undefined, blocks: new Set(), keep: new Set() };

  inputs.html.addEventListener("input", () => {
    const m = markerOf(inputs.html.value);
    detected.textContent = m ? `Version ${m} found in the page's HTML.` : inputs.html.value.trim() ? "No version marker found in the HTML. You'll be asked to choose the version." : "Paste the HTML above and the page's version is read from it.";
  });

  async function check() {
    if (!Object.values(code()).some((t) => t.trim())) {
      toast("Paste the page's code first");
      return;
    }
    checkBtn.disabled = true;
    try {
      const result = await upgradePage(code(), { version: choice.version });
      state.result = result;
      state.baseline = result.baseline;
      state.blocks = new Set(result.blocks || []);
      state.keep = new Set();
      // Tweaks are opt-in: the engine keeps every tweak unless told which to keep, so tell it "none yet".
      if (!result.error && !result.upToDate) recompute();
      results.hidden = false;
      renderAll();
    } finally {
      checkBtn.disabled = false;
    }
  }
  checkBtn.addEventListener("click", check);

  // Re-run the engine for the current ticks (instant: the baseline is already loaded).
  function recompute() {
    const prev = state.result;
    const next = buildUpgrade(code(), { version: prev.pageVersion, blockIds: [...state.blocks], keepEdits: [...state.keep], baseline: state.baseline });
    state.result = { ...next, suggestions: prev.suggestions, baseline: state.baseline };
  }

  // ---- 2. what we found --------------------------------------------------------
  function renderFound() {
    const r = state.result;
    foundEl.replaceChildren(makeEl("h3", "step-title", "2. Here's what we found"));
    if (r.error) {
      foundEl.appendChild(makeEl("p", "upgrade-message", r.error));
      renderSuggestions(foundEl, r.suggestions);
      foundEl.appendChild(versionPicker());
      return;
    }
    foundEl.appendChild(makeEl("p", "upgrade-message", r.pageVersion === "legacy"
      ? `This page was built before version 3. The latest version is ${BUILDER_VERSION}.`
      : r.upToDate ? `This page is already at version ${BUILDER_VERSION}. Nothing to change.` : `This page was built on version ${r.pageVersion}. The latest version is ${BUILDER_VERSION}.`));
    if (r.pageVersion === "legacy") {
      foundEl.appendChild(makeEl("p", "upgrade-warning", "The changelog starts at version 3.0.0, so this report may be incomplete for older pages. Rebuilding in the tool is the safer route."));
    }
    if (r.report.pageRebuild) {
      foundEl.appendChild(makeEl("p", "upgrade-banner", "At least one change needs this page rebuilt from scratch in the tool. Upgrading piece by piece won't be enough."));
    }
    renderSuggestions(foundEl, r.suggestions, r.pageVersion);
    foundEl.appendChild(versionPicker());
    if (r.upToDate) return;

    // Blocks: every block that has code, with the ones found on the page ticked.
    foundEl.appendChild(makeEl("h4", "upgrade-group", "Blocks on your page"));
    foundEl.appendChild(makeEl("p", "upgrade-hint", "Only these blocks' styling goes into the upgraded CSS. Tick any we missed, untick any you don't use."));
    const grid = makeEl("div", "upgrade-blocks");
    const detectedHere = new Set(r.blocks);
    BLOCK_LIST.filter((b) => b.detect).forEach((b) => {
      const label = makeEl("label", "upgrade-block");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = state.blocks.has(b.id);
      box.addEventListener("change", () => {
        box.checked ? state.blocks.add(b.id) : state.blocks.delete(b.id);
        recompute();
        renderTweaks();
        renderCopy();
      });
      label.append(box, " " + b.label);
      if (detectedHere.has(b.id)) label.appendChild(makeEl("span", "upgrade-found", "found"));
      grid.appendChild(label);
    });
    foundEl.appendChild(grid);

    const notes = r.notes.filter((n) => !/^The page's JS differs|not kept:|^This CSS is closest to/.test(n));
    if (notes.length) {
      foundEl.appendChild(makeEl("h4", "upgrade-group", "Heads up"));
      notes.forEach((n) => foundEl.appendChild(makeEl("p", "upgrade-warning", n)));
    }
  }

  function versionPicker() {
    const details = document.createElement("details");
    details.className = "upgrade-version-details";
    details.appendChild(makeEl("summary", "", "Not the right version? Change it"));
    const select = document.createElement("select");
    select.className = "upgrade-version";
    select.setAttribute("aria-label", "Version the page was built on");
    [["auto", "Detect from the page"], ["legacy", "Built before version 3"]]
      .concat(CHANGELOG.releases.map((r) => [r.version, "Built on version " + r.version]))
      .forEach(([value, label]) => {
        const o = document.createElement("option");
        o.value = value;
        o.textContent = label;
        o.selected = value === choice.version;
        select.appendChild(o);
      });
    select.addEventListener("change", () => { choice.version = select.value; check(); });
    details.appendChild(select);
    return details;
  }

  function renderSuggestions(container, suggestions, current) {
    const list = (suggestions || []).slice(0, 3);
    if (!list.length || (current && list[0].version === current)) return;
    const box = makeEl("div", "upgrade-suggest");
    box.appendChild(makeEl("p", "upgrade-warning", current
      ? `This page's CSS looks closer to a different version than the ${current} it says it is. Which is it?`
      : "The closest stored versions to this page's CSS:"));
    list.forEach((s) => {
      const b = makeEl("button", "copy-btn copy-btn--inline", `Use ${s.version} (${plural(s.differences, "difference", "differences")})`);
      b.type = "button";
      b.addEventListener("click", () => { choice.version = s.version; check(); });
      box.appendChild(b);
    });
    container.appendChild(box);
  }

  // ---- 3. the author's own tweaks ---------------------------------------------
  function renderTweaks() {
    const r = state.result;
    tweaksEl.replaceChildren();
    const edits = r.edits || [];
    tweaksEl.hidden = !edits.length || r.upToDate;
    if (tweaksEl.hidden) return;
    tweaksEl.appendChild(makeEl("h3", "step-title", `3. Your own tweaks (${edits.length} found)`));
    tweaksEl.appendChild(makeEl("p", "upgrade-hint", "These are differences between your CSS and the standard CSS. Nothing is kept unless you tick it. Ticked tweaks go in a labelled block at the end of the new CSS, and are carried forward the next time you upgrade."));
    const list = makeEl("ul", "upgrade-tweaks");
    edits.forEach((e) => {
      const [where, what, standard] = describeEdit(e);
      const li = makeEl("li", "upgrade-tweak");
      const label = makeEl("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      const blockUnused = e.keepable && e.why && /not used/.test(e.why);
      box.checked = e.kept;
      box.disabled = !e.keepable || blockUnused;
      box.addEventListener("change", () => {
        box.checked ? state.keep.add(e.id) : state.keep.delete(e.id);
        recompute();
        renderCopy();
        renderTweakWarning();
      });
      label.append(box, " ");
      label.appendChild(makeEl("strong", "", where));
      label.append(" — " + what);
      if (standard) label.appendChild(makeEl("span", "upgrade-muted", ` (standard: ${standard})`));
      li.appendChild(label);
      if (!e.keepable) li.appendChild(makeEl("p", "upgrade-hint", "Can't be kept: the new standard applies."));
      else if (blockUnused) li.appendChild(makeEl("p", "upgrade-hint", e.why));
      if (e.standardChanged) li.appendChild(makeEl("p", "upgrade-flag", "The new standard also changed this. If you keep yours, it wins."));
      if (e.obsolete) li.appendChild(makeEl("p", "upgrade-flag", "The new standard no longer has this rule, so keeping it adds a rule of your own."));
      list.appendChild(li);
    });
    tweaksEl.appendChild(list);
    const warn = makeEl("p", "upgrade-warning upgrade-tweak-warning");
    tweaksEl.appendChild(warn);
    renderTweakWarning();
  }

  function renderTweakWarning() {
    const warn = tweaksEl.querySelector(".upgrade-tweak-warning");
    if (!warn) return;
    const r = state.result;
    const lost = (r.edits || []).filter((e) => e.keepable && !e.kept && !(e.why && /not used/.test(e.why))).length;
    warn.hidden = lost === 0;
    warn.textContent = `${plural(lost, "tweak", "tweaks")} won't be in the new CSS. Tick any you want to keep.`;
  }

  // ---- 4. what is changing -----------------------------------------------------
  function renderChanges() {
    const r = state.result;
    changesEl.replaceChildren();
    changesEl.hidden = r.upToDate;
    if (r.upToDate) return;
    const g = r.report.groups;
    const all = [...g.rebuild, ...g.copy, ...g["hand-edit"], ...g.manual];
    changesEl.appendChild(makeEl("h3", "step-title", `4. What's changing on your page (${all.length})`));
    if (!all.length) {
      changesEl.appendChild(makeEl("p", "upgrade-hint", "None of the changes since your version touch anything on this page. The new code is still copied below so the version number is current."));
      return;
    }
    const details = document.createElement("details");
    details.appendChild(makeEl("summary", "", "Show the changes"));
    const labelFor = (c) => (g.copy.includes(c) ? "Done in the new code" : ACTION_LABELS[c.action] || "Check manually");
    CHANGE_GROUPS.forEach(([type, title]) => {
      const inGroup = all.filter((c) => c.type === type);
      if (!inGroup.length) return;
      details.appendChild(makeEl("h4", "upgrade-group", `${title} (${inGroup.length})`));
      inGroup.forEach((c) => details.appendChild(changeCard(c, labelFor(c), null, { compact: g.copy.includes(c) })));
    });
    changesEl.appendChild(details);
  }

  // ---- 5. copy ----------------------------------------------------------------
  function outputCard(title, description, text) {
    const card = makeEl("div", "upgrade-output");
    const head = makeEl("div", "upgrade-output-head");
    const t = makeEl("div");
    t.append(makeEl("strong", "", title), makeEl("p", "upgrade-hint", description));
    const btn = makeEl("button", "copy-btn copy-btn--inline", `Copy ${title}`);
    btn.type = "button";
    btn.addEventListener("click", () => copyToClipboard(text, btn));
    head.append(t, btn);
    card.appendChild(head);
    const details = document.createElement("details");
    details.appendChild(makeEl("summary", "", "Show the code"));
    const area = document.createElement("textarea");
    area.readOnly = true;
    area.rows = 8;
    area.className = "upgrade-input";
    area.value = text;
    area.setAttribute("aria-label", `${title} code`);
    details.appendChild(area);
    card.appendChild(details);
    return card;
  }

  function renderCopy() {
    const r = state.result;
    copyEl.replaceChildren();
    copyEl.hidden = r.upToDate;
    if (r.upToDate) return;
    copyEl.appendChild(makeEl("h3", "step-title", "5. Copy your upgraded page"));
    copyEl.appendChild(makeEl("p", "upgrade-hint", "Replace the old HTML, CSS and JS on the page with these."));

    const blocksText = r.blocks.length ? plural(r.blocks.length, "block", "blocks") : "no blocks";
    copyEl.appendChild(outputCard("HTML", `Your HTML, with only the version number changed to ${r.toVersion}.`, r.html));

    const kept = (r.edits || []).filter((e) => e.kept).length;
    copyEl.appendChild(outputCard("CSS", `The standard CSS for ${blocksText}${kept ? `, plus ${plural(kept, "of your tweaks", "of your tweaks")}` : ""}.`, r.css));

    const jsCard = outputCard("JS", "The standard JS for the blocks on your page.", r.js);
    copyEl.appendChild(jsCard);
    const js = r.jsEdits;
    if (js && (js.added.length || js.removed.length)) {
      const box = makeEl("div", "upgrade-warning");
      box.appendChild(makeEl("strong", "", "Your JS differs from the standard JS."));
      box.appendChild(makeEl("p", "", "JS isn't kept for you. After pasting the new JS, re-add anything that is yours."));
      if (js.added.length) {
        box.appendChild(makeEl("p", "upgrade-hint", `${plural(js.added.length, "line", "lines")} of yours that aren't in the standard JS:`));
        box.appendChild(makeEl("pre", "upgrade-diff", js.added.join("\n")));
      }
      if (js.removed.length) {
        box.appendChild(makeEl("p", "upgrade-hint", `${plural(js.removed.length, "standard line", "standard lines")} missing from your JS (the new JS has them):`));
        box.appendChild(makeEl("pre", "upgrade-diff", js.removed.join("\n")));
      }
      copyEl.appendChild(box);
    }

    const c = r.check;
    copyEl.appendChild(makeEl("p", c.ok ? "upgrade-check upgrade-check--ok" : "upgrade-check upgrade-check--warn",
      c.ok ? "✔ We re-checked the upgraded code: nothing left to copy." : `⚠ ${plural(c.remaining.length, "change", "changes")} still need the new code. Check the notes above.`));
    if (c.manualSteps.length) {
      copyEl.appendChild(makeEl("h4", "upgrade-group", "Then, by hand"));
      c.manualSteps.forEach((m) => copyEl.appendChild(changeCard(m, ACTION_LABELS[m.action] || "Check manually", null)));
    }
  }

  function renderAll() {
    renderFound();
    if (state.result.error) { tweaksEl.hidden = changesEl.hidden = copyEl.hidden = true; return; }
    renderTweaks();
    renderChanges();
    renderCopy();
  }

  associateLabels(panel);
  return panel;
}
