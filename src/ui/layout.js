// Publishes the header's height as a CSS variable: the workbench fills the window
// below it (see tabs.css), and the stacked layout sticks the block row under it.
export function initLayout() {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;
  const set = () => document.documentElement.style.setProperty("--topbar-h", topbar.offsetHeight + "px");
  new ResizeObserver(set).observe(topbar);
  set();
}

// Closes a <details class="menu"> when you click elsewhere or press Escape; one open at a time.
export function initMenus() {
  const menus = Array.from(document.querySelectorAll("details.menu"));
  menus.forEach((m) => m.addEventListener("toggle", () => {
    if (m.open) menus.forEach((o) => { if (o !== m) o.open = false; });
  }));
  document.addEventListener("click", (e) => menus.forEach((m) => { if (m.open && !m.contains(e.target)) m.open = false; }));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    menus.forEach((m) => { if (m.open) { m.open = false; m.querySelector("summary").focus(); } });
  });
}
