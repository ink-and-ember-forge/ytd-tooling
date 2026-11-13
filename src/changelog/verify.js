// Checks the changelog's detect/outdated rules against the frozen baselines, so
// a pattern that does not actually recognise old code (or that wrongly flags
// current code) is caught when it is written, not when a page is upgraded.
//
// For every change that has page-level rules, in a release whose predecessor
// release has a baseline:
//   1. the predecessor's code must be reported as needing the change, and
//   2. the code of every baseline at or after the release must not be.
// Changes with no rules (action "none", or no detect patterns) cannot be
// checked this way and are skipped. Pure; used by test/changelog-baselines.test.js.
import { checkPage } from "./checker.js";
import { compareVersions } from "../lib/versions.js";

// baselines: { "<version>": "<the page's full code from that baseline>" }
// Returns { problems: string[], checked: string[] } (checked = ids that were verified).
export function verifyAgainstBaselines(changelog, baselines) {
  const problems = [];
  const checked = [];
  const releases = changelog.releases; // newest first
  const needs = (code, from, change) => checkPage(code, from, changelog).groups[change.action]?.some((c) => c.id === change.id);
  const versions = Object.keys(baselines);

  releases.forEach((rel, i) => {
    const prev = releases[i + 1];
    if (!prev || !(prev.version in baselines)) return;
    for (const c of rel.changes) {
      if (c.action === "none" || (c.detect?.patterns || []).length === 0) continue;
      checked.push(c.id);
      if (!needs(baselines[prev.version], prev.version, c)) {
        problems.push(`${c.id}: not reported as needed on the ${prev.version} baseline, so its detect/outdated rules do not recognise the old code`);
      }
      for (const v of versions.filter((v) => compareVersions(v, rel.version) >= 0)) {
        if (needs(baselines[v], prev.version, c)) {
          problems.push(`${c.id}: reported as needed on the ${v} baseline, which already has the change (or a later release changed the code its rules look for)`);
        }
      }
    }
  });
  return { problems, checked };
}
