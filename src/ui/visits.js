// Remembers when the builder was last opened, and which version of it the person has caught up with.
// Kept under its own key, apart from the autosaved work: "Reset everything" clears the work (not this),
// and loading a project file from another computer must not change which updates THIS browser has seen.
// Everything is wrapped in try/catch: storage can be blocked, and the builder must work without it.
const KEY = "gwella-builder:visit";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

// Call once per page load. Returns what was stored BEFORE this visit:
//   { firstVisit, lastVisit (ISO string | null), lastSeenVersion (string | null) }
// A first visit counts as caught up with the current version (a brand-new user has no "since").
// lastSeenVersion is otherwise left alone until markVersionSeen, so closing the tab without
// reading the update means it is offered again next time.
export function recordVisit(currentVersion) {
  const prev = read();
  const firstVisit = !prev.lastSeenVersion;
  write({ ...prev, lastVisit: new Date().toISOString(), lastSeenVersion: prev.lastSeenVersion || currentVersion });
  return { firstVisit, lastVisit: prev.lastVisit || null, lastSeenVersion: prev.lastSeenVersion || null };
}

export function markVersionSeen(version) {
  write({ ...read(), lastSeenVersion: version });
}

// Has this tour already been offered or finished? (Tours are optional and can always be replayed.)
export const tourOffered = (id) => !!read().tours?.[id];
export function markTourOffered(id) {
  const data = read();
  write({ ...data, tours: { ...data.tours, [id]: true } });
}
