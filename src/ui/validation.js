// Gentle, live feedback on a block's form: bad web addresses and empty list
// items. Nothing here blocks output; it only explains what will happen.

const URL_OK = /^(https?:\/\/\S+|\/\S*|#\S*|mailto:\S+|tel:\S+)$/i;

// URL inputs are recognised by class name (…-url); the video field also accepts a bare video ID.
const isUrlInput = (el) => /(^|-)url\b/.test(el.className) && !el.classList.contains("media-video-url");

export function validateForm(root) {
  root.querySelectorAll('input[type="text"]').forEach((input) => {
    if (!isUrlInput(input)) return;
    const value = input.value.trim();
    const bad = value !== "" && !URL_OK.test(value);
    input.classList.toggle("is-invalid", bad);
    input.setAttribute("aria-invalid", String(bad));
    let msg = input.nextElementSibling;
    const hasMsg = msg && msg.classList.contains("field-error");
    if (bad && !hasMsg) {
      msg = document.createElement("p");
      msg.className = "field-error";
      msg.id = input.id ? `${input.id}-err` : "";
      msg.textContent = "This doesn't look like a web address. It should start with https:// (or be a page path like /page).";
      input.after(msg);
      if (msg.id) input.setAttribute("aria-describedby", msg.id);
    } else if (!bad && hasMsg) {
      msg.remove();
      input.removeAttribute("aria-describedby");
    }
  });

  // A card/row with nothing in it is left out of the output: say so.
  root.querySelectorAll(".item-card").forEach((card) => {
    const empty = Array.from(card.querySelectorAll('input[type="text"], textarea')).every((el) => el.value.trim() === "");
    card.classList.toggle("is-empty", empty);
  });
}
