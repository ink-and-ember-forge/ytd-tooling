// Rich-text links: a Quill link format that remembers 'opens in a new tab', plus the
// shared dialog used to insert one. Needs the Quill global (loaded in index.html).
import { linkIsExternal } from "../lib/links.js";
import { toast } from "./toast.js";

const QuillLink = Quill.import("formats/link");
class TargetLink extends QuillLink {
  static create(value) {
    const href = typeof value === "string" ? value : (value && value.href) || "";
    const node = super.create(href);
    if (value && typeof value === "object" && value.target === "_blank") {
      node.setAttribute("target", "_blank");
      if (linkIsExternal(href)) {
        node.setAttribute("rel", "noopener noreferrer");
      } else {
        node.removeAttribute("rel");
      }
    } else {
      node.removeAttribute("target");
      node.removeAttribute("rel");
    }
    return node;
  }
  static formats(node) {
    return {
      href: node.getAttribute("href"),
      target: node.getAttribute("target") === "_blank" ? "_blank" : false
    };
  }
}
Quill.register(TargetLink, true);

/* Shared link-insertion dialog — one instance reused by every rich
   text editor on the page. */
const linkDialogOverlay = document.createElement("div");
linkDialogOverlay.className = "link-dialog-overlay";
linkDialogOverlay.innerHTML = `
  <div class="link-dialog">
    <label>Link URL</label>
    <input type="text" class="link-dialog-url" placeholder="https://..." />
    <label class="link-dialog-checkbox-label">
      <input type="checkbox" class="link-dialog-newtab" />
      Open in a new tab
    </label>
    <div class="link-dialog-actions">
      <button type="button" class="link-dialog-cancel">Cancel</button>
      <button type="button" class="link-dialog-insert">Insert link</button>
    </div>
  </div>`;
document.body.appendChild(linkDialogOverlay);

const linkDialogUrl = linkDialogOverlay.querySelector(".link-dialog-url");
const linkDialogNewTab = linkDialogOverlay.querySelector(".link-dialog-newtab");
const linkDialogCancelBtn = linkDialogOverlay.querySelector(".link-dialog-cancel");
const linkDialogInsertBtn = linkDialogOverlay.querySelector(".link-dialog-insert");

let linkDialogActiveQuill = null;
let linkDialogActiveRange = null;

export function openLinkDialog(quill) {
  const range = quill.getSelection();
  if (!range || range.length === 0) {
    toast("Select some text first, then click the link button to turn it into a link.");
    return;
  }
  linkDialogActiveQuill = quill;
  linkDialogActiveRange = range;

  const existing = quill.getFormat(range).link;
  if (existing && typeof existing === "object") {
    linkDialogUrl.value = existing.href || "";
    linkDialogNewTab.checked = existing.target === "_blank";
  } else if (typeof existing === "string") {
    linkDialogUrl.value = existing;
    linkDialogNewTab.checked = false;
  } else {
    linkDialogUrl.value = "";
    linkDialogNewTab.checked = false;
  }

  linkDialogOverlay.classList.add("visible");
  linkDialogUrl.focus();
}

function closeLinkDialog() {
  linkDialogOverlay.classList.remove("visible");
  linkDialogActiveQuill = null;
  linkDialogActiveRange = null;
}

linkDialogCancelBtn.addEventListener("click", closeLinkDialog);

linkDialogOverlay.addEventListener("click", (e) => {
  if (e.target === linkDialogOverlay) closeLinkDialog();
});

linkDialogInsertBtn.addEventListener("click", () => {
  if (!linkDialogActiveQuill || !linkDialogActiveRange) return;
  const url = linkDialogUrl.value.trim();
  const quillRef = linkDialogActiveQuill;
  const rangeRef = linkDialogActiveRange;
  if (url) {
    quillRef.format("link", {
      href: url,
      target: linkDialogNewTab.checked ? "_blank" : false
    });
  }
  closeLinkDialog();
  quillRef.setSelection(rangeRef.index + rangeRef.length, 0);
});
