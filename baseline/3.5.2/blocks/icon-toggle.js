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
