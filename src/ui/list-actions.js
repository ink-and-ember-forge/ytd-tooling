// Per-item controls for lists (cards, buttons, accordion titles...):
// move up / down, duplicate, and remove with Undo. Wired up by fields.js.
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

// Call once per list container.
export function initList(container) {
  new MutationObserver(() => refreshArrows(container)).observe(container, { childList: true });
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
  }
  refreshArrows(container);
}
