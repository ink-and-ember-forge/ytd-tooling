// Preview theme (Gwella / Y Tŷ Dysgu). The header toggle switches every block
// preview; the Base HTML download uses the same class, so what's previewed is
// what gets pasted.
let activeTheme = "gwella";
const listeners = [];

export const getTheme = () => activeTheme;
export const onThemeChange = (fn) => listeners.push(fn);

export function setTheme(theme) {
  activeTheme = theme;
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.theme === theme));
  });
  listeners.forEach((fn) => fn());
}

export function initThemeToggle() {
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.theme));
  });
}
