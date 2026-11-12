// Autosave to the browser (localStorage) plus Save/Load project as a file.
// Everything is wrapped in try/catch: storage can be blocked or full, and the
// builder must work without it.
import { BUILDER_VERSION } from "../changelog/index.js";

const KEY = "gwella-builder:v1";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { blocks: {}, prefs: {} }; }
  catch (e) { return { blocks: {}, prefs: {} }; }
}

function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch (e) { return false; }
}

const listeners = [];
export const onSaved = (fn) => listeners.push(fn);
const notify = (ok) => listeners.forEach((fn) => fn(ok));

export const getBlockState = (id) => read().blocks?.[id] || null;
export const getPref = (name, fallback) => read().prefs?.[name] ?? fallback;

export function setBlockState(id, state) {
  const data = read();
  data.blocks = data.blocks || {};
  data.blocks[id] = state;
  notify(write(data));
}

export function setPref(name, value) {
  const data = read();
  data.prefs = data.prefs || {};
  data.prefs[name] = value;
  write(data);
}

export function clearBlockState(id) {
  const data = read();
  if (data.blocks) delete data.blocks[id];
  write(data);
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

// ---- project files ---------------------------------------------------------
export function exportProject() {
  const data = read();
  return JSON.stringify({ app: "gwella-page-builder", builderVersion: BUILDER_VERSION, savedAt: new Date().toISOString(), blocks: data.blocks || {}, prefs: data.prefs || {} }, null, 2);
}

// Returns an error message, or null on success.
export function importProject(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return "That file isn't a saved project (it isn't valid JSON)."; }
  if (!obj || obj.app !== "gwella-page-builder" || typeof obj.blocks !== "object") return "That file isn't a Gwella page builder project.";
  return write({ blocks: obj.blocks, prefs: obj.prefs || {} }) ? null : "Couldn't store the project in this browser.";
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
