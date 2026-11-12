// Small, non-blocking messages ("Copied", "Removed card 2 — Undo"). Replaces alert().
let region;

function getRegion() {
  if (!region) {
    region = document.createElement("div");
    region.className = "toasts";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  return region;
}

// toast("Copied"), or toast("Removed", { actionLabel: "Undo", onAction: () => ... })
export function toast(message, { actionLabel, onAction, timeout = 6000 } = {}) {
  const el = document.createElement("div");
  el.className = "toast";
  el.appendChild(document.createTextNode(message));
  const dismiss = () => el.remove();
  if (actionLabel && onAction) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => { onAction(); dismiss(); });
    el.appendChild(btn);
  }
  getRegion().appendChild(el);
  setTimeout(dismiss, actionLabel ? Math.max(timeout, 8000) : Math.min(timeout, 2500));
  return dismiss;
}
