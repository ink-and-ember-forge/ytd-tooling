// Developer mode: the Upgrade and Validate views are tools for maintainers, so they are hidden by default.
//
// To turn it on, open the builder with  ?dev  on the end of the address, once:
//     https://<user>.github.io/<repo>/?dev
// It is remembered in this browser (under its own key, so loading a project file doesn't change it).
// To turn it off again, use the "Developer mode ✕" pill in the header, or open the builder with  ?dev=off .
const KEY = "gwella-builder:developer";

function read() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
function write(on) { try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

// Call once, before the views are built. Reads ?dev from the address, remembers it, and tidies the address.
export function initDeveloperMode() {
  const params = new URLSearchParams(location.search);
  if (params.has("dev")) {
    const value = params.get("dev").toLowerCase();
    write(!["0", "off", "false", "no"].includes(value));
    params.delete("dev");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  }
  return read();
}

export function turnOffDeveloperMode() {
  write(false);
  location.hash = "";
  location.reload();
}
