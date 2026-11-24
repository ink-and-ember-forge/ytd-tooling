// Preview theme (Gwella / Y Tŷ Dysgu). The header toggle switches every block
// preview; the Base HTML download uses the same class, so what's previewed is
// what gets pasted.
import { getPref, setPref } from "./storage.js";

let activeTheme = getPref("theme", "gwella");
const listeners = [];

export const getTheme = () => activeTheme;
export const onThemeChange = (fn) => listeners.push(fn);

// The builder's own colours follow the theme too (see --accent in styles/tokens.css).
const paint = (theme) => document.documentElement.setAttribute("data-theme", theme);
paint(activeTheme);

export function setTheme(theme) {
  activeTheme = theme;
  paint(theme);
  setPref("theme", theme);
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.theme === theme));
  });
  listeners.forEach((fn) => fn());
}

export function initThemeToggle() {
  setTheme(activeTheme);
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.theme));
  });
}
