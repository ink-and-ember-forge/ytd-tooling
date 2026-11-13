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

// The script of a close-up (src/ui/closeup.js). It runs INSIDE the preview frame: it outlines the elements a rule touches, measures
// their computed styles and reports them to the builder, and, when asked to show an element, opens whatever is hiding it (a closed
// accordion, an icon card's panel, a closed <details>) and scrolls this frame (never the builder) to it. It is a real function so
// it can be read and linted; it is sent to the frame as text, so it must not use anything outside itself.
// P: { selectors[], pad, lines: [{ sel, prop, media, pseudo, measurable }] }
function probeScript(P) {
  var els = [], opened = [], cur = null;
  var q = function (s) { try { return [].slice.call(document.querySelectorAll(s)); } catch (x) { return []; } };
  P.selectors.forEach(function (s) { q(s).forEach(function (e) { if (els.indexOf(e) < 0) els.push(e); }); });
  els.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
  els.forEach(function (e) { e.classList.add("__hl"); });
  var words = function (e) { return ((e && e.textContent) || "").replace(/\s+/g, " ").trim(); };
  var snippet = function (e) { var t = words(e); return t.length > 40 ? t.slice(0, 40) + "\u2026" : t; };
  var lines = P.lines.map(function (l) {
    var applies = true;
    if (l.media) { try { applies = matchMedia(l.media.replace(/^@media\s*/, "")).matches; } catch (x) { /* keep it */ } }
    var set = q(l.sel);
    return { applies: applies, measurable: l.measurable, vals: els.map(function (e) {
      if (set.indexOf(e) < 0) return null;
      try { return getComputedStyle(e, l.pseudo || null).getPropertyValue(l.prop).trim(); } catch (x) { return null; }
    }) };
  });

  // What was opened to show the current element is put back before the next one, so the page does not end up with everything open.
  var later = function (fn) { opened.push(fn); };
  var closeAgain = function () { while (opened.length) opened.pop()(); };
  var hidden = function (n) { return getComputedStyle(n).display === "none"; };
  function reveal(el) {
    closeAgain();
    var notes = [];
    for (var n = el; n && n !== document.body; n = n.parentElement) { // the element itself too: it may be the panel
      (function (n) {
        var cls = n.classList;
        if (n.tagName === "DETAILS" && !n.open) { n.open = true; later(function () { n.open = false; }); notes.push("a closed section"); }
        if (cls.contains("collapse") && !cls.contains("show")) {            // an accordion panel
          var btn = n.id ? document.querySelector('[data-bs-target="#' + n.id + '"]') : null, wasCollapsed = !!btn && btn.classList.contains("collapsed");
          cls.add("show");
          if (btn) { btn.classList.remove("collapsed"); btn.setAttribute("aria-expanded", "true"); }
          later(function () { cls.remove("show"); if (btn) { if (wasCollapsed) btn.classList.add("collapsed"); btn.setAttribute("aria-expanded", "false"); } });
          notes.push('the accordion "' + (snippet(btn) || "panel") + '"');
        }
        if (cls.contains("content-display") && hidden(n)) {                   // the panel an icon card opens (done by hand: the page's own
          var tile = n.id ? document.querySelector('[onclick*="' + n.id + '"]') : null;  // script scrolls, which would scroll the builder)
          var card = tile ? tile.querySelector(".data-icon-card") : null, home = { p: n.parentNode, next: n.nextSibling };
          n.style.display = "block"; n.classList.add("active"); if (card) card.classList.add("active");
          if (tile && innerWidth <= 768) tile.insertAdjacentElement("afterend", n);
          later(function () { n.style.display = "none"; n.classList.remove("active"); if (card) card.classList.remove("active"); if (home.p) home.p.insertBefore(n, home.next); });
          notes.push('the icon card "' + (snippet(tile) || "card") + '"');
        }
        if (hidden(n)) { var was = n.style.display; n.style.display = "block"; later(function () { n.style.display = was; }); notes.push("a hidden section"); }
      })(n);
    }
    return notes;
  }

  function show(i) {
    if (cur) cur.classList.remove("__cur");
    cur = els[i];
    if (!cur) return;
    var notes = reveal(cur);
    cur.classList.add("__cur");
    parent.postMessage({ __closeup: 1, type: "size", h: cur.getBoundingClientRect().height, notes: notes }, "*");
    // The element goes in the middle of the frame, with the page around it; one taller than the frame starts at the top of it.
    var go = function () {
      var r = cur.getBoundingClientRect(), room = innerHeight - 2 * P.pad;
      window.scrollTo(0, Math.max(0, r.top + window.pageYOffset - (r.height > room ? P.pad : (innerHeight - r.height) / 2)));
    };
    go(); setTimeout(go, 80); setTimeout(go, 300);
  }
  addEventListener("message", function (e) { if (e.data && e.data.__closeup === "go") show(e.data.i); });
  parent.postMessage({ __closeup: 1, type: "report", n: els.length, desc: els.map(function (e) { return "<" + e.tagName.toLowerCase() + "> \u201c" + snippet(e) + "\u201d"; }), lines: lines }, "*");
}
const probeMarkup = (probe) => `<style>.__hl{outline:3px dashed #e07b00!important;outline-offset:2px}.__cur{outline:3px solid #e07b00!important;outline-offset:2px}.back-to-top{display:none!important}</style><script>(${probeScript.toString()})(${JSON.stringify(probe).replace(/</g, "\\u003c")})<\/script>`;

// A whole page as an iframe document. Scripts are allowed to run (it is the author's own page) but the frame is
// sandboxed, so it cannot reach the builder.
// `highlight`: selectors whose elements are outlined, and (scroll "first") the first brought to the middle of the frame; "top"
// leaves the page at its top (for the review's side-by-side frames). The frame is scrolled with window.scrollTo, NOT
// scrollIntoView: scrollIntoView inside an iframe also scrolls the PARENT page to show the frame, which threw the whole
// builder around every time a frame loaded.
export const pageDoc = ({ html, css, js }, { highlight = [], scroll = "first", probe = null } = {}) => {
  const mark = probe ? probeMarkup(probe) : highlight.length
    ? `<style>.__hl{outline:3px dashed #e07b00!important;outline-offset:2px}</style><script>(function(){var first;${JSON.stringify(highlight).replace(/</g, "\\u003c")}.forEach(function(s){try{document.querySelectorAll(s).forEach(function(e){e.classList.add("__hl");first=first||e})}catch(x){}});${scroll === "first" ? "if(first)setTimeout(function(){window.scrollTo(0,Math.max(0,first.getBoundingClientRect().top+window.pageYOffset-window.innerHeight\/2))},50);" : ""}})()<\/script>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">${wrap(css, "style")}${html}${wrap(js, "script")}${mark}</body></html>`;
};

// "Check before you copy": the problems found, then the page before and after in one frame you can flip between.
// before / after: { html, css, js }. lint: from lintPage().
export function renderCheck(container, { before, after, lint, number = 5 }) { // number: null for no number (the wizard)
  container.replaceChildren(makeEl("h3", "step-title", `${number ? `${number}. ` : ""}Check before you copy`));
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
