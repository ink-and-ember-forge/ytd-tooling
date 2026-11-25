// Gwella base JS · version 3.5.1
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
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
}

function openAccordion(tileColumn, contentId) {
  const tile = tileColumn.querySelector(".data-icon-card");
  const setExpanded = (card, open) => {
    const trigger = card && card.parentElement;
    if (trigger && trigger.hasAttribute("aria-expanded")) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  };
  const openContent = document.querySelector(".content-display.active");
  const activeTile = document.querySelector(".data-icon-card.active");
  if (openContent && openContent.id !== contentId) {
    openContent.classList.remove("active");
    openContent.style.display = "none";
  }
  if (activeTile && activeTile !== tile) {
    activeTile.classList.remove("active");
    setExpanded(activeTile, false);
  }
  const content = document.getElementById(contentId);
  if (content.style.display === "block") {
    content.style.display = "none";
    content.classList.remove("active");
    tile.classList.remove("active");
    setExpanded(tile, false);
  } else {
    content.style.display = "block";
    content.classList.add("active");
    tile.classList.add("active");
    setExpanded(tile, true);
    if (window.innerWidth <= 768) {
      tileColumn.insertAdjacentElement("afterend", content);
    }
    content.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }
}
function openAccordionKey(event, tileColumn, contentID) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault(); // Space would otherwise scroll the page
    openAccordion(tileColumn, contentID);
  }
}
