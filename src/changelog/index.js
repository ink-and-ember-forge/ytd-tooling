// The changelog is data (changelog/changelog.json). Its newest release is the
// builder's version: there is no second place to bump.
import { loadText } from "../lib/assets.js";

export const CHANGELOG = JSON.parse(await loadText(new URL("../../changelog/changelog.json", import.meta.url)));
export const SCHEMA_DOC = await loadText(new URL("../../changelog/SCHEMA.md", import.meta.url));
export const BUILDER_VERSION = CHANGELOG.releases[0].version;
