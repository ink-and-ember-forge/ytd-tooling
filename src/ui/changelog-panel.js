// Tools drawer, "Changelog" tab: release notes plus the schema behind them.
import { makeEl } from "../lib/dom.js";
import { changeCard, ACTION_LABELS } from "./change-card.js";
import { CHANGELOG, SCHEMA_DOC, BUILDER_VERSION } from "../changelog/index.js";
import { validateChangelog } from "../changelog/checker.js";

export function buildChangelogPanel() {
  const panel = makeEl("div", "panel");
  panel.id = "panel-changelog";
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
  const errors = validateChangelog(CHANGELOG);
  const count = CHANGELOG.releases.reduce((n, r) => n + r.changes.length, 0);
  panel.appendChild(makeEl("p", "changelog-check " + (errors.length ? "changelog-check--fail" : "changelog-check--pass"),
    errors.length ? "Changelog check failed: " + errors.join("; ") : "Changelog check passed: " + count + " changes."));
  const schema = makeEl("section", "schema-section");
  schema.appendChild(makeEl("h3", "release-title", "Changelog schema"));
  schema.appendChild(makeEl("p", "release-summary", "The rules behind the changelog and the Upgrade checker."));
  const pre = makeEl("pre", "schema-doc", SCHEMA_DOC);
  schema.appendChild(pre);
  panel.appendChild(schema);
  return panel;
}
