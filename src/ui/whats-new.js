// "What's new since your last visit": a lightbox listing the releases the person has not seen.
// Same native <dialog> approach and look as the "How it works" guide (guide-dialog.js).
import { makeEl } from "../lib/dom.js";
import { CHANGELOG, BUILDER_VERSION } from "../changelog/index.js";
import { releasesSince } from "../changelog/since.js";

const MAX_RELEASES = 4; // a long absence would otherwise be a wall of text; the rest is one click away

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? null : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Returns true if the dialog was shown. `onClose` runs however the dialog is closed (Esc, ✕, backdrop, buttons).
// `onSeeAll` is called when the person asks for the full history.
export function showWhatsNew({ lastSeenVersion, lastVisit, onClose, onSeeAll }) {
  const releases = releasesSince(CHANGELOG, lastSeenVersion);
  if (!releases.length || typeof HTMLDialogElement === "undefined") return false;

  const dialog = makeEl("dialog", "guide-dialog whatsnew-dialog");
  dialog.setAttribute("aria-labelledby", "whatsnew-title");
  const card = makeEl("div", "guide-card");

  const head = makeEl("header", "guide-head");
  const title = makeEl("h2", "", "What's new since your last visit");
  title.id = "whatsnew-title";
  const x = makeEl("button", "guide-close", "×");
  x.type = "button";
  x.setAttribute("aria-label", "Close");
  head.append(title, x);

  const body = makeEl("div", "guide-body");
  body.tabIndex = -1;
  const when = lastVisit && formatDate(lastVisit);
  body.appendChild(makeEl("p", "whatsnew-lead",
    (when ? "You last opened the builder on " + when + ", on version " : "You were last on version ") +
    lastSeenVersion + ". It is now version " + BUILDER_VERSION + "."));

  releases.slice(0, MAX_RELEASES).forEach((rel) => {
    const section = makeEl("section", "whatsnew-release");
    section.appendChild(makeEl("h3", "", "Version " + rel.version + " · " + rel.date));
    if (!rel.origin) section.appendChild(makeEl("p", "whatsnew-summary", rel.summary));
    const list = makeEl("ul", "whatsnew-changes");
    rel.changes.forEach((c) => {
      const li = makeEl("li");
      li.append(makeEl("span", "change-type change-type--" + c.type, c.type), " ", c.summary);
      list.appendChild(li);
    });
    section.appendChild(list);
    body.appendChild(section);
  });
  const older = releases.length - MAX_RELEASES;
  if (older > 0) body.appendChild(makeEl("p", "whatsnew-more", older + " older release" + (older > 1 ? "s" : "") + " are in What's changed."));

  const foot = makeEl("footer", "guide-foot whatsnew-foot");
  const all = makeEl("button", "guide-btn", "See the full history");
  all.type = "button";
  const ok = makeEl("button", "primary-btn", "Got it");
  ok.type = "button";
  foot.append(all, ok);

  card.append(head, body, foot);
  dialog.appendChild(card);
  document.body.appendChild(dialog);

  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  x.addEventListener("click", () => dialog.close());
  ok.addEventListener("click", () => dialog.close());
  all.addEventListener("click", () => { dialog.close(); if (onSeeAll) onSeeAll(); });
  dialog.addEventListener("close", () => { dialog.remove(); if (onClose) onClose(); });
  dialog.showModal();
  ok.focus();
  return true;
}
