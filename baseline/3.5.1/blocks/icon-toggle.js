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
