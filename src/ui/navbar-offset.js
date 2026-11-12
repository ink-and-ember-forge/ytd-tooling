// When this page is shown under thinqi's navbar, leave room for it. When it is
// served on its own (GitHub Pages, localhost) there is no navbar, so no gap:
// the old fixed 95px fallback left a dead strip above the sticky header.
// Sets --thinqi-navbar-height, which the stylesheets read.
function updateNavbarOffset() {
  try {
    const navbar =
      document.querySelector("div.app-chrome") ||
      document.querySelector(".public-site-header");
    const height = navbar ? navbar.offsetHeight : 0;
    document.documentElement.style.setProperty("--thinqi-navbar-height", (height > 0 ? height : 0) + "px");
  } catch (err) {
    console.log("updateNavbarOffset failed", err);
  }
}
window.addEventListener("resize", updateNavbarOffset);
updateNavbarOffset();
