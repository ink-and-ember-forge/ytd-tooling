// "Upgrade a page" view, as three steps: paste the page's code, confirm its
// version, then work through a checklist of what it needs (with the new code
// one click away).
import { makeEl, copyToClipboard } from "../lib/dom.js";
import { changeCard, ACTION_LABELS, copyTargetFor } from "./change-card.js";
import { CHANGELOG, BUILDER_VERSION } from "../changelog/index.js";
import { checkPage } from "../changelog/checker.js";
import { replacementFor } from "../changelog/replacements.js";
import { BLOCKS } from "../blocks/index.js";
import { BASE_JS, getBaseCSS, getBaseHTML } from "../base/index.js";
import { getTheme } from "./theme.js";
import { associateLabels } from "./a11y.js";
import { toast } from "./toast.js";

// The ToC toggle in the header decides which base variant is offered.
const includeToc = () => document.getElementById("include-toc-toggle").checked;
const currentCode = {
  html: () => getBaseHTML(includeToc(), getTheme()),
  css: () => getBaseCSS(includeToc()),
  js: () => BASE_JS,
};

const markerOf = (text) => (text.match(/data-base-version="([\d.]+)"/) || [])[1] || null;

export function buildUpgradePanel() {
  const panel = makeEl("div", "view");
  panel.id = "view-upgrade";
  panel.appendChild(makeEl("h2", "view-title", "Upgrade a page"));
  panel.appendChild(makeEl("p", "panel-desc",
    "Bring a page built on an older version of the template up to version " + BUILDER_VERSION + ". Nothing is changed for you: you get a checklist, with the new code ready to copy."));

  // ---- step 1: paste ---------------------------------------------------------
  const step1 = makeEl("section", "step");
  step1.appendChild(makeEl("h3", "step-title", "1. Paste the page's code"));
  const inputs = {};
  [["html", "HTML", "Paste the page's HTML here..."], ["css", "CSS", "Paste the page's CSS here (leave empty if none)..."], ["js", "JS", "Paste the page's JS here (leave empty if none)..."]]
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
  panel.appendChild(step1);

  // ---- step 2: version -------------------------------------------------------
  const step2 = makeEl("section", "step");
  step2.appendChild(makeEl("h3", "step-title", "2. Confirm the version"));
  const detected = makeEl("p", "upgrade-detected", "Paste the HTML above and the version is read from it.");
  detected.setAttribute("aria-live", "polite");
  step2.appendChild(detected);
  const vlabel = makeEl("label", "upgrade-label", "Version the page was built on");
  const select = document.createElement("select");
  select.className = "upgrade-version";
  [["auto", "Detect from the page"], ["legacy", "Built before version 3"]]
    .concat(CHANGELOG.releases.map((r) => [r.version, "Built on version " + r.version]))
    .forEach(([value, label]) => {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      select.appendChild(o);
    });
  step2.append(vlabel, select);
  panel.appendChild(step2);

  // ---- step 3: check ---------------------------------------------------------
  const step3 = makeEl("section", "step");
  step3.appendChild(makeEl("h3", "step-title", "3. Check the page"));
  const button = makeEl("button", "primary-btn", "Check page");
  button.type = "button";
  step3.appendChild(button);
  const result = makeEl("div", "upgrade-result");
  result.setAttribute("aria-live", "polite");
  step3.appendChild(result);
  panel.appendChild(step3);

  const allCode = () => Object.values(inputs).map((a) => a.value).join("\n");
  const updateDetected = () => {
    const m = markerOf(allCode());
    detected.textContent = m
      ? `Detected version ${m} from the page's version marker.`
      : allCode().trim() ? "No version marker found in the code. Choose the version below." : "Paste the HTML above and the version is read from it.";
  };
  Object.values(inputs).forEach((a) => a.addEventListener("input", updateDetected));

  button.addEventListener("click", () => {
    result.replaceChildren();
    if (!allCode().trim()) {
      result.appendChild(makeEl("p", "upgrade-message", "Paste the page's code first (step 1)."));
      return;
    }
    renderReport(result, checkPage(allCode(), select.value, CHANGELOG));
  });

  associateLabels(panel);
  return panel;
}

// ---- results ---------------------------------------------------------------

function renderGroup(container, title, changes, labelFor, { withFixes = false, checkable = false, onToggle } = {}) {
  if (changes.length === 0) return;
  container.appendChild(makeEl("h4", "upgrade-group", title + " (" + changes.length + ")"));
  changes.forEach((c) => container.appendChild(
    changeCard(c, labelFor(c), withFixes ? replacementFor(c, currentCode, BLOCKS) : null, { checkable, onToggle })
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
  const todo = g.rebuild.length + g.copy.length + g["hand-edit"].length + g.manual.length;
  const progress = makeEl("p", "upgrade-progress");
  const finish = makeEl("div", "upgrade-finish");
  const updateProgress = () => {
    const done = container.querySelectorAll(".change-done input:checked").length;
    progress.textContent = `${done} of ${todo} done`;
    finish.hidden = done < todo;
  };
  if (todo > 0) container.appendChild(progress);

  const opts = { checkable: true, onToggle: updateProgress };
  renderGroup(container, "Rebuild in the tool", g.rebuild, () => ACTION_LABELS.rebuild, opts);
  renderGroup(container, "Copy directly into the new code", g.copy, (c) => copyTargetFor(c.scope), { ...opts, withFixes: true });
  renderGroup(container, "Hand edit", g["hand-edit"], () => ACTION_LABELS["hand-edit"], opts);
  renderGroup(container, "Check manually", g.manual, () => "Check manually", opts);
  renderGroup(container, "Already current (checked, no change needed)", g.current, () => "Already current");
  renderGroup(container, "No action needed", g.none, () => null);

  if (!report.upToDate) {
    const marker = `data-base-version="${BUILDER_VERSION}"`;
    finish.appendChild(makeEl("h4", "upgrade-group", "Last step"));
    finish.appendChild(makeEl("p", "upgrade-message", "Set the version marker on #page-container so the page is recognised as current:"));
    const copy = makeEl("button", "copy-btn copy-btn--inline", "Copy " + marker);
    copy.type = "button";
    copy.addEventListener("click", () => copyToClipboard(marker, copy).then(() => toast("Version marker copied")));
    finish.appendChild(copy);
    finish.hidden = todo > 0;
    container.appendChild(finish);
    updateProgress();
  }
}
