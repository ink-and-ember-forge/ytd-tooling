// The Explain tab: the block's own generated code, annotated. Hover a line and it lights
// up in the preview and says what it does; hover an attribute and it explains it and
// highlights every identical value (so "these two ids must match" is something you SEE).
// Click to pin an explanation. The X-ray toggle on the preview numbers the same parts.
//
// Works from three things: the generated HTML, the block's explain.json, and code-map.js.
import { analyse, attributeNote } from "../explain/engine.js";
import { sameValue } from "../lib/code-map.js";
import { getPref, setPref } from "./storage.js";

const norm = (v) => v.replace(/^#/, "");
const unquote = (v) => v.replace(/^(["'])(.*)\1$/s, "$2");

// Text with `code` spans -> DOM (no innerHTML, so nothing in a note can inject markup).
function richText(text) {
  const frag = document.createDocumentFragment();
  text.split("`").forEach((chunk, i) => {
    if (i % 2) { const c = document.createElement("code"); c.textContent = chunk; frag.appendChild(c); }
    else frag.appendChild(document.createTextNode(chunk));
  });
  return frag;
}

const DEFAULT_INTRO = "This is the code for your block, exactly as it will be pasted. Hover any part of it to see what it does.";

export function createExplainPanel(block, { onHighlight } = {}) {
  const explain = block.explain;
  const el = document.createElement("div");
  el.className = "explain-panel";
  el.innerHTML = `
    <div class="explain-code" tabindex="0" role="group" aria-label="Your block's code, explained. Hover or focus a part to read about it; click to pin it."></div>
    <div class="explain-card" aria-live="polite"></div>`;
  const codeEl = el.querySelector(".explain-code");
  const cardEl = el.querySelector(".explain-card");

  let analysis = null;
  let spans = [];          // token index -> list of spans
  let selected = -1;       // element index being explained
  let pinned = -1;         // element index the user clicked
  let attrHover = null;    // { name, value, count } while hovering an attribute

  // ---- code view -----------------------------------------------------------
  function buildCode() {
    codeEl.replaceChildren();
    spans = [];
    if (!analysis) {
      codeEl.textContent = "The explanation is paused while the block is mid-edit. Finish the field you are typing in.";
      return;
    }
    const { map, partOf } = analysis;
    const frag = document.createDocumentFragment();
    const stack = [];
    map.tokens.forEach((t, ti) => {
      const owner = t.type === "open" ? t.el : t.type === "close" ? t.el : stack[stack.length - 1];
      const add = (cls, text, extra = {}) => {
        const s = document.createElement("span");
        s.className = cls;
        s.textContent = text;
        if (owner !== undefined && owner >= 0) s.dataset.el = owner;
        Object.entries(extra).forEach(([k, v]) => { s.dataset[k] = v; });
        (spans[ti] ||= []).push(s);
        frag.appendChild(s);
        return s;
      };
      if (t.type === "open") {
        const part = partOf[t.el];
        if (part >= 0) {
          const b = document.createElement("span");
          b.className = "tk-badge";
          b.setAttribute("aria-hidden", "true");
          b.textContent = String(part + 1);
          b.dataset.el = t.el;
          frag.appendChild(b);
        }
        t.pieces.forEach((p) => {
          if (p.kind === "attr") add("tk-attr", p.text, { attr: p.name });
          else if (p.kind === "val") add("tk-val", p.text, { attr: p.name, val: norm(unquote(p.text)) });
          else add("tk-" + p.kind, p.text);
        });
        if (!/\/>$/.test(t.text) && map.elements[t.el].close !== null) stack.push(t.el);
      } else if (t.type === "close") {
        add("tk-punct tk-tag", t.text);
        if (stack[stack.length - 1] === t.el) stack.pop();
      } else if (t.type === "comment") add("tk-comment", t.text);
      else add("tk-text", t.text);
    });
    codeEl.appendChild(frag);
  }

  // ---- the explanation card ------------------------------------------------
  const open = { how: getPref("explainHow", true), deep: getPref("explainDeep", false) };

  function detail(key, title, text) {
    const d = document.createElement("details");
    d.className = "explain-more";
    d.open = open[key];
    const s = document.createElement("summary");
    s.textContent = title;
    d.appendChild(s);
    const p = document.createElement("p");
    p.appendChild(richText(text));
    d.appendChild(p);
    d.addEventListener("toggle", () => { open[key] = d.open; setPref(key === "how" ? "explainHow" : "explainDeep", d.open); });
    return d;
  }

  function renderCard() {
    cardEl.replaceChildren();
    if (!analysis) return;
    const { map, partOf } = analysis;
    if (selected < 0) {
      const p = document.createElement("p");
      p.className = "explain-intro";
      p.appendChild(richText(explain.intro || DEFAULT_INTRO));
      cardEl.appendChild(p);
      // legend: every part, in order, as numbered buttons
      const used = [...new Set(partOf.filter((x) => x >= 0))].sort((a, b) => a - b);
      const legend = document.createElement("div");
      legend.className = "explain-legend";
      used.forEach((pi) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "legend-item";
        b.innerHTML = `<span class="tk-badge" aria-hidden="true"></span><span class="legend-label"></span>`;
        b.querySelector(".tk-badge").textContent = String(pi + 1);
        b.querySelector(".legend-label").textContent = explain.parts[pi].label;
        b.addEventListener("click", () => pin(partOf.indexOf(pi)));
        b.addEventListener("mouseenter", () => hover(partOf.indexOf(pi)));
        b.addEventListener("mouseleave", () => hover(null));
        legend.appendChild(b);
      });
      cardEl.appendChild(legend);
      return;
    }
    const pi = partOf[selected];
    const part = explain.parts[pi];
    const e = map.elements[selected];
    const head = document.createElement("div");
    head.className = "explain-head";
    head.innerHTML = `<span class="tk-badge" aria-hidden="true"></span><strong class="explain-label"></strong><code class="explain-tag"></code>`;
    head.querySelector(".tk-badge").textContent = String(pi + 1);
    head.querySelector(".explain-label").textContent = part.label;
    head.querySelector(".explain-tag").textContent = `<${e.tag}${e.attrs.class ? ` class="${e.attrs.class.split(" ")[0]}…"` : ""}>`;
    cardEl.appendChild(head);
    const what = document.createElement("p");
    what.className = "explain-what";
    what.appendChild(richText(part.what));
    cardEl.appendChild(what);
    if (attrHover) {
      const note = attributeNote(attrHover.name, explain);
      const box = document.createElement("div");
      box.className = "explain-attr";
      const title = document.createElement("strong");
      title.textContent = attrHover.name;
      box.appendChild(title);
      if (note) { box.appendChild(document.createTextNode(": ")); box.appendChild(richText(note)); }
      if (attrHover.count > 1) {
        const same = document.createElement("div");
        same.className = "explain-same";
        same.textContent = `↔ This value appears ${attrHover.count} times (all lit up). They must match exactly.`;
        box.appendChild(same);
      }
      cardEl.appendChild(box);
    }
    if (part.how) cardEl.appendChild(detail("how", "How it's built", part.how));
    if (part.deep) cardEl.appendChild(detail("deep", "Developer detail", part.deep));
    if (pinned === selected) {
      const un = document.createElement("button");
      un.type = "button";
      un.className = "explain-unpin";
      un.textContent = "Unpin";
      un.addEventListener("click", () => pin(-1));
      cardEl.appendChild(un);
    }
  }

  // ---- selection ----------------------------------------------------------------
  function clearClasses() {
    codeEl.querySelectorAll(".is-range, .is-tag, .is-same, .is-attr").forEach((s) => s.classList.remove("is-range", "is-tag", "is-same", "is-attr"));
  }

  function paint() {
    clearClasses();
    if (!analysis || selected < 0) return;
    const { map } = analysis;
    const e = map.elements[selected];
    const from = e.open, to = e.close ?? e.open;
    for (let ti = from; ti <= to; ti++) (spans[ti] || []).forEach((s) => s.classList.add("is-range"));
    [from, to].forEach((ti) => (spans[ti] || []).forEach((s) => s.classList.add("is-tag")));
    if (attrHover) {
      const hits = sameValue(map, attrHover.value);
      hits.forEach((h) => { (spans[h.token] || []).forEach((s) => { if (s.classList.contains("tk-val") && norm(unquote(s.textContent)) === norm(attrHover.value)) s.classList.add("is-same"); }); });
      codeEl.querySelectorAll(`.tk-attr[data-attr="${CSS.escape(attrHover.name)}"][data-el="${selected}"]`).forEach((s) => s.classList.add("is-attr"));
    }
    const first = spans[from] && spans[from][0];
    if (first && pinned === selected) first.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function show(index) {
    selected = index;
    paint();
    renderCard();
    if (onHighlight) onHighlight(index >= 0 ? index : null, pinned === index && index >= 0);
  }

  // transient (hover) selection: ignored while something is pinned, except the attribute detail
  function hover(index, attr = null) {
    if (pinned >= 0 && index !== pinned) { show(pinned); return; }
    attrHover = attr;
    show(index === null ? -1 : index);
  }

  function pin(index) {
    pinned = pinned === index ? -1 : index;
    attrHover = null;
    show(pinned);
  }

  // ---- events on the code ------------------------------------------------------
  const target = (e) => {
    const attrEl = e.target.closest("[data-attr]");
    const elEl = e.target.closest("[data-el]");
    return { attrEl, index: elEl ? Number(elEl.dataset.el) : null };
  };

  codeEl.addEventListener("mouseover", (e) => {
    const { attrEl, index } = target(e);
    if (index === null) return;
    let attr = null;
    if (attrEl && attrEl.dataset.attr) {
      const valEl = attrEl.classList.contains("tk-val") ? attrEl : codeEl.querySelector(`.tk-val[data-attr="${CSS.escape(attrEl.dataset.attr)}"][data-el="${index}"]`);
      const value = valEl ? valEl.dataset.val : "";
      attr = { name: attrEl.dataset.attr, value, count: value ? sameValue(analysis.map, value).length : 0 };
    }
    hover(index, attr);
  });
  codeEl.addEventListener("mouseleave", () => hover(null));
  codeEl.addEventListener("click", (e) => {
    const { index } = target(e);
    if (index !== null) pin(index);
  });
  el.addEventListener("keydown", (e) => { if (e.key === "Escape" && pinned >= 0) { e.stopPropagation(); pin(-1); } });

  // ---- public ---------------------------------------------------------------
  return {
    el,
    // Rebuild for new HTML. Returns the model the preview's X-ray needs.
    update(html) {
      analysis = analyse(html, explain);
      if (analysis && pinned >= analysis.map.elements.length) pinned = -1;
      if (!analysis) pinned = -1;
      buildCode();
      selected = pinned;
      attrHover = null;
      paint();
      renderCard();
      return analysis ? { partOf: analysis.partOf, labels: explain.parts.map((p) => p.label) } : null;
    },
    hover: (index) => hover(index),     // from the preview's X-ray
    pin: (index) => pin(index),
  };
}
