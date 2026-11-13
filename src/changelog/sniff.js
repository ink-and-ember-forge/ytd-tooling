// Suggests which stored version a page's CSS is closest to, by counting how many
// places it differs from each baseline. Guards against a wrong or missing version
// marker feeding a wrong comparison into the upgrade. Pure apart from loading baselines.
import { CHANGELOG } from "./index.js";
import { loadBaseline } from "../lib/baseline.js";
import { findLocalEdits, splitOverrides } from "./local-edits.js";

// Returns [{ version, differences, total }], fewest differences first (newest first on a tie).
// Versions with no stored baseline are left out. Empty when no CSS is given.
export async function suggestVersions(pageCss, { versions = CHANGELOG.releases.map((r) => r.version) } = {}) {
  if (!pageCss || !pageCss.trim()) return [];
  const includeToc = /#table-of-contents\s*\{/.test(splitOverrides(pageCss).css);
  const out = [];
  for (const version of versions) { // changelog order is newest first, which a stable sort keeps on ties
    const baseline = await loadBaseline(version);
    if (!baseline) continue;
    const { differences, total } = findLocalEdits(pageCss, baseline, { includeToc });
    out.push({ version, differences, total });
  }
  return out.sort((a, b) => a.differences - b.differences);
}
