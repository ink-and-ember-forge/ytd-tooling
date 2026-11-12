// "How it works": each block's plain-English explanation, shown in a lightbox.
// One native <dialog> is shared by every block. The browser provides the modal
// behaviour: focus stays inside, Esc closes it, the page behind is inert, and focus
// returns to the button that opened it. We add: a close button, click-outside-to-close,
// and the content.
let dialog = null;
let titleEl = null;
let bodyEl = null;
let footEl = null;
let onExplore = null;

function build() {
  dialog = document.createElement("dialog");
  dialog.className = "guide-dialog";
  dialog.setAttribute("aria-labelledby", "guide-title");
  dialog.innerHTML = `
    <div class="guide-card">
      <header class="guide-head">
        <h2 id="guide-title"></h2>
        <button type="button" class="guide-close" aria-label="Close">×</button>
      </header>
      <div class="guide-body" tabindex="-1"></div>
      <footer class="guide-foot" hidden>
        <p>Want to see this on your own block?</p>
        <button type="button" class="primary-btn guide-explore">Explore it on my block →</button>
      </footer>
    </div>`;
  titleEl = dialog.querySelector("#guide-title");
  bodyEl = dialog.querySelector(".guide-body");
  footEl = dialog.querySelector(".guide-foot");
  dialog.querySelector(".guide-explore").addEventListener("click", () => {
    const go = onExplore;
    dialog.close();
    if (go) go();
  });
  dialog.querySelector(".guide-close").addEventListener("click", () => dialog.close());
  // A click on the backdrop lands on the <dialog> itself (the card fills the rest of it).
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  document.body.appendChild(dialog);
}

// `html` is the block's trusted how-it-works.html (our own file, not user input).
// `onExplore` (optional): shows a "Explore it on my block" button that closes the lightbox
// and calls this (used to jump to the Explain tab).
export function openGuide(title, html, { onExplore: explore } = {}) {
  if (!dialog) build();
  onExplore = explore || null;
  footEl.hidden = !onExplore;
  titleEl.textContent = `How it works · ${title}`;
  bodyEl.innerHTML = html;
  bodyEl.scrollTop = 0;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", ""); // very old browsers: shown, but not modal
}
