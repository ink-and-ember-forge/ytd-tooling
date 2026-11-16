// Which releases has someone not seen yet? Pure (no DOM), so it runs in Node tests.
import { compareVersions } from "../lib/versions.js";

const SEMVER = /^\d+\.\d+\.\d+$/;

// Releases newer than `lastSeen`, newest first (the changelog's own order).
// A missing or malformed version (nothing stored, or a hand-edited value) means "nothing to show".
export function releasesSince(changelog, lastSeen) {
  if (typeof lastSeen !== "string" || !SEMVER.test(lastSeen)) return [];
  return changelog.releases.filter((rel) => compareVersions(rel.version, lastSeen) > 0);
}
