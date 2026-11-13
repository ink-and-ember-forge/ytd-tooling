// Pieces shared by the Upgrade and Migrate flows: the copy cards, the problems list, and the
// before/after view of the page. Pure display; the logic is in src/changelog/.
import { makeEl, copyToClipboard } from "../lib/dom.js";

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One of the three outputs (HTML / CSS / JS): a description, a Copy button and the code behind a disclosure.
// `blocked` (a reason) disables copying until the author has done something.
export function outputCard(title, description, text, { blocked = null } = {}) {
  const card = makeEl("div", "upgrade-output");
  const head = makeEl("div", "upgrade-output-head");
  const t = makeEl("div");
  t.append(makeEl("strong", "", title), makeEl("p", "upgrade-hint", description));
  const btn = makeEl("button", "copy-btn copy-btn--inline", `Copy ${title}`);
  btn.type = "button";
  if (blocked) { btn.disabled = true; btn.title = blocked; }
  btn.addEventListener("click", () => copyToClipboard(text, btn));
  head.append(t, btn);
  card.appendChild(head);
  if (blocked) card.appendChild(makeEl("p", "upgrade-flag", blocked));
  const details = document.createElement("details");
  details.appendChild(makeEl("summary", "", "Show the code"));
  const area = document.createElement("textarea");
  area.readOnly = true;
  area.rows = 8;
  area.className = "upgrade-input";
  area.value = text;
  area.setAttribute("aria-label", `${title} code`);
  details.appendChild(area);
  card.appendChild(details);
  return card;
}

// A <style>/<script> wrapper if the author pasted bare code.
const wrap = (text, tag) => (!text.trim() || new RegExp(`^\\s*<${tag}`, "i").test(text) ? text : `<${tag}>\n${text}\n</${tag}>`);

// A whole page as an iframe document. Scripts are allowed to run (it is the author's own page) but the frame is
// sandboxed, so it cannot reach the builder.
// `highlight`: selectors whose elements are outlined, and (scroll "first") the first brought to the middle of the frame; "top"
// leaves the page at its top (for the review's side-by-side frames). The frame is scrolled with window.scrollTo, NOT
// scrollIntoView: scrollIntoView inside an iframe also scrolls the PARENT page to show the frame, which threw the whole
// builder around every time a frame loaded.
export const pageDoc = ({ html, css, js }, { highlight = [], scroll = "first" } = {}) => {
  const mark = highlight.length
    ? `<style>.__hl{outline:3px dashed #e07b00!important;outline-offset:2px}</style><script>(function(){var first;${JSON.stringify(highlight).replace(/</g, "\\u003c")}.forEach(function(s){try{document.querySelectorAll(s).forEach(function(e){e.classList.add("__hl");first=first||e})}catch(x){}});${scroll === "first" ? "if(first)setTimeout(function(){window.scrollTo(0,Math.max(0,first.getBoundingClientRect().top+window.pageYOffset-window.innerHeight\/2))},50);" : ""}})()<\/script>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">${wrap(css, "style")}${html}${wrap(js, "script")}${mark}</body></html>`;
};

// "Check before you copy": the problems found, then the page before and after in one frame you can flip between.
// before / after: { html, css, js }. lint: from lintPage().
export function renderCheck(container, { before, after, lint, number = 5 }) {
  container.replaceChildren(makeEl("h3", "step-title", `${number}. Check before you copy`));
  const list = makeEl("ul", "upgrade-checks");
  const line = (ok, text, detail, listing) => {
    const li = makeEl("li", ok ? "upgrade-check-line upgrade-check-line--ok" : "upgrade-check-line upgrade-check-line--warn");
    li.appendChild(makeEl("span", "", `${ok ? "✔" : "⚠"} ${text}`));
    if (detail) li.appendChild(makeEl("p", "upgrade-hint", detail));
    if (listing) li.appendChild(makeEl("pre", "upgrade-diff", listing));
    list.appendChild(li);
  };
  const broken = lint.missingFunctions || [];
  line(!broken.length, broken.length ? `Your HTML calls ${broken.map((f) => `${f}()`).join(", ")}, which the new JS doesn't define` : "Every function your HTML calls is defined",
    broken.length ? "Clicking these will do nothing. Re-add the functions to the JS after pasting, or tick the block they belong to above." : "");
  line(!lint.unstyledClasses.length, lint.unstyledClasses.length ? `${plural(lint.unstyledClasses.length, "class", "classes")} in your HTML ${lint.unstyledClasses.length === 1 ? "has" : "have"} no styling` : "Every class in your HTML has styling",
    [lint.unstyledClasses.length ? lint.unstyledClasses.map((c) => `.${c}`).join(", ") + ". If you meant to keep their styles, tick them above." : "",
      lint.neverStyled?.length ? `${lint.neverStyled.map((c) => `.${c}`).join(", ")} had no styling in your old CSS either, so nothing was lost.` : ""].filter(Boolean).join(" "));
  line(!lint.undefinedVars.length, lint.undefinedVars.length ? `${plural(lint.undefinedVars.length, "variable", "variables")} used but not defined` : "No undefined CSS variables",
    lint.undefinedVars.length ? lint.undefinedVars.join(", ") + `. Anything using ${lint.undefinedVars.length === 1 ? "it has" : "them has"} no effect.` : "");
  line(!lint.tagProblems.length, lint.tagProblems.length ? `${plural(lint.tagProblems.length, "problem", "problems")} in your HTML tags` : "Your HTML tags open and close properly",
    lint.tagProblems.length ? "These are in your own HTML, so they are not fixed for you. They can break the layout." : "",
    lint.tagProblems.join("\n"));
  container.appendChild(list);

  // The frame is only built once the author asks to see it, and rebuilt when they flip between before and after.
  const details = document.createElement("details");
  details.className = "upgrade-preview";
  details.appendChild(makeEl("summary", "", "See the page before and after"));
  const bar = makeEl("div", "upgrade-seg");
  const stage = makeEl("div", "upgrade-stage");
  let showing = "after", width = "desktop";
  const buttons = [];
  const draw = () => {
    buttons.forEach(([kind, value, b]) => b.setAttribute("aria-pressed", String(kind === "view" ? value === showing : value === width)));
    const frame = document.createElement("iframe");
    frame.className = "upgrade-frame";
    frame.title = `The page ${showing === "before" ? "as it is now" : "after upgrading"}`;
    frame.setAttribute("sandbox", "allow-scripts");
    frame.style.width = width === "phone" ? "390px" : "100%";
    frame.srcdoc = pageDoc(showing === "before" ? before : after);
    stage.replaceChildren(frame);
  };
  [["view", "before", "Before"], ["view", "after", "After"], ["width", "desktop", "Desktop"], ["width", "phone", "Phone"]].forEach(([kind, value, label]) => {
    const b = makeEl("button", "upgrade-seg-btn", label);
    b.type = "button";
    b.addEventListener("click", () => { if (kind === "view") showing = value; else width = value; draw(); });
    buttons.push([kind, value, b]);
    bar.appendChild(b);
  });
  details.append(bar, stage);
  details.addEventListener("toggle", () => { if (details.open) draw(); else stage.replaceChildren(); });
  container.appendChild(details);
}
