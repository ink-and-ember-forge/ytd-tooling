// Tools drawer, "Upgrade page" tab: paste an old page's code, get a report of
// what it needs to reach the current version, with the new code ready to copy.
import { makeEl } from "../lib/dom.js";
import { changeCard, ACTION_LABELS, copyTargetFor } from "./change-card.js";
import { CHANGELOG, BUILDER_VERSION } from "../changelog/index.js";
import { checkPage } from "../changelog/checker.js";
import { replacementFor } from "../changelog/replacements.js";
import { BLOCKS } from "../blocks/index.js";
import { BASE_JS, getBaseCSS, getBaseHTML } from "../base/index.js";
import { getTheme } from "./theme.js";

// The ToC toggle in the header decides which base variant is offered.
const includeToc = () => document.getElementById("include-toc-toggle").checked;
const currentCode = {
  html: () => getBaseHTML(includeToc(), getTheme()),
  css: () => getBaseCSS(includeToc()),
  js: () => BASE_JS,
};

function renderGroup(container, title, changes, labelFor, withFixes = false) {
  if (changes.length === 0) return;
  container.appendChild(makeEl("h4", "upgrade-group", title + " (" + changes.length + ")"));
  changes.forEach(c => container.appendChild(
    changeCard(c, labelFor(c), withFixes ? replacementFor(c, currentCode, BLOCKS) : null)
  ));
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
  renderGroup(container, "Copy directly into the new code", g.copy, c => copyTargetFor(c.scope), true);
  renderGroup(container, "Hand edit", g["hand-edit"], () => ACTION_LABELS["hand-edit"]);
  renderGroup(container, "Check manually", g.manual, () => "Check manually");
  renderGroup(container, "Already current (checked, no change needed)", g.current, () => "Already current");
  renderGroup(container, "No action needed", g.none, () => null);

  if (!report.upToDate) {
    container.appendChild(makeEl("p", "upgrade-message",
      "When the changes are made, set data-base-version on #page-container to \"" + BUILDER_VERSION + "\"."));
  }
}

export function buildUpgradePanel() {
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
    renderReport(result, checkPage(code, select.value, CHANGELOG));
  });
  return panel;
}
