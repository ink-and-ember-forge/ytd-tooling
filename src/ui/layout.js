// Publishes the heights of the sticky header and block tab bar as CSS variables,
// so the sticky preview panel can sit just below them.
export function initLayout() {
  const root = document.documentElement;
  const watch = (el, name) => {
    if (!el) return;
    const set = () => root.style.setProperty(name, el.offsetHeight + "px");
    new ResizeObserver(set).observe(el);
    set();
  };
  watch(document.getElementById("topbar"), "--topbar-h");
  watch(document.getElementById("tabbar"), "--tabbar-h");
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
