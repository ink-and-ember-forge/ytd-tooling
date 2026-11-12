// Pure logic for the changelog and the upgrade checker (no DOM). Tested in test/.
import { compareVersions } from "../lib/versions.js";

// Checks the changelog data against the schema rules.
export function validateChangelog(cl) {
  const TYPES = ["additive", "visual", "behaviour", "fix", "breaking", "tool-only"];
  const ACTIONS = ["none", "copy", "hand-edit", "rebuild"];
  const errors = [];
  const ids = new Set();
  cl.releases.forEach(rel => {
    if (!/^\d+\.\d+\.\d+$/.test(rel.version)) errors.push("bad version " + rel.version);
    rel.changes.forEach(c => {
      if (ids.has(c.id)) errors.push("duplicate id " + c.id);
      ids.add(c.id);
      if (!c.id.startsWith("CHG-" + rel.version + "-")) errors.push(c.id + " does not match version " + rel.version);
      if (!TYPES.includes(c.type)) errors.push(c.id + " unknown type " + c.type);
      if (!ACTIONS.includes(c.action)) errors.push(c.id + " unknown action " + c.action);
      if (c.type === "tool-only" && c.action !== "none") errors.push(c.id + " tool-only must have action none");
      if (c.type === "breaking" && c.action === "none") errors.push(c.id + " breaking change cannot be action none");
      if (!c.summary) errors.push(c.id + " missing summary");
      if (c.page_rebuild === true && c.action !== "rebuild") errors.push(c.id + " page_rebuild requires action rebuild");
      const o = c.outdated || {};
      const hasOutdated = (o.present || []).length + (o.missing || []).length > 0;
      if (["copy", "hand-edit", "rebuild"].includes(c.action) && c.detect.patterns.length > 0 && !hasOutdated) {
        errors.push(c.id + " needs an outdated rule (present or missing) so pages can be checked");
      }
    });
  });
  cl.releases.forEach(rel => {
    const major = Number(rel.version.split(".")[0]);
    const needsRebuild = rel.changes.some(c => c.page_rebuild === true);
    if (major > 3 && !needsRebuild) errors.push(rel.version + ": major bump needs a change with page_rebuild true");
    if (major === 3 && needsRebuild) errors.push(rel.version + ": page_rebuild requires a major bump");
  });
  return errors;
}

// Returns either {error} or the report for a pasted page.
export function checkPage(text, choice, changelog) {
  const marker = (text.match(/data-base-version="([\d.]+)"/) || [])[1] || null;
  const pageVersion = choice === "auto" ? marker : choice;
  if (!pageVersion) {
    return { error: "No version marker was found in this page, so its version can't be read. Choose the version it was built from." };
  }
  const legacy = pageVersion === "legacy";
  const from = legacy ? "0.0.0" : pageVersion;
  const matches = list => (list || []).some(pattern => new RegExp(pattern).test(text));
  const groups = { rebuild: [], copy: [], "hand-edit": [], manual: [], current: [], none: [] };
  let newer = false;
  let pageRebuild = false;
  changelog.releases.forEach(rel => {
    if (compareVersions(rel.version, from) <= 0) return;
    newer = true;
    rel.changes.forEach(c => {
      if (c.page_rebuild === true) pageRebuild = true;
      if (c.detect.patterns.length === 0) {
        if (c.action !== "none") groups.manual.push(c);
        return;
      }
      const o = c.outdated || {};
      const relevant = matches(c.detect.patterns) || matches(o.present);
      if (!relevant) return;
      const outdated = matches(o.present) || ((o.missing || []).length > 0 && !matches(o.missing));
      if (c.action === "none") groups.none.push(c);
      else if (!outdated) groups.current.push(c);
      else groups[c.action].push(c);
    });
  });
  return {
    legacy,
    pageVersion,
    groups,
    upToDate: !newer,
    pageRebuild,
  };
}
