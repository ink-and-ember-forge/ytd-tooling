// Gwella base JS · version 3.3.1
// The closing script tag near the end is escaped. Keep the backslash, or it ends this script early.
// Set the top margin and anchor offset for the page container.
// Also offsets for an optional #subnav, if the page has one.
function updateScrollOffset() {
  try {
    const thinqiNavbar =
      document.querySelector("div.app-chrome") ||
      document.querySelector(".public-site-header");
    const customSubnav = document.querySelector("#subnav");
    const isMobile = window.innerWidth <= 768;
    const thinqiNav_height = thinqiNavbar ? thinqiNavbar.offsetHeight : null;
    const customSubnav_height = customSubnav ? customSubnav.offsetHeight : null;
    let totalOffset = isMobile
      ? thinqiNav_height
      : thinqiNav_height + customSubnav_height;
    if (!thinqiNav_height && !customSubnav_height) {
      totalOffset = isMobile ? 137 : 145;
    }
    document.documentElement.style.setProperty(
      "--anchor-section-offset",
      totalOffset + "px",
    );
    const fallbackHeight = isMobile ? 137 : 95;
    if (thinqiNav_height > 0) {
      document.documentElement.style.setProperty(
        "--thinqi-navbar-height",
        thinqiNav_height + "px",
      );
    } else {
      document.documentElement.style.setProperty(
        "--thinqi-navbar-height",
        fallbackHeight + "px",
      );
    }
  } catch (error) {
    console.log("updateScrollOffset failed", error);
  }
}
window.addEventListener("DOMContentLoaded", updateScrollOffset);
window.addEventListener("resize", updateScrollOffset);
// Tooltips
const tooltipList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipTriggerList = [].slice.call(tooltipList);
tooltipTriggerList.forEach(
  (el) =>
    new bootstrap.Tooltip(el, {
      container: el,
    }),
);
// Back to top
const backToTopBtn = document.querySelector(".back-to-top");
if (backToTopBtn) {
  window.addEventListener("scroll", () => {
    const isTabletOrMobileView = window.innerWidth <= 768;
    const threshold = isTabletOrMobileView
      ? window.innerHeight
      : window.innerHeight / 2;
    backToTopBtn.style.display = window.scrollY < threshold ? "none" : "flex";
  });
  backToTopBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
