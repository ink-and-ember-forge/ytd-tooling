// "Pop out preview": show the live preview in its own browser window (handy on a
// second screen, or to test real responsive behaviour by resizing the window).
//
// The builder keeps working as normal and sends the current preview document to the
// pop-out over a BroadcastChannel (same origin only). The pop-out page is preview.html.
import { toast } from "./toast.js";

const CHANNEL = "gwella-preview";
let channel = null;
let win = null;
let open = false;
let poll = null;
let resend = () => {}; // set by preview.js: posts the active preview's document

const listeners = new Set();
export const onPopoutChange = (fn) => listeners.add(fn);
export const isPoppedOut = () => open;
export const setResender = (fn) => { resend = fn; };

function setOpen(value) {
  if (open === value) return;
  open = value;
  if (!value) { clearInterval(poll); poll = null; win = null; }
  listeners.forEach((fn) => fn(open));
}

function ensureChannel() {
  if (channel) return channel;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e) => {
    const type = e.data && e.data.type;
    if (type === "ready") resend();          // the window finished loading: send it the current preview
    else if (type === "closed") setOpen(false);
  };
  return channel;
}

export function openPopout() {
  ensureChannel();
  win = window.open(new URL("preview.html", location.href), "gwella-preview", "popup,width=1100,height=820");
  if (!win) {
    toast("The pop-up was blocked. Allow pop-ups for this site, then try again.");
    return false;
  }
  setOpen(true);
  // Backup for browsers that don't deliver "closed" when a window is shut.
  poll = setInterval(() => { if (!win || win.closed) setOpen(false); }, 1000);
  return true;
}

export function closePopout() {
  if (win && !win.closed) win.close();
  setOpen(false);
}

// Send a preview document (no-op unless a pop-out is open).
export function postDoc(html, title) {
  if (open && channel) channel.postMessage({ type: "doc", html, title });
}
