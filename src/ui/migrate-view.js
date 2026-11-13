// The migration half of "Upgrade a page", for pages built before version 3.1.0. It fills the same five
// sections the upgrade flow uses, so the page keeps one shape:
//   2 why this is a migration   3 the page's own styles and where it differs from the template (all kept by default)
//   4 theme + HTML changes
//   5 check (problems, before/after)   6 copy
// All the thinking is in src/changelog/migrate.js; this file only shows it.
import { makeEl } from "../lib/dom.js";
import { buildMigration, THEMES } from "../changelog/migrate.js";
import { loadBaseline } from "../lib/baseline.js";
import { outputCard, renderCheck, plural } from "./upgrade-parts.js";

const codeBlock = (text) => makeEl("pre", "upgrade-diff", text);

// els: { found, tweaks, changes, check, copy } (the section elements). code(): the pasted { html, css, js }.
// onUpgradeInstead(): the author wants the normal upgrade flow for this page.
export function createMigrationView(els, { code, onUpgradeInstead }) {
  const state = { theme: undefined, keep: new Set(), result: null, reference: null };
  let htmlList = null;

  const recompute = () => { state.result = buildMigration(code(), { theme: state.theme, keepGroups: [...state.keep], reference: state.reference }); };

  // ---- 2. why this is a migration ---------------------------------------------
  function renderFound() {
    const r = state.result;
    els.found.hidden = false;
    els.found.replaceChildren(makeEl("h3", "step-title", "2. This page needs migrating, not upgrading"));
    els.found.appendChild(makeEl("p", "upgrade-message", "This page was built before version 3.1.0, so it can't be brought up to date piece by piece."));
    els.found.appendChild(makeEl("p", "", "Instead, your HTML is read to see what the page really uses, and the page is moved onto the current template. Your own styles are kept; the old base styles are replaced."));
    const list = makeEl("ul", "upgrade-signals");
    r.fit.signals.forEach((s) => list.appendChild(makeEl("li", "", s)));
    els.found.appendChild(list);
    const back = makeEl("button", "copy-btn copy-btn--inline", "Treat it as a normal upgrade instead");
    back.type = "button";
    back.addEventListener("click", onUpgradeInstead);
    els.found.appendChild(back);
  }

  // ---- 3. the page's own styles, and where it differs from the template ------------------------------------
  function groupList(groups, className, describe) {
    const list = makeEl("ul", `upgrade-tweaks ${className}`);
    groups.forEach((g) => {
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
      label.append(box, " ", makeEl("strong", "", g.key.replace(/^differs:/, "")));
      li.appendChild(label);
      li.appendChild(codeBlock(describe(g)));
      g.notes.forEach((n) => li.appendChild(makeEl("p", /not defined/.test(n) ? "upgrade-flag" : "upgrade-hint", n)));
      list.appendChild(li);
    });
    return list;
  }

  function renderStyles() {
    const r = state.result;
    const custom = r.groups.filter((g) => g.kind === "custom"), differs = r.groups.filter((g) => g.kind === "deviation");
    els.tweaks.hidden = false;
    els.tweaks.replaceChildren(makeEl("h3", "step-title", `3. Your page's own styles (${plural(custom.length, "group", "groups")})`));
    els.tweaks.appendChild(makeEl("p", "upgrade-hint", "These style classes your HTML uses that the current template doesn't. They are kept unless you untick them, and go in a labelled block at the end of the new CSS. Old colour tokens have been renamed to the current ones."));
    els.tweaks.appendChild(groupList(custom, "upgrade-custom", (g) => g.text));

    if (differs.length) {
      els.tweaks.appendChild(makeEl("h4", "upgrade-group", `Where your page differs from the template (${differs.length})`));
      els.tweaks.appendChild(makeEl("p", "upgrade-hint", "The template styles these too, but your page overrides it. They are kept unless you untick them, so the page keeps looking as you built it. What the template says instead is shown beside each, so you can drop any you no longer need."));
      els.tweaks.appendChild(groupList(differs, "upgrade-deviations", (g) => g.against.join("\n")));
    }

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

  // ---- 4. theme and HTML ----------------------------------------------------------
  function renderHtml() {
    const r = state.result;
    els.changes.hidden = false;
    els.changes.replaceChildren(makeEl("h3", "step-title", "4. Your HTML"));

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
        renderStyles();
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

  // ---- 5 and 6 ------------------------------------------------------------------------
  function renderChecksAndCopy() {
    const r = state.result;
    const wasOpen = els.check.querySelector(".upgrade-preview")?.open;
    els.check.hidden = false;
    renderCheck(els.check, { before: code(), after: { html: r.html, css: r.css, js: r.js }, lint: r.lint });
    if (wasOpen) els.check.querySelector(".upgrade-preview").open = true;

    els.copy.hidden = false;
    els.copy.replaceChildren(makeEl("h3", "step-title", "6. Copy your migrated page"));
    els.copy.appendChild(makeEl("p", "upgrade-hint", "Replace the old HTML, CSS and JS on the page with these. After that it is an ordinary template page, and future upgrades carry your styles forward."));
    const blocked = r.ready ? null : "Choose the page's theme in step 4 first.";
    const kept = r.groups.filter((g) => g.kept).length;
    const blocksText = r.blocks.length ? plural(r.blocks.length, "block", "blocks") : "no blocks";
    els.copy.appendChild(outputCard("HTML", `Your HTML, with ${plural(r.htmlChanges.length, "change", "changes")} (see step 4).`, r.html, { blocked }));
    els.copy.appendChild(outputCard("CSS", `The current CSS for ${blocksText}, plus ${kept} of your ${plural(r.groups.length, "style group", "style groups")}.`, r.css, { blocked }));
    els.copy.appendChild(outputCard("JS", "The current JS. It replaces your old JS, which only did what the current JS does.", r.js));
    r.notes.forEach((n) => els.copy.appendChild(makeEl("p", "upgrade-warning", n)));
  }

  return {
    async start() {
      state.theme = undefined;
      // What the template said when it was first stored: a rule that matches that is the OLD template, not the author's choice.
      state.reference ||= await loadBaseline("3.1.1");
      state.result = buildMigration(code(), { reference: state.reference });
      state.keep = new Set(state.result.groups.map((g) => g.key));
      renderFound();
      renderStyles();
      renderHtml();
      renderChecksAndCopy();
    },
  };
}
