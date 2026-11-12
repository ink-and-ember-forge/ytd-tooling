// Accessible tabs: roles, aria-selected, roving tabindex, arrow/Home/End keys.
// The caller supplies the tab buttons and a function that returns each one's panel.
// `bothAxes`: also move with Up/Down (for the block rail, which is a column on wide
// screens and a row on narrow ones).
export function initTabs({ tabs, panelFor, onSelect, initial = 0, bothAxes = false }) {
  const list = Array.from(tabs);

  function select(tab, { focus = false } = {}) {
    list.forEach((t) => {
      const on = t === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = panelFor(t);
      if (panel) { panel.hidden = !on; panel.classList.toggle("active", on); }
    });
    if (focus) tab.focus();
    if (onSelect) onSelect(tab);
  }

  list.forEach((tab, i) => {
    tab.setAttribute("role", "tab");
    const panel = panelFor(tab);
    if (panel) {
      panel.setAttribute("role", "tabpanel");
      if (!tab.id) tab.id = "tab-" + (panel.id || i);
      panel.setAttribute("aria-labelledby", tab.id);
      tab.setAttribute("aria-controls", panel.id);
    }
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last", ...(bothAxes ? { ArrowDown: 1, ArrowUp: -1 } : {}) };
      if (!(e.key in keys)) return;
      e.preventDefault();
      const k = keys[e.key];
      const next = k === "first" ? list[0] : k === "last" ? list[list.length - 1] : list[(list.indexOf(tab) + k + list.length) % list.length];
      select(next, { focus: true });
    });
  });

  select(list[initial] || list[0]);
  return { select: (tab) => select(tab) };
}
