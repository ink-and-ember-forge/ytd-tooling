// A guided tour: a dimmed page with a spotlight on one element and a card that explains it.
// Steps are plain data: { target, title, body, placement?, before? }
//   target     CSS selector, or a function returning an element (null/hidden = a centred card, no spotlight)
//   body       trusted HTML from our own tours.js (never user input)
//   placement  preferred side of the target: "right" | "left" | "bottom" | "top" (falls back to whatever fits)
//   before     optional function run when the step is reached (e.g. open the block list)
// Keys: Right/Left (or Enter) move, Esc leaves. Tab stays inside the card. Focus returns to where it was.
const GAP = 12;
const PAD = 6;

let active = null;

export function startTour(steps, { onEnd } = {}) {
  if (active) active.end();
  const returnTo = document.activeElement;
  let i = 0;

  const root = document.createElement("div");
  root.className = "tour";
  root.innerHTML = `
    <div class="tour-shield"></div>
    <div class="tour-spot" hidden></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <p class="tour-count"></p>
      <h2 class="tour-title" id="tour-title"></h2>
      <div class="tour-body"></div>
      <div class="tour-nav">
        <button type="button" class="tour-skip">Skip tour</button>
        <span class="tour-nav-end">
          <button type="button" class="tour-back">Back</button>
          <button type="button" class="primary-btn tour-next">Next</button>
        </span>
      </div>
    </div>`;
  const q = (s) => root.querySelector(s);
  const shield = q(".tour-shield"), spot = q(".tour-spot"), card = q(".tour-card");
  const next = q(".tour-next"), back = q(".tour-back");

  const resolve = (step) => {
    const el = typeof step.target === "function" ? step.target() : step.target ? document.querySelector(step.target) : null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? el : null;
  };

  function place() {
    const step = steps[i];
    const el = resolve(step);
    const vw = window.innerWidth, vh = window.innerHeight;
    shield.classList.toggle("is-dim", !el);
    spot.hidden = !el;
    card.style.maxWidth = Math.min(380, vw - 2 * GAP) + "px";
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left = (vw - cw) / 2, top = (vh - ch) / 2;
    if (el) {
      const r = el.getBoundingClientRect();
      const box = { l: r.left - PAD, t: r.top - PAD, r: r.right + PAD, b: r.bottom + PAD };
      Object.assign(spot.style, { left: box.l + "px", top: box.t + "px", width: box.r - box.l + "px", height: box.b - box.t + "px" });
      const clampX = (x) => Math.max(GAP, Math.min(x, vw - cw - GAP));
      const clampY = (y) => Math.max(GAP, Math.min(y, vh - ch - GAP));
      const fits = {
        right: vw - box.r >= cw + 2 * GAP, left: box.l >= cw + 2 * GAP,
        bottom: vh - box.b >= ch + 2 * GAP, top: box.t >= ch + 2 * GAP,
      };
      const side = [step.placement, "right", "bottom", "left", "top"].find((s) => s && fits[s]);
      if (side === "right") { left = box.r + GAP; top = clampY(box.t); }
      else if (side === "left") { left = box.l - cw - GAP; top = clampY(box.t); }
      else if (side === "bottom") { top = box.b + GAP; left = clampX(box.l); }
      else if (side === "top") { top = box.t - ch - GAP; left = clampX(box.l); }
      else { left = vw - cw - GAP; top = vh - ch - GAP; } // the target fills the window: sit in the corner, over it
    }
    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";
  }

  function show() {
    const step = steps[i];
    if (step.before) step.before();
    const el = resolve(step);
    if (el) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    q(".tour-count").textContent = `Step ${i + 1} of ${steps.length}`;
    q(".tour-title").textContent = step.title;
    q(".tour-body").innerHTML = step.body;
    back.hidden = i === 0;
    next.textContent = i === steps.length - 1 ? "Done" : "Next";
    root.dataset.step = String(i);
    place();
    next.focus();
  }

  const go = (d) => {
    const n = i + d;
    if (n >= steps.length) return end();
    if (n >= 0) { i = n; show(); }
  };

  function end() {
    if (active !== api) return;
    active = null;
    window.removeEventListener("resize", place);
    document.removeEventListener("scroll", place, true);
    document.removeEventListener("keydown", onKey, true);
    root.remove();
    if (returnTo && returnTo.isConnected && returnTo.focus) returnTo.focus();
    if (onEnd) onEnd();
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "Tab") { // keep focus on the card's buttons
      const btns = Array.from(card.querySelectorAll("button")).filter((b) => !b.hidden);
      const at = btns.indexOf(document.activeElement);
      if (at === -1 || (e.shiftKey && at === 0) || (!e.shiftKey && at === btns.length - 1)) {
        e.preventDefault();
        btns[e.shiftKey ? btns.length - 1 : 0].focus();
      }
    }
  }

  next.addEventListener("click", () => go(1));
  back.addEventListener("click", () => go(-1));
  q(".tour-skip").addEventListener("click", end);
  window.addEventListener("resize", place);
  document.addEventListener("scroll", place, true);
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(root);

  const api = { end };
  active = api;
  show();
  return api;
}

export const tourIsRunning = () => !!active;
