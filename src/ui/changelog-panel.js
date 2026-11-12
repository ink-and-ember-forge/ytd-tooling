// "What's changed" view: release notes for editors.
import { makeEl } from "../lib/dom.js";
import { changeCard, ACTION_LABELS } from "./change-card.js";
import { CHANGELOG, BUILDER_VERSION } from "../changelog/index.js";
import { validateChangelog } from "../changelog/checker.js";

export function buildChangelogPanel() {
  const panel = makeEl("div", "view");
  panel.id = "view-changelog";
  panel.appendChild(makeEl("h2", "view-title", "What's changed"));
  panel.appendChild(makeEl("p", "panel-desc",
    "Release notes for the page builder, newest first. The current version is " + BUILDER_VERSION + "."));
  CHANGELOG.releases.forEach(rel => {
    const section = makeEl("section", "release");
    section.appendChild(makeEl("h3", "release-title", "Version " + rel.version + " · " + rel.date));
    if (!rel.origin) section.appendChild(makeEl("p", "release-summary", rel.summary));
    rel.changes.forEach(c => {
      section.appendChild(changeCard(c, c.action === "none" ? null : ACTION_LABELS[c.action]));
    });
    panel.appendChild(section);
  });
  // The schema and the passing check are maintainers' business (see changelog/SCHEMA.md
  // and `npm test`); editors only need to hear if the data is somehow broken.
  const errors = validateChangelog(CHANGELOG);
  if (errors.length) {
    panel.appendChild(makeEl("p", "changelog-check changelog-check--fail", "Changelog data problem: " + errors.join("; ")));
  }
  return panel;
}
