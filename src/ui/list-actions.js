// Per-item controls for lists (cards, buttons, accordion titles...):
// collapse to a one-line summary (one open at a time), move up / down, duplicate,
// and remove with Undo. Wired up by fields.js. Generic: any list block gets it.
import { toast } from "./toast.js";
import { copyControls } from "./form-state.js";
import { associateLabels } from "./a11y.js";

const announce = (container) => container.dispatchEvent(new Event("input", { bubbles: true }));

function items(container) {
  return Array.from(container.children).filter((c) => c.matches(".item-card, .bullet-row"));
}

// Disable "up" on the first item and "down" on the last.
function refreshArrows(container) {
  const list = items(container);
  list.forEach((el, i) => {
    const up = el.querySelector(".item-up, .bullet-up");
    const down = el.querySelector(".item-down, .bullet-down");
    if (up) up.disabled = i === 0;
    if (down) down.disabled = i === list.length - 1;
    const remove = el.querySelector(".item-remove, .bullet-remove");
    if (remove) remove.setAttribute("aria-label", `Remove ${nameOf(el)} ${i + 1}`);
  });
}

const nameOf = (el) => (el.matches(".bullet-row") ? "item" : (el.querySelector(".item-card-title")?.textContent || "item").toLowerCase());

function button(className, text, label) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = text;
  b.setAttribute("aria-label", label);
  b.title = label;
  return b;
}

function move(container, el, dir) {
  const sibling = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
  if (!sibling) return;
  dir < 0 ? container.insertBefore(el, sibling) : container.insertBefore(sibling, el);
  announce(container);
}

function duplicate(container, el) {
  const wrap = container.closest(".field");
  const add = wrap.querySelector(".item-add, .bullet-add");
  add.click();
  const copy = items(container).pop();
  container.insertBefore(copy, el.nextElementSibling);
  copyControls(el, copy);
  announce(container);
  const first = copy.querySelector("input, textarea, select");
  if (first) first.focus();
}

function remove(container, el) {
  const label = `${nameOf(el)} ${items(container).indexOf(el) + 1}`;
  const next = el.nextElementSibling;
  el.remove();
  announce(container);
  toast(`Removed ${label}`, {
    actionLabel: "Undo",
    onAction: () => {
      container.insertBefore(el, next && next.parentNode === container ? next : null);
      announce(container);
    },
  });
}

// ---- collapsing ------------------------------------------------------------
// A collapsed card shows "Card 2 · its title". Which control gives the title:
// the first filled-in one whose class suggests a name, else the first filled-in
// text control that isn't a URL.
const NAMEY = /title|label|heading|name|desc/;
const URLY = /url/;

function summaryOf(card) {
  const controls = Array.from(card.querySelectorAll('input[type="text"], textarea'));
  const filled = controls.filter((c) => c.value.trim() !== "");
  if (filled.length === 0) return { text: "Empty (left out of the output)", empty: true };
  const pick = filled.find((c) => NAMEY.test(c.className)) || filled.find((c) => !URLY.test(c.className)) || filled[0];
  const text = pick.value.trim().replace(/\s+/g, " ");
  return { text: text.length > 70 ? text.slice(0, 70) + "…" : text, empty: false };
}

function updateSummary(card) {
  const out = card.querySelector(".item-summary");
  if (!out) return;
  const { text, empty } = summaryOf(card);
  out.textContent = text;
  out.classList.toggle("is-empty", empty);
}

function setOpen(card, open) {
  card.classList.toggle("is-open", open);
  const toggle = card.querySelector(".item-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", String(open));
}

// Open one item and close the others in its list.
export function openOnly(container, card) {
  items(container).forEach((c) => c.matches(".item-card") && setOpen(c, c === card));
}

// Opens the item containing `el` (used when something outside points at a field).
export function revealItem(el) {
  const card = el.closest(".item-card");
  if (card) openOnly(card.parentElement, card);
}

function makeCollapsible(container, card) {
  const header = card.querySelector(".item-card-header");
  const title = header.querySelector(".item-card-title");
  const body = document.createElement("div");
  body.className = "item-card-body";
  body.id = `item-body-${Math.random().toString(36).slice(2, 8)}`;
  while (header.nextSibling) body.appendChild(header.nextSibling);
  card.appendChild(body);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "item-toggle";
  toggle.setAttribute("aria-controls", body.id);
  const chevron = document.createElement("span");
  chevron.className = "item-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "▸";
  const summary = document.createElement("span");
  summary.className = "item-summary";
  toggle.append(chevron, title, summary);
  header.prepend(toggle);

  // One open at a time; the first item starts open, later ones collapsed.
  const startOpen = !container.querySelector(".item-card.is-open");
  setOpen(card, startOpen);
  toggle.addEventListener("click", () => {
    if (card.classList.contains("is-open")) setOpen(card, false);
    else openOnly(container, card);
  });
  card.addEventListener("input", () => updateSummary(card));
  card.addEventListener("change", () => updateSummary(card));
  updateSummary(card);
}

// Call once per list container.
export function initList(container) {
  new MutationObserver(() => refreshArrows(container)).observe(container, { childList: true });
  // "+ Add" opens the new item (and closes the others) so you can type straight away.
  const wrap = container.closest(".field");
  wrap.addEventListener("click", (e) => {
    if (!e.target.closest(".item-add")) return;
    const added = items(container).pop();
    if (!added || !added.matches(".item-card")) return;
    openOnly(container, added);
    const first = added.querySelector("input, textarea, select");
    if (first && e.isTrusted) first.focus(); // only for a real click, not for restore/duplicate
  });
}

// Call for every item as it is created. `header` is where the buttons go.
export function wireItem(container, el) {
  associateLabels(el);
  const isBullet = el.matches(".bullet-row");
  const removeBtn = el.querySelector(".item-remove, .bullet-remove");
  const up = button(isBullet ? "bullet-up" : "item-up", "↑", "Move up");
  const down = button(isBullet ? "bullet-down" : "item-down", "↓", "Move down");
  up.addEventListener("click", () => move(container, el, -1));
  down.addEventListener("click", () => move(container, el, 1));
  removeBtn.onclick = () => remove(container, el);
  removeBtn.before(up, down);
  if (!isBullet) {
    const dup = button("item-dup", "Duplicate", "Duplicate");
    dup.addEventListener("click", () => duplicate(container, el));
    removeBtn.before(dup);
    makeCollapsible(container, el);
  }
  refreshArrows(container);
}
