// Released versions are frozen: once baseline/<version>/ exists, the base and block
// code must still match it. Changing the code means a new version (changelog entry +
// `npm run release`), which is what keeps the upgrade history trustworthy.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { releaseFiles, baselineDir } from "../scripts/release.js";
import { BUILDER_VERSION } from "../src/changelog/index.js";

test(`baseline/${BUILDER_VERSION} exists`, () => {
  assert.ok(existsSync(baselineDir()), `No baseline for ${BUILDER_VERSION}. After bumping the changelog, run: npm run build && npm run release`);
});

test(`code still matches the released baseline for ${BUILDER_VERSION}`, async () => {
  const dir = baselineDir();
  if (!existsSync(dir)) return; // reported by the test above
  for (const [rel, text] of Object.entries(await releaseFiles())) {
    assert.equal(
      readFileSync(dir + rel, "utf8"), text + "\n",
      `${rel} changed since ${BUILDER_VERSION} was released. Add a new release to changelog/changelog.json (patch bump for a fix), then npm run build && npm run release.`
    );
  }
});
