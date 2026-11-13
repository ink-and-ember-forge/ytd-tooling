// A change from the changelog, as a card. Used by the Changelog tab and the Upgrade report.
import { makeEl, copyToClipboard } from "../lib/dom.js";

export const ACTION_LABELS = {
  copy: "Copy the new code in",
  "hand-edit": "Hand edit the page",
  rebuild: "Rebuild in the tool",
};

export function copyTargetFor(scope) {
  if (scope === "base-css") return "Replace the base CSS";
  if (scope === "base-js") return "Replace the base JS";
  if (scope === "base-html") return "Replace the base HTML";
  if (scope.startsWith("block:")) return "Replace the CSS of the " + scope.slice(6) + " block";
  return "Replace the affected code";
}

// `replacement` is optional: { label, text } adds a button that copies the new code.
// `checkable` adds a "Done" tick box (the upgrade checklist); `onToggle` hears about it.
// `compact` shows just the summary (no scope tags or copy instructions), for changes already done for the author.
export function changeCard(change, label, replacement, { checkable = false, onToggle, compact = false } = {}) {
  const card = makeEl("div", "change-card");
  const head = makeEl("div", "change-card-head");
  head.appendChild(makeEl("span", "change-id", change.id));
  head.appendChild(makeEl("span", "change-type change-type--" + change.type, change.type));
  if (label) head.appendChild(makeEl("span", "change-type change-type--action", label));
  card.appendChild(head);
  card.appendChild(makeEl("p", "change-summary", change.summary));
  if (!compact) {
    const meta = [change.scope];
    if (change.blocks && change.blocks.length) meta.push("blocks: " + change.blocks.join(", "));
    card.appendChild(makeEl("p", "change-meta", meta.join(" · ")));
    if (change.notes) card.appendChild(makeEl("p", "change-notes", change.notes));
  }
  if (replacement) {
    const btn = makeEl("button", "copy-btn copy-btn--inline", replacement.label);
    btn.type = "button";
    btn.addEventListener("click", () => copyToClipboard(replacement.text, btn));
    card.appendChild(btn);
  }
  if (checkable) {
    const tick = makeEl("label", "change-done");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.addEventListener("change", () => {
      card.classList.toggle("is-done", box.checked);
      if (onToggle) onToggle();
    });
    tick.append(box, " Done");
    card.appendChild(tick);
  }
  return card;
}
