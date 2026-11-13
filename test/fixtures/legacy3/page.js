<script>
// WARNING: this string contains a literal closing script tag further
// down (escaped right before the closing backtick). If you ever edit
// this, keep that escape — an unescaped closing tag here will silently
// truncate THIS TOOL's own script block at that point, since the HTML
// parser can't tell a closing tag inside a JS string apart from a real
// one. Same risk applies to any future block whose generated output
// might ever contain that literal text.
// Dynamically calculate top margin for the page container ____________
function updateTopMargin() {
  const thinqiNavbar =
    document.querySelector("div.app-chrome") ||
    document.querySelector(".public-site-header");
  const thinqiNav_height = thinqiNavbar ? thinqiNavbar.offsetHeight : null;
  if (thinqiNav_height > 0) {
    document.documentElement.style.setProperty(
      "--thinqi-navbar-height",
      thinqiNav_height + "px",
    );
  }
}
window.addEventListener("DOMContentLoaded", updateTopMargin);
window.addEventListener("resize", updateTopMargin);
// Tooltips initialization ________
const tooltipList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipTriggerList = [].slice.call(tooltipList);
tooltipTriggerList.forEach(
  (el) =>
    new bootstrap.Tooltip(el, {
      container: el,
    }),
);
// Back to top button ____________
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

function openAccordion(tileColumn, contentId) {
  const tile = tileColumn.querySelector(".data-icon-card");
  const openContent = document.querySelector(".content-display.active");
  const activeTile = document.querySelector(".data-icon-card.active");
  if (openContent && openContent.id !== contentId) {
    openContent.classList.remove("active");
    openContent.style.display = "none";
  }
  if (activeTile && activeTile !== tile) {
    activeTile.classList.remove("active");
  }
  const content = document.getElementById(contentId);
  if (content.style.display === "block") {
    content.style.display = "none";
    content.classList.remove("active");
    tile.classList.remove("active");
  } else {
    content.style.display = "block";
    content.classList.add("active");
    tile.classList.add("active");
    if (window.innerWidth <= 768) {
      tileColumn.insertAdjacentElement("afterend", content);
    }
    content.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}
function openAccordionKey(event, tileColumn, contentID) {
  if (event.key === "Enter") {
    openAccordion(tileColumn, contentID);
  }
}
</script>