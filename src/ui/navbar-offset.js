// The builder's own page sits under thinqi's navbar like any generated page,
// so it measures the navbar the same way Base JS does.
function updateToolNavOffset() {
  try {
    const thinqiNavbar =
      document.querySelector("div.app-chrome") ||
      document.querySelector(".public-site-header");
    const height = thinqiNavbar ? thinqiNavbar.offsetHeight : null;
    document.documentElement.style.setProperty(
      "--thinqi-navbar-height",
      (height > 0 ? height : 95) + "px"
    );
  } catch (err) {
    console.log("updateToolNavOffset failed", err);
  }
}
window.addEventListener("DOMContentLoaded", updateToolNavOffset);
window.addEventListener("resize", updateToolNavOffset);

/* ===================================================================
   BASE FILES
   =================================================================== */

// Run now as well as on load: module scripts can start after DOMContentLoaded has been queued.
updateToolNavOffset();
