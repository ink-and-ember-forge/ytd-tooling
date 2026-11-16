import { test } from "node:test";
import assert from "node:assert/strict";
import { releasesSince } from "../src/changelog/since.js";

const log = { releases: ["3.4.0", "3.3.2", "3.3.1", "3.0.0"].map((version) => ({ version })) };
const versions = (v) => releasesSince(log, v).map((r) => r.version);

test("releasesSince lists the releases after the last one seen, newest first", () => {
  assert.deepEqual(versions("3.3.1"), ["3.4.0", "3.3.2"]);
  assert.deepEqual(versions("3.0.0"), ["3.4.0", "3.3.2", "3.3.1"]);
});

test("releasesSince is empty when the person is up to date or ahead", () => {
  assert.deepEqual(versions("3.4.0"), []);
  assert.deepEqual(versions("9.0.0"), []);
});

test("releasesSince compares numbers, not text (3.10.0 is newer than 3.9.0)", () => {
  const l = { releases: [{ version: "3.10.0" }, { version: "3.9.0" }] };
  assert.deepEqual(releasesSince(l, "3.9.0").map((r) => r.version), ["3.10.0"]);
});

test("releasesSince shows nothing for a missing or mangled stored version", () => {
  for (const bad of [undefined, null, "", "abc", "3.4", 3]) assert.deepEqual(versions(bad), []);
});
