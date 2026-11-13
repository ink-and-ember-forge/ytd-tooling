<script>
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
    e.stopPropagation(); // to fix event propagation

    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

</script>