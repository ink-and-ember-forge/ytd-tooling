// Turns the rich text editor's (Quill) HTML into clean, pasteable HTML. Uses DOMParser.

/* Quill represents BOTH bulleted and numbered lists as <ol> with a
   data-list="bullet"/"ordered" attribute, and relies on its own
   stylesheet to draw the markers — it never outputs a real <ul>.
   Pasted as-is, that wouldn't render correctly outside the editor.
   This rebuilds genuine <ul>/<ol> elements and strips every
   Quill-specific attribute/class before anything reaches the output. */
export function cleanQuillHTML(html) {
  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, "text/html");
  const root = doc.getElementById("__root");

  // Remove Quill's internal editing-only UI markers
  root.querySelectorAll(".ql-ui").forEach(el => el.remove());

  // Rebuild real <ul>/<ol> from Quill's data-list <ol> items
  Array.from(root.querySelectorAll("ol")).forEach(ol => {
    const fragment = doc.createDocumentFragment();
    let currentList = null;
    let currentTag = null;

    Array.from(ol.children).forEach(li => {
      const listType = li.getAttribute("data-list"); // "bullet" or "ordered"
      li.removeAttribute("data-list");
      const tag = listType === "bullet" ? "ul" : "ol";
      if (tag !== currentTag) {
        currentList = doc.createElement(tag);
        fragment.appendChild(currentList);
        currentTag = tag;
      }
      currentList.appendChild(li);
    });

    ol.replaceWith(fragment);
  });

  // Strip any remaining Quill-specific classes/attributes
  root.querySelectorAll("[class]").forEach(el => {
    const cleaned = el.className.split(" ").filter(c => c && !c.startsWith("ql-")).join(" ");
    if (cleaned) el.className = cleaned; else el.removeAttribute("class");
  });

  // Add the external-link icon to any link set to open in a new tab —
  // matches the convention used across every other block. Added here,
  // at generation time, rather than kept live inside the editor, so it
  // can never desync from Quill's own tracked content.
  root.querySelectorAll('a[target="_blank"]').forEach(a => {
    if (!a.querySelector(".fa-up-right-from-square")) {
      a.appendChild(doc.createTextNode(" "));
      const icon = doc.createElement("i");
      icon.className = "fa-solid fa-up-right-from-square button-icon inline-icon";
      a.appendChild(icon);
    }
  });

  // Drop empty trailing paragraphs Quill leaves behind
  root.querySelectorAll("p").forEach(p => {
    if (p.innerHTML.trim() === "" || p.innerHTML.trim() === "<br>") p.remove();
  });

  return root.innerHTML.trim();
}

/* Finds the first <p> in already-cleaned rich-text HTML and adds a
   class to it — used by Hero text to guarantee its opening paragraph
   is always styled larger, structurally, regardless of what's typed.
   Only ever adds the class; never touches anything else. */
export function markFirstParagraphLarge(html, className) {
  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, "text/html");
  const root = doc.getElementById("__root");
  const firstP = root.querySelector("p");
  if (firstP) {
    const existing = firstP.getAttribute("class");
    firstP.setAttribute("class", existing ? `${existing} ${className}` : className);
  }
  return root.innerHTML.trim();
}
