// Browser tests for the builder UI (Playwright). Not part of `npm test` or CI because they need a
// browser: run `npm run test:e2e` where Playwright is installed (npm i -D playwright && npx playwright install chromium).
// Serves the repo itself and swaps the CDN scripts for local copies, so it also works offline.
// Screenshots go to test/e2e/out/ (git-ignored).
const http = require("http");
const fs = require("fs");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("Playwright is not installed: npm i -D playwright && npx playwright install chromium"); process.exit(2); }

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const QUILL = path.dirname(require.resolve("quill/dist/quill.js"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/plain", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const stubCdn = (ctx) => ctx.route(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/, (route) => {
  const u = route.request().url();
  if (u.includes("quill.js")) return route.fulfill({ path: path.join(QUILL, "quill.js"), contentType: "text/javascript" });
  if (u.includes("quill.snow.css")) return route.fulfill({ path: path.join(QUILL, "quill.snow.css"), contentType: "text/css" });
  return route.fulfill({ body: "", contentType: u.endsWith(".css") ? "text/css" : "text/javascript" });
});

let failures = 0;
const ok = (name, cond, extra = "") => { if (!cond) failures++; console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const BASE = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await stubCdn(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });

  // 1. no dead strip: header sits at the very top
  const top = await page.$eval("#topbar", e => e.getBoundingClientRect().top);
  ok("1 header flush with top (no 95px gap)", top === 0, "top=" + top);
  await page.evaluate(() => window.scrollTo(0, 600));
  ok("1 header still at top after scroll", (await page.$eval("#topbar", e => e.getBoundingClientRect().top)) === 0);
  await page.evaluate(() => window.scrollTo(0, 0));

  // 2. grouped, accessible tabs
  const tabs = await page.$$eval("#tabbar .tab-btn", b => b.map(x => x.textContent));
  ok("2 11 tabs", tabs.length === 11, tabs.join(" | "));
  ok("2 groups", (await page.$$eval(".tab-group-label", l => l.map(x => x.textContent))).join() === "Structure,Content,Interactive,Links");
  ok("2 roles", (await page.$eval("#tabbar .tab-btn", b => b.getAttribute("role"))) === "tab" && (await page.$eval("#panels .panel:not([hidden])", p => p.getAttribute("role"))) === "tabpanel");
  await page.focus("#tabbar .tab-btn[aria-selected=true]");
  await page.keyboard.press("ArrowRight");
  ok("2 arrow-key moves tab", (await page.$eval("#tabbar .tab-btn[aria-selected=true]", b => b.textContent)) === "At a glance");
  const tb = await page.$eval("#tabbar", e => e.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo(0, 400));
  ok("2 tab bar sticky", Math.abs((await page.$eval("#tabbar", e => e.getBoundingClientRect().top)) - (await page.$eval("#topbar", e => e.getBoundingClientRect().bottom))) < 2);
  await page.evaluate(() => window.scrollTo(0, 0));

  // 7. live output (no Generate button)
  await page.click('#tabbar .tab-btn:has-text("Section")');
  ok("7 no Generate button", (await page.$$(".generate-btn")).length === 0);
  await page.fill("#panel-section .text-field-input", "Putting into practice");
  ok("7 output live", (await page.inputValue("#out-section-html textarea")).includes('<section id="putting-into-practice">'));
  await page.click('#panel-section .output-tab:has-text("Contents entry")');
  ok("7 secondary tab", (await page.inputValue("#out-section-secondary textarea")).includes('href="#putting-into-practice"'));

  // 3. preview device toggle
  const frame = '#panel-section .live-preview';
  const w1 = await page.$eval(frame, f => f.style.width);
  await page.click('#panel-section .device-toggle button:has-text("Phone")');
  const w2 = await page.$eval(frame, f => f.style.width);
  ok("3 device widths change", w1 === "1000px" && w2 === "375px", w1 + " -> " + w2);
  const pos = await page.$eval("#panel-section .panel-side", e => getComputedStyle(e).position);
  ok("3 side panel sticky", pos === "sticky");
  await page.click('#panel-section .device-toggle button:has-text("Desktop")');

  // 6. list ergonomics on accordion
  await page.click('#tabbar .tab-btn:has-text("Accordion")');
  const rows = '#panel-accordion .bullet-row input';
  await (await page.$$(rows))[0].fill("Alpha");
  await (await page.$$(rows))[1].fill("Beta");
  await page.click('#panel-accordion .bullet-row:nth-child(1) .bullet-down');
  let vals = await page.$$eval(rows, i => i.map(x => x.value));
  ok("6 move down", vals.join() === "Beta,Alpha", vals.join());
  await page.click('#panel-accordion .bullet-add');
  await page.click('#panel-accordion .bullet-row:nth-child(3) .bullet-remove');
  ok("6 remove shows undo toast", (await page.$$(".toast-action")).length === 1);
  ok("6 removed", (await page.$$(rows)).length === 2);
  await page.click(".toast-action");
  ok("6 undo restores", (await page.$$(rows)).length === 3);
  // resource cards: duplicate + validation + empty hint
  await page.click('#tabbar .tab-btn:has-text("Resource cards")');
  const c0 = '#panel-resource-cards .item-card:nth-child(1)';
  await page.fill(c0 + " .card-title", "My resource");
  await page.fill(c0 + " .card-link-url", "not a url");
  ok("6 invalid URL message", (await page.$$(c0 + " .field-error")).length === 1);
  await page.fill(c0 + " .card-link-url", "https://example.org/x");
  ok("6 valid URL clears message", (await page.$$(c0 + " .field-error")).length === 0);
  await page.click(c0 + " .item-dup");
  const titles = await page.$$eval("#panel-resource-cards .card-title", i => i.map(x => x.value));
  ok("6 duplicate copies values", titles[0] === "My resource" && titles[1] === "My resource", titles.join());
  ok("6 empty hint on blank card", await page.$$eval("#panel-resource-cards .item-card.is-empty", c => c.length) >= 1);

  // 10. labels associated
  const unlabelled = await page.$$eval("#panel-resource-cards .item-card input[type=text]", els => els.filter(e => !document.querySelector(`label[for="${e.id}"]`)).length);
  ok("10 inputs have labels", unlabelled === 0, "unlabelled=" + unlabelled);

  // 5. autosave survives reload
  await page.click('#tabbar .tab-btn:has-text("Intro text")');
  await page.click("#panel-hero-text .ql-editor");
  await page.keyboard.type("Persisted hero");
  await page.waitForTimeout(700);
  await page.click('.theme-toggle-btn[data-theme="ytydysgu"]');
  await page.reload({ waitUntil: "networkidle" });
  ok("5 last tab restored", (await page.$eval("#tabbar .tab-btn[aria-selected=true]", b => b.textContent)) === "Intro text");
  ok("5 rich text restored", (await page.inputValue("#out-hero-text-html textarea")).includes("Persisted hero"));
  ok("5 theme restored", (await page.$eval('.theme-toggle-btn[data-theme="ytydysgu"]', b => b.getAttribute("aria-pressed"))) === "true");
  await page.click('#tabbar .tab-btn:has-text("Resource cards")');
  const t2 = await page.$$eval("#panel-resource-cards .card-title", i => i.map(x => x.value));
  ok("5 list items restored", t2[0] === "My resource" && t2.length >= 3, t2.join());
  await page.click('#tabbar .tab-btn:has-text("Accordion")');
  ok("5 reordered rows restored", (await page.$$eval("#panel-accordion .bullet-row input", i => i.map(x => x.value))).slice(0, 2).join() === "Beta,Alpha");
  // reset with undo
  await page.click("#panel-accordion .reset-btn");
  ok("5 reset clears", (await page.$$eval("#panel-accordion .bullet-row input", i => i.map(x => x.value))).every(v => v === ""));
  await page.click(".toast-action");
  ok("5 reset undo", (await page.$$eval("#panel-accordion .bullet-row input", i => i.map(x => x.value))).slice(0, 2).join() === "Beta,Alpha");
  // project save/load
  await page.click("#menu-project summary");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#save-project-btn")]);
  ok("5 project file", dl.suggestedFilename() === "gwella-project.json");
  await page.keyboard.press("Escape");

  // 9. upgrade view
  await page.click('.mode-btn[data-view="upgrade"]');
  ok("9 upgrade view visible", await page.isVisible("#view-upgrade") && !(await page.isVisible("#view-build")));
  ok("9 hash", (await page.evaluate(() => location.hash)) === "#upgrade");
  await page.fill("#view-upgrade .upgrade-input >> nth=0", '<div id="page-container" data-base-version="3.0.0"></div>');
  ok("9 detected version", (await page.textContent(".upgrade-detected")).includes("3.0.0"));
  await page.fill("#view-upgrade .upgrade-input >> nth=1", "#page-container { background-color: transparent !important; }");
  await page.click("#view-upgrade .primary-btn");
  ok("9 progress", (await page.textContent(".upgrade-progress")).trim() === "0 of 2 done");
  ok("9 finish hidden until done", !(await page.isVisible(".upgrade-finish")));
  await page.check(".change-done input >> nth=0");
  ok("9 finish still hidden with 1 of 2 done", !(await page.isVisible(".upgrade-finish")) && (await page.textContent(".upgrade-progress")).trim() === "1 of 2 done");
  await page.check(".change-done input >> nth=1");
  ok("9 finish appears when all done", await page.isVisible(".upgrade-finish"));
  await page.click('.mode-btn[data-view="changelog"]');
  ok("9 changelog view: visible, and no data warning when the changelog is valid", (await page.isVisible("#view-changelog")) && (await page.$$(".changelog-check")).length === 0);
  await page.click('.mode-btn[data-view="build"]');


  // ---- round 2 feedback ------------------------------------------------------
  // 1. changelog shows release notes only, no schema
  await page.click('.mode-btn[data-view="changelog"]');
  ok("changelog: no schema section", (await page.$$(".schema-section")).length === 0 && !(await page.textContent("#view-changelog")).includes("Changelog schema"));
  ok("changelog: release notes shown", (await page.$$("#view-changelog .release")).length >= 3);
  await page.click('.mode-btn[data-view="build"]');

  // 2. the three side-by-side blocks have distinct, descriptive names and descriptions
  const names = await page.$$eval("#tabbar .tab-btn", (b) => b.map((x) => x.textContent));
  ok("blocks: clear distinct names", ["Text around media", "Equal columns", "Media beside text"].every((n) => names.includes(n)), names.join(" | "));
  ok("blocks: no ambiguous 'Text + media' / 'Media + text'", !names.includes("Text + media") && !names.includes("Media + text"));
  await page.click('#tabbar .tab-btn:has-text("Equal columns")');
  ok("blocks: description says how it differs", /Media beside text/.test(await page.textContent("#panel-flex-section .panel-desc")));

  // 3. one focus ring: a mouse click leaves no outline; keyboard focus gets exactly one
  await page.click('#tabbar .tab-btn:has-text("Section")');
  const clicked = await page.$eval("#tabbar .tab-btn[aria-selected=true]", (b) => { const c = getComputedStyle(b); return c.outlineStyle + "/" + c.outlineWidth; });
  ok("focus: no ring after a mouse click", /^none|\/0px$/.test(clicked), clicked);
  await page.focus("#tabbar .tab-btn[aria-selected=true]");
  await page.keyboard.press("ArrowRight");
  const kb = await page.$eval("#tabbar .tab-btn[aria-selected=true]", (b) => { const c = getComputedStyle(b); return { style: c.outlineStyle, width: c.outlineWidth, shadow: c.boxShadow }; });
  ok("focus: keyboard ring is single (outline, no extra box-shadow)", kb.style === "solid" && kb.width === "3px" && kb.shadow.endsWith("inset") && !kb.shadow.includes("), "), JSON.stringify(kb));
  await page.screenshot({ path: path.join(OUT, "focus-ring.png"), clip: { x: 0, y: 60, width: 700, height: 80 } });

  // 4. preview space: wide by default, draggable, remembered, desktop vs tablet clearly different
  await page.click('#tabbar .tab-btn:has-text("Media beside text")');
  const widthOf = (sel) => page.$eval(sel, (e) => e.getBoundingClientRect().width);
  const side0 = await widthOf("#panel-two-column .panel-side");
  const form0 = await widthOf("#panel-two-column .panel-form");
  ok("preview: gets about half the width by default", side0 > 520 && Math.abs(side0 - form0) < 80, `preview ${Math.round(side0)}px, form ${Math.round(form0)}px`);
  const stageH = await page.$eval("#panel-two-column .preview-stage", (e) => e.getBoundingClientRect().height);
  ok("preview: taller than before (380px)", stageH > 450, Math.round(stageH) + "px");
  const scaleOf = () => page.$eval("#panel-two-column .live-preview", (f) => parseFloat(f.style.transform.replace("scale(", "")));
  await page.click('#panel-two-column .device-toggle button:has-text("Desktop")');
  const sDesk = await scaleOf();
  await page.click('#panel-two-column .device-toggle button:has-text("Tablet")');
  const sTab = await scaleOf();
  ok("preview: desktop and tablet are clearly different scales", sDesk > 0.5 && sTab - sDesk > 0.15, `desktop ${sDesk.toFixed(2)} vs tablet ${sTab.toFixed(2)}`);
  await page.click('#panel-two-column .device-toggle button:has-text("Desktop")');
  const hb = await (await page.$("#panel-two-column .panel-split")).boundingBox();
  await page.mouse.move(hb.x + 10, hb.y + 200);
  await page.mouse.down();
  await page.mouse.move(hb.x - 190, hb.y + 200, { steps: 6 });
  await page.mouse.up();
  const side1 = await widthOf("#panel-two-column .panel-side");
  ok("preview: dragging the divider widens it", side1 > side0 + 120, `${Math.round(side0)} -> ${Math.round(side1)}px`);
  await page.focus("#panel-two-column .panel-split");
  await page.keyboard.press("ArrowLeft");
  ok("preview: divider works from the keyboard", (await widthOf("#panel-two-column .panel-side")) > side1);
  const widthBefore = Math.round(await widthOf("#panel-two-column .panel-side"));
  await page.reload({ waitUntil: "networkidle" });
  await page.click('#tabbar .tab-btn:has-text("Media beside text")');
  const widthAfter = Math.round(await widthOf("#panel-two-column .panel-side"));
  ok("preview: width is remembered after reload", Math.abs(widthAfter - widthBefore) <= 2, `${widthBefore} -> ${widthAfter}px`);
  await page.dblclick("#panel-two-column .panel-split");
  const widthReset = await widthOf("#panel-two-column .panel-side");
  ok("preview: double-click resets", Math.abs(widthReset - side0) <= 2, Math.round(widthReset) + "px");
  await page.screenshot({ path: path.join(OUT, "ui-wide-preview.png") });

  // screenshots
  await page.click('#tabbar .tab-btn:has-text("Resource cards")');
  await page.screenshot({ path: path.join(OUT, "ui-desktop.png") });
  const mob = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await stubCdn(mob);
  const m = await mob.newPage();
  await m.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("10 no horizontal page scroll at 390px", overflow <= 0, "overflow=" + overflow);
  await m.screenshot({ path: path.join(OUT, "ui-mobile.png") });

  ok("no page errors", errors.length === 0, errors.join("; "));
  await browser.close();
  server.close();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR", e.message.split("\n")[0], "\n" + (e.stack || "").split("\n").slice(1, 4).join("\n")); server.close(); process.exit(1); });
