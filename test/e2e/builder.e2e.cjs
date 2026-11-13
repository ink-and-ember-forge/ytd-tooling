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

// A 1x1 transparent PNG, standing in for any image address typed into the forms (example.org).
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const stubCdn = (ctx) => ctx.route(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|example\.org/, (route) => {
  const u = route.request().url();
  if (u.includes("example.org")) return route.fulfill({ body: PIXEL, contentType: "image/png" });
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
  // workbench: the block list is a left rail under the header, and the page itself never scrolls
  const rail = await page.$eval("#tabbar", (e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; });
  const hdr = await page.$eval("#topbar", (e) => e.getBoundingClientRect().bottom);
  ok("2 block list is a left rail under the header", rail.left === 0 && Math.abs(rail.top - hdr) < 2 && rail.w > 150 && rail.w < 260, JSON.stringify(rail));
  ok("2 the page itself does not scroll (panes scroll on their own)", await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1));
  ok("2 header is a single slim row", (await page.$eval("#topbar", (e) => e.offsetHeight)) < 70, (await page.$eval("#topbar", (e) => e.offsetHeight)) + "px");

  // 7. live output (no Generate button)
  await page.click('#tabbar .tab-btn:has-text("Section")');
  ok("7 no Generate button", (await page.$$(".generate-btn")).length === 0);
  await page.fill("#panel-section .text-field-input", "Putting into practice");
  ok("7 output live", (await page.inputValue("#out-section-html textarea")).includes('<section id="putting-into-practice">'));
  await page.click('#panel-section .output-tab:has-text("Contents entry")');
  ok("7 secondary tab", (await page.inputValue("#out-section-secondary textarea")).includes('href="#putting-into-practice"'));

  // the Section checkbox: ticking it adds the class live, un-ticking removes it, and it survives a reload
  await page.click('#panel-section .output-tab:has-text("HTML")');
  ok("section: tight-heading is off by default", !(await page.inputValue("#out-section-html textarea")).includes("tight-heading"));
  await page.check("#panel-section .checkbox-field-input");
  ok("section: ticking the box adds class=\"tight-heading\" to the H2", (await page.inputValue("#out-section-html textarea")).includes('<h2 class="tight-heading">'));
  ok("section: the secondary (contents entry) output is unaffected", !(await page.inputValue("#out-section-secondary textarea")).includes("tight-heading"));
  await page.waitForTimeout(600); // autosave is debounced (400ms)
  await page.reload({ waitUntil: "networkidle" });
  await page.click('#tabbar .tab-btn:has-text("Section")');
  ok("section: the ticked box is remembered after a reload (autosave)", await page.isChecked("#panel-section .checkbox-field-input"));
  await page.uncheck("#panel-section .checkbox-field-input");
  ok("section: un-ticking removes the class", !(await page.inputValue("#out-section-html textarea")).includes("tight-heading"));

  // 3. preview device toggle
  const frame = '#panel-section .live-preview';
  const w1 = await page.$eval(frame, f => f.style.width);
  await page.click('#panel-section .device-toggle button:has-text("Phone")');
  const w2 = await page.$eval(frame, f => f.style.width);
  ok("3 device widths change", w1 === "1000px" && w2 === "375px", w1 + " -> " + w2);
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

  // 9. upgrade view: paste a real 3.1.1 page, check it, and get the upgraded code back
  const CURRENT = require("../../changelog/changelog.json").releases[0].version;
  const base311 = (f) => fs.readFileSync(path.join(ROOT, "baseline", "3.1.1", f), "utf8").replace(/\n$/, "");
  const baseCss = base311("base.css");
  const markerStart = baseCss.lastIndexOf("\n  /* ====", baseCss.indexOf("PLACE NEW BLOCK CSS ABOVE THIS LINE"));
  const css311 = baseCss.slice(0, markerStart) + "\n\n" + base311("blocks/accordion.css") + "\n\n" + base311("blocks/at-a-glance.css") + baseCss.slice(markerStart);
  const ownCss = css311.replace("color: var(--primary-colour);\n    line-height: 120%", "color: #123456;\n    line-height: 120%");
  const oldHtml = base311("base.html").replace("__THEME__", "gwella") + '\n<div id="at-a-glance"><h3 id="at-a-glance-heading">At a glance</h3></div>\n<div class="accordion" id="accordion-x"></div>';
  const oldJs = "<script>\n" + base311("base.js") + '\nconsole.log("mine");\n</script>';
  const fillOld = async (html = oldHtml) => {
    await page.fill("#view-upgrade .upgrade-input >> nth=0", html);
    await page.fill("#view-upgrade .upgrade-input >> nth=1", "<style>\n" + ownCss + "\n</style>");
    await page.fill("#view-upgrade .upgrade-input >> nth=2", oldJs);
  };
  const code = (name) => page.inputValue(`#view-upgrade textarea[aria-label="${name} code"]`);

  await page.click('.mode-btn[data-view="upgrade"]');
  ok("9 upgrade view visible", await page.isVisible("#view-upgrade") && !(await page.isVisible("#view-build")));
  ok("9 hash", (await page.evaluate(() => location.hash)) === "#upgrade");
  ok("9 nothing to show before the page is checked", !(await page.isVisible("#view-upgrade .upgrade-results")));
  await fillOld();
  ok("9 detected version", (await page.textContent(".upgrade-detected")).includes("3.1.1"));
  await page.click("#view-upgrade .primary-btn");
  await page.waitForSelector("#view-upgrade .upgrade-results", { state: "visible" });
  ok("9 every section is actually visible to the author, not only present in the page", await page.isVisible("#view-upgrade .upgrade-block") && await page.isVisible("#view-upgrade .upgrade-tweaks") && await page.isVisible("#view-upgrade .upgrade-checks") && await page.isVisible('#view-upgrade textarea[aria-label="CSS code"]', { timeout: 500 }).then((v) => !v), "section 2, 3 and 5 visible; code stays behind its disclosure");
  ok("9 says which version it was built on", (await page.textContent("#view-upgrade .upgrade-message")).includes("built on version 3.1.1"));
  const ticked = await page.$$eval("#view-upgrade .upgrade-block", (l) => l.filter((x) => x.querySelector("input").checked).map((x) => x.textContent.replace(/found/i, "").trim()));
  ok("9 found exactly the blocks on the page", ticked.sort().join() === "Accordion,At-a-glance", ticked.join());
  ok("9 one tweak found, and nothing is kept until it is ticked", (await page.textContent("#view-upgrade .upgrade-tweaks")).includes("#123456") && !(await page.isChecked("#view-upgrade .upgrade-tweak input")));
  ok("9 warns that the unticked tweak would be lost", (await page.textContent(".upgrade-tweak-warning")).includes("1 tweak won't be in the new CSS"));
  ok("9 the upgraded CSS has no trace of it yet", !(await code("CSS")).includes("#123456") && !(await code("CSS")).includes("PAGE-SPECIFIC"));
  await page.check("#view-upgrade .upgrade-tweak input");
  ok("9 ticking keeps the tweak, in a labelled block", (await code("CSS")).includes("PAGE-SPECIFIC OVERRIDES") && (await code("CSS")).includes("#123456"));
  ok("9 the warning goes away", !(await page.isVisible(".upgrade-tweak-warning")));
  ok("9 focus stays on the box you ticked", await page.evaluate(() => document.activeElement.closest(".upgrade-tweaks") !== null));
  ok("9 the CSS holds only the page's blocks", !(await code("CSS")).includes(".nav-cards-grid") && (await code("CSS")).includes(".accordion {"));
  await page.uncheck('#view-upgrade .upgrade-block:has-text("Accordion") input');
  ok("9 unticking a block takes its CSS out", !(await code("CSS")).includes(".accordion {"));
  await page.check('#view-upgrade .upgrade-block:has-text("Accordion") input');
  ok("9 and ticking it puts it back", (await code("CSS")).includes(".accordion {"));
  ok("9 HTML: only the version marker changed", (await code("HTML")).includes(`data-base-version="${CURRENT}"`) && !(await code("HTML")).includes('data-base-version="3.1.1"'));
  ok("9 shows what is changing", (await page.textContent("#view-upgrade")).includes("Looks different") && (await page.$$("#view-upgrade .change-card")).length >= 4);
  ok("9 shows the author's own JS line, and does not merge it", (await page.textContent("#view-upgrade .upgrade-diff")).includes('console.log("mine");') && !(await code("JS")).includes('console.log("mine")'));
  ok("9 self-check passes", (await page.textContent(".upgrade-check")).includes("Every change made since your version is in the new code"));

  // no version marker: the error comes with the closest versions, and one click carries on
  await fillOld(oldHtml.replace(/ data-base-version="[\d.]+"/, ""));
  await page.click("#view-upgrade .primary-btn");
  await page.waitForSelector("#view-upgrade .upgrade-suggest");
  ok("9 no marker: asks which version", (await page.textContent("#view-upgrade .upgrade-message")).includes("version"));
  await page.click('#view-upgrade .upgrade-suggest button:has-text("Use 3.1.1")');
  await page.waitForFunction(() => document.querySelector("#view-upgrade .upgrade-message")?.textContent.includes("built on version 3.1.1"));
  ok("9 the suggested version carries on", (await code("HTML")).includes(`data-base-version="${CURRENT}"`));

  // a page that is already current needs nothing
  await fillOld(oldHtml.replace('data-base-version="3.1.1"', `data-base-version="${CURRENT}"`));
  await page.click("#view-upgrade .upgrade-version-details summary");
  await page.selectOption("#view-upgrade .upgrade-version", "auto");
  await page.waitForFunction(() => document.querySelector("#view-upgrade .upgrade-message")?.textContent.includes("already at version"));
  ok("9 already current: nothing to copy", !(await page.isVisible("#view-upgrade textarea[aria-label='CSS code']")));

  // 9b. a page built before 3.1.0 is migrated, not upgraded (a real legacy page: flat CSS, --burgundy, no marker)
  const L = (f) => fs.readFileSync(path.join(ROOT, "test", "fixtures", "legacy", f), "utf8");
  await page.fill("#view-upgrade .upgrade-input >> nth=0", L("page.html"));
  await page.fill("#view-upgrade .upgrade-input >> nth=1", L("page.css"));
  await page.fill("#view-upgrade .upgrade-input >> nth=2", L("page.js"));
  await page.click("#view-upgrade .primary-btn");
  await page.waitForSelector("#view-upgrade .upgrade-signals", { state: "visible" });
  ok("9b says why it is a migration", (await page.$$("#view-upgrade .upgrade-signals li")).length === 4);
  ok("9b every section is visible", await page.isVisible("#view-upgrade .upgrade-signals") && await page.isVisible("#view-upgrade .upgrade-theme") && await page.isVisible("#view-upgrade .upgrade-checks"));
  const groups = await page.$$eval("#view-upgrade .upgrade-custom .upgrade-tweak", (l) => l.map((x) => ({ name: x.querySelector("strong").textContent, kept: x.querySelector("input").checked })));
  ok("9b the page's own styles are 12 groups, all kept by default", groups.length === 12 && groups.every((g) => g.kept), groups.map((g) => g.name).join(","));
  const progress1 = await page.textContent("#view-upgrade .upgrade-review-progress");
  ok("9b the 18 differences from the template are 5 groups, not 18 checkboxes", /Group 1 of 5/.test(progress1), progress1);
  ok("9b the template is already chosen, and each decision says what it affects", await page.isChecked('#view-upgrade .upgrade-review-choice input[value="template"] >> nth=0') && (await page.textContent("#view-upgrade .upgrade-review-headline")).includes("affect"));
  ok("9b every rule in the group has its own choice, hint and element count", (await page.$$("#view-upgrade .upgrade-review-row")).length > 1 && (await page.$$eval("#view-upgrade .upgrade-review-row", (l) => l.every((x) => x.querySelector(".upgrade-review-hint")?.textContent.length > 20 && x.querySelector('input[value="keep"]')))));
  ok("9b copying is locked until the review is finished, and says why", await page.isDisabled('#view-upgrade button:has-text("Copy CSS")') && (await page.textContent("#view-upgrade .upgrade-results")).includes("Finish the review in step 4 first (5 groups left)"));
  ok("9b the theme is detected from the old colour", await page.isChecked('#view-upgrade .upgrade-theme input[value="gwella"]') && (await page.textContent("#view-upgrade .upgrade-theme")).includes("detected"));
  ok("9b two HTML changes are shown with before and after", (await page.$$("#view-upgrade .upgrade-html-changes .upgrade-output")).length === 2);
  const region = (await code("CSS")).slice((await code("CSS")).indexOf("PAGE-SPECIFIC OVERRIDES"));
  ok("9b the carried styles are in the labelled block, with old tokens renamed", region.includes(".cta-button") && region.includes("var(--primary-colour)") && !/--burgundy|#a3195b/i.test(region));
  ok("9b the HTML gets the theme class and the standard back-to-top icon", (await code("HTML")).includes('class="gwella"') && (await code("HTML")).includes("fa-circle-chevron-up") && !(await code("HTML")).includes("back-to-top.png"));
  const checks = await page.textContent("#view-upgrade .upgrade-checks");
  ok("9b checks: every class styled, the undefined --buttons and the broken tags are reported", checks.includes("Every class in your HTML has styling") && checks.includes("--buttons") && checks.includes("never closed"));

  // the page really looks the same before and after: compare computed styles inside the real frames
  await page.click("#view-upgrade .upgrade-preview summary");
  const frameOf = async () => { const el = await page.waitForSelector("#view-upgrade .upgrade-stage .upgrade-frame"); return el.contentFrame(); };
  const styles = (frame) => frame.evaluate(() => {
    const pick = (sel, props) => { const e = document.querySelector(sel); if (!e) return null; const c = getComputedStyle(e); return Object.fromEntries(props.map((p) => [p, c[p]])); };
    return {
      cta: pick(".cta-button", ["backgroundColor", "borderRadius", "display", "color"]),
      journey: pick(".journey-section", ["display", "gap"]),
      info: pick(".info-section", ["display", "gap", "marginBottom"]),
      link: pick(".burgundy-link", ["color"]),
      icon: !!document.querySelector(".back-to-top i.fa-circle-chevron-up"),
    };
  });
  await page.click('#view-upgrade .upgrade-seg-btn:has-text("Before")');
  await page.waitForTimeout(400);
  const stylesBefore = await styles(await frameOf());
  await page.click('#view-upgrade .upgrade-seg-btn:has-text("After")');
  await page.waitForTimeout(400);
  const stylesAfter = await styles(await frameOf());
  ok("9b the call-to-action button looks the same after migrating", JSON.stringify(stylesBefore.cta) === JSON.stringify(stylesAfter.cta) && stylesAfter.cta.backgroundColor === "rgb(163, 25, 91)", JSON.stringify(stylesAfter.cta));
  ok("9b the journey and info sections keep their layout", JSON.stringify(stylesBefore.journey) === JSON.stringify(stylesAfter.journey) && stylesAfter.journey.display === "flex" && JSON.stringify(stylesBefore.info) === JSON.stringify(stylesAfter.info), JSON.stringify(stylesAfter.journey));
  ok("9b the custom link keeps the theme colour", stylesBefore.link.color === stylesAfter.link.color && stylesAfter.link.color === "rgb(163, 25, 91)");
  ok("9b the back-to-top icon is now the standard one", stylesAfter.icon === true && stylesBefore.icon === false);
  await page.click('#view-upgrade .upgrade-seg-btn:has-text("Phone")');
  await page.waitForTimeout(400);
  const phone = await (await frameOf()).evaluate(() => ({ desktop: getComputedStyle(document.querySelector(".desktop-image")).display, mobile: getComputedStyle(document.querySelector(".mobile-image")).display }));
  ok("9b the phone layout carries over (mobile image shown, desktop image hidden)", phone.desktop === "none" && phone.mobile === "block", JSON.stringify(phone));
  await page.click('#view-upgrade .upgrade-seg-btn:has-text("Desktop")');

  // untick a group: the check names exactly what lost its styling; tick it again to restore
  await page.uncheck('#view-upgrade .upgrade-tweak:has(strong:text-is("cta-button")) input');
  ok("9b unticking a group is reported as unstyled", (await page.textContent("#view-upgrade .upgrade-checks")).includes(".cta-button") && !(await code("CSS")).includes(".cta-button"));
  await page.check('#view-upgrade .upgrade-tweak:has(strong:text-is("cta-button")) input');
  ok("9b and ticking it again restores it", (await code("CSS")).includes(".cta-button") && (await page.textContent("#view-upgrade .upgrade-checks")).includes("Every class in your HTML has styling"));

  // choose the other theme: the class, and the colours in the open frame, follow
  await page.check('#view-upgrade .upgrade-theme input[value="ytydysgu"]');
  await page.waitForTimeout(500);
  ok("9b choosing Y Tŷ Dysgu changes the theme class", (await code("HTML")).includes('class="ytydysgu"') && !(await code("HTML")).includes('class="gwella"'));
  ok("9b and the colours in the preview", (await styles(await frameOf())).cta.backgroundColor === "rgb(50, 80, 131)");
  await page.check('#view-upgrade .upgrade-theme input[value="gwella"]');

  // the way back to the normal flow
  await page.click('#view-upgrade button:has-text("Treat it as a normal upgrade instead")');
  await page.waitForFunction(() => document.querySelector("#view-upgrade .upgrade-message")?.textContent.includes("version marker"));
  ok("9b the author can choose the normal upgrade flow instead", !(await page.isVisible("#view-upgrade .upgrade-theme")));

  // 9c. a second real page: the template's own blocks plus many deliberate overrides of the standard. The goal is to conform to the
  // template, so each difference is a decision (the template chosen) with the page shown both ways; keeping one needs a reason.
  const L2 = (f) => fs.readFileSync(path.join(ROOT, "test", "fixtures", "legacy2", f), "utf8");
  await page.fill("#view-upgrade .upgrade-input >> nth=0", L2("page.html"));
  await page.fill("#view-upgrade .upgrade-input >> nth=1", L2("page.css"));
  await page.fill("#view-upgrade .upgrade-input >> nth=2", L2("page.js"));
  await page.click("#view-upgrade .primary-btn");
  await page.waitForSelector("#view-upgrade .upgrade-review-card", { state: "visible" });
  // The preview frames used to call scrollIntoView, which also scrolls the PARENT page: it jumped ~2600px by itself when they loaded.
  const y0 = await page.evaluate(() => Math.round(scrollY));
  await page.waitForTimeout(1500);
  const y1 = await page.evaluate(() => Math.round(scrollY));
  ok("9c the page does not move by itself when the preview frames load", y0 === y1 && y1 < 1200, `${y0} -> ${y1}`);
  const custom2 = await page.$$eval("#view-upgrade .upgrade-custom .upgrade-tweak strong", (l) => l.map((x) => x.textContent));
  ok("9c the page's own components are carried", custom2.join() === "inline-icon,accordion-text,resource-card-grid,resource-card", custom2.join());
  ok("9c the 21 differences are 5 groups", /Group 1 of 5/.test(await page.textContent("#view-upgrade .upgrade-review-progress")));
  ok("9c nothing is kept yet, and copying is locked", !(await code("CSS")).includes("kept:") && await page.isDisabled('#view-upgrade button:has-text("Copy HTML")'));

  // the first decision, before choosing: the template and yours side by side, the affected elements outlined
  const firstTitle = await page.textContent("#view-upgrade .upgrade-review-title");
  const weights = [];
  for (const nth of [0, 1]) {
    const el = await (await page.$$("#view-upgrade .upgrade-compare .upgrade-frame"))[nth];
    const f = await el.contentFrame();
    await page.waitForTimeout(300);
    weights.push(await f.evaluate(() => ({ strong: getComputedStyle(document.querySelector(".accordion-text strong")).fontWeight, crumb: getComputedStyle(document.querySelector("#breadcrumb-nav__list")).listStyleType, outlined: document.querySelectorAll(".__hl").length })));
  }
  ok("9c the first decision (Text and headings) shows the page both ways, with what it affects outlined", firstTitle === "Text and headings" && weights[0].strong !== weights[1].strong && weights[0].outlined > 0 && weights[1].outlined > 0, JSON.stringify(weights));
  ok("9c and it never numbers the breadcrumb: the list rule that does is decided with its fix, not here", weights.every((w) => w.crumb === "none"), JSON.stringify(weights.map((w) => w.crumb)));
  ok("9c and says what it changes in plain words, and what the template does", (await page.textContent("#view-upgrade .upgrade-review-rows")).includes("text weight") && (await page.textContent("#view-upgrade .upgrade-review-rows")).includes("template"));

  // keeping one needs a reason, and is decided PER RULE: Next stays disabled until each kept rule has one
  const R = (label) => `#view-upgrade .upgrade-review-row:has(.upgrade-review-row-label:text-is("${label}"))`;
  const NEXT = '#view-upgrade button:has-text("Next group")';
  ok("9c no rule's reason box is showing until it is kept", !(await page.isVisible("#view-upgrade .upgrade-review-row .upgrade-reason")));
  await page.check(`${R("strong")} input[value="keep"]`);
  ok("9c keeping one rule asks why for that rule only, and will not go on without an answer", await page.isVisible(`${R("strong")} .upgrade-reason`) && !(await page.isVisible(`${R("h5")} .upgrade-reason`)) && await page.isDisabled(NEXT));
  await page.selectOption(`${R("strong")} .upgrade-reason`, "design");
  await page.fill(`${R("strong")} .upgrade-note`, "bold is our house style");
  const css1 = await code("CSS");
  ok("9c once it has a reason it can go on, and the reason is written into the CSS against that rule", !(await page.isDisabled(NEXT)) && css1.includes("/* kept: Text and headings \u203a strong: A deliberate design choice, bold is our house style */"));
  ok("9c the rule next to it still follows the template", await page.isChecked(`${R("h5")} input[value="template"]`) && !css1.includes("Text and headings \u203a h5"));
  await page.click(`${R("strong")} button:has-text("Show just this one")`);
  const justWeights = [];
  for (const nth of [0, 1]) {
    await page.waitForTimeout(400);
    const f = await (await (await page.$$("#view-upgrade .upgrade-compare .upgrade-frame"))[nth]).contentFrame();
    justWeights.push(await f.evaluate(() => ({ strong: getComputedStyle(document.querySelector(".accordion-text strong")).fontWeight, h5: getComputedStyle(document.querySelector("h5")).fontWeight, outlined: document.querySelectorAll(".__hl").length })));
  }
  ok("9c 'show just this one' previews that rule alone, outlining only what it touches", justWeights[0].strong !== justWeights[1].strong && justWeights[0].h5 === justWeights[1].h5 && justWeights[1].outlined > 0, JSON.stringify(justWeights));
  await page.check(`${R("strong")} input[value="template"]`);
  ok("9c going back to the template takes it out again", !(await code("CSS")).includes("kept:") && !(await page.isVisible(`${R("strong")} .upgrade-reason`)) && !(await page.isDisabled(NEXT)));
  // the group shortcuts: keep all, one reason for all, template for all
  await page.click('#view-upgrade button:has-text("Keep all of mine")');
  ok("9c 'keep all of mine' keeps every rule in the group, and each still needs a reason", (await page.$$eval("#view-upgrade .upgrade-review-row", (l) => l.every((x) => x.querySelector('input[value="keep"]').checked))) && await page.isDisabled(NEXT));
  await page.selectOption("#view-upgrade .upgrade-review-shortcuts select", "design");
  ok("9c one reason can be given to every kept rule at once", !(await page.isDisabled(NEXT)) && (await code("CSS")).includes("Text and headings \u203a h5: A deliberate design choice"));
  await page.click('#view-upgrade button:has-text("Use the template for all of these")');
  ok("9c and 'use the template for all of these' takes them all out", !(await code("CSS")).includes("kept:") && !(await page.isDisabled(NEXT)));

  // moving between decisions: the new card's top (number, title, headline) is brought just below the sticky header, and stays there
  const cardTop = () => page.evaluate(() => Math.round(document.querySelector(".upgrade-review-card").getBoundingClientRect().top));
  await page.evaluate(() => document.querySelector("#view-upgrade .upgrade-review-nav").scrollIntoView({ block: "end" }));
  await page.click('#view-upgrade button:has-text("Next group")');
  await page.waitForTimeout(1200);
  const afterNext = await cardTop();
  await page.waitForTimeout(800);
  ok("9c Next brings the new decision's top into view, just below the header, and it stays put", afterNext >= 60 && afterNext <= 120 && afterNext === (await cardTop()), `top at ${afterNext}px`);
  ok("9c and moves focus to its title for screen readers", await page.evaluate(() => document.activeElement?.classList.contains("upgrade-review-title")));
  await page.click('#view-upgrade .upgrade-review-nav button:has-text("Back")');
  await page.waitForTimeout(800);
  const afterBack = await cardTop();
  ok("9c Back does the same", afterBack >= 60 && afterBack <= 120 && (await page.textContent("#view-upgrade .upgrade-review-progress")).includes("Group 1 of 5"), `top at ${afterBack}px`);

  // decide everything: the template (the default) for every decision, noting the titles on the way
  const decideAll = async (choice, collect = null) => {
    if (await page.isVisible("#view-upgrade .upgrade-review-summary")) await page.click('#view-upgrade .upgrade-review-summary button:has-text("Change") >> nth=0');
    for (;;) {
      if (collect) collect.push(await page.textContent("#view-upgrade .upgrade-review-title"));
      for (const row of await page.$$("#view-upgrade .upgrade-review-row")) {
        await (await row.$(`input[value="${choice}"]`)).check();
        if (choice === "keep") await (await row.$(".upgrade-reason")).selectOption("design");
      }
      const last = await page.isVisible('#view-upgrade button:has-text("Finish the review")');
      await page.click(last ? '#view-upgrade button:has-text("Finish the review")' : '#view-upgrade button:has-text("Next group")');
      if (last) break;
    }
  };
  const decisionTitles = [];
  await decideAll("template", decisionTitles);
  ok("9c the five groups, biggest first", decisionTitles.join(" | ") === "Text and headings | Fixes that use !important | Your phone and tablet layout | Rules that work together: list markers and spacing inside (left) | Page header, contents list and layout", decisionTitles.join(" | "));
  ok("9c using the template for all of them says so, and unlocks copying", (await page.textContent("#view-upgrade .upgrade-review-summary")).includes("Your page will follow the template") && !(await page.isDisabled('#view-upgrade button:has-text("Copy CSS")')));
  await page.click('#view-upgrade .upgrade-review-summary button:has-text("Change") >> nth=3');
  const linkedTitle = await page.textContent("#view-upgrade .upgrade-review-title");
  const linkedWhy = await page.textContent("#view-upgrade .upgrade-review-card");
  ok("9c the linked rules are a single row, so they cannot be split", (await page.$$("#view-upgrade .upgrade-review-row")).length === 1);
  const crumbs = [];
  for (const nth of [0, 1]) {
    const f = await (await (await page.$$("#view-upgrade .upgrade-compare .upgrade-frame"))[nth]).contentFrame();
    await page.waitForTimeout(300);
    crumbs.push(await f.evaluate(() => ({ crumb: getComputedStyle(document.querySelector("#breadcrumb-nav__list")).listStyleType, numbered: getComputedStyle(document.querySelector("section#understand-vision ol, section#culture ol")).listStyleType })));
  }
  ok("9c rules that depend on each other are one row with one choice, and it says why", linkedTitle.startsWith("Rules that work together") && linkedWhy.includes("both set list markers") && linkedWhy.includes("decided together"), linkedTitle);
  ok("9c kept together, the breadcrumb stays un-numbered and the page's own numbered list stays numbered", crumbs[1].crumb === "none" && crumbs[1].numbered === "decimal", JSON.stringify(crumbs));
  await page.check('#view-upgrade .upgrade-review-choice input[value="template"]');
  await page.click(NEXT);
  await page.click('#view-upgrade button:has-text("Finish the review")');
  ok("9c checks: nothing lost, and the class that was never styled is said to be exactly that", await (async () => { const c = await page.textContent("#view-upgrade .upgrade-checks"); return c.includes("Every class in your HTML has styling") && c.includes(".number-text") && c.includes("nothing was lost") && !c.includes("stretched-link"); })());

  await page.click("#view-upgrade .upgrade-preview summary");
  const frame2 = async () => { const el = await page.waitForSelector("#view-upgrade .upgrade-stage .upgrade-frame"); return el.contentFrame(); };
  const probe = (frame) => frame.evaluate(() => {
    const cs = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };
    return {
      strong: cs(".accordion-text strong").fontWeight, h4: cs("h4.number-text").fontWeight, h1Margin: cs("#header-h1").marginBottom,
      h5: cs("section#culture > h5").color, glanceHeading: cs("#at-a-glance-heading").color,
      h3: cs("section#culture > h3").color, tocItemBorder: cs("#table-of-contents li").borderTopWidth,
      card: { radius: cs(".resource-card").borderTopLeftRadius, grid: cs(".resource-card-grid").display }, icon: cs(".inline-icon").width,
    };
  });
  await page.click('#view-upgrade .upgrade-seg-btn:has-text("Before")');
  await page.waitForTimeout(400);
  const was = await probe(await frame2());
  await page.click('#view-upgrade .upgrade-seg-btn:has-text("After")');
  await page.waitForTimeout(400);
  const conformed = await probe(await frame2());
  ok("9c following the template changes what the page overrode (bold weight, heading weights, header margin)", conformed.strong !== was.strong && conformed.h4 !== was.h4 && conformed.h1Margin !== was.h1Margin, JSON.stringify({ was: [was.strong, was.h4, was.h1Margin], now: [conformed.strong, conformed.h4, conformed.h1Margin] }));
  ok("9c and the older resource cards and inline icons, which are the page's own components, are untouched", JSON.stringify(conformed.card) === JSON.stringify(was.card) && conformed.icon === was.icon);

  // now keep every override, each with a reason: the page looks exactly as the author built it
  await decideAll("keep");
  await page.waitForTimeout(500);
  const kept = await probe(await frame2());
  ok("9c keeping every override brings the author's own look back exactly", kept.strong === was.strong && kept.h4 === was.h4 && kept.h1Margin === was.h1Margin && kept.h5 === was.h5 && kept.glanceHeading === was.glanceHeading,
    JSON.stringify({ was: [was.strong, was.h4, was.h1Margin, was.h5, was.glanceHeading], now: [kept.strong, kept.h4, kept.h1Margin, kept.h5, kept.glanceHeading] }));
  ok("9c and the template's own changes are adopted either way (black sub-headings, bordered contents items)", was.h3 === "rgb(163, 25, 91)" && kept.h3 === "rgb(0, 0, 0)" && was.tocItemBorder === "0px" && kept.tocItemBorder === "1px");
  const css2 = await code("CSS");
  ok("9c every kept rule has its reason in the CSS, under its group and its own name", ["Text and headings", "Fixes that use !important", "Your phone and tablet layout", "Rules that work together: list markers and spacing inside (left)", "Page header, contents list and layout"].every((t) => new RegExp(`/\\* kept: ${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \u203a [^*]*?: A deliberate design choice(, [^*]*)? \\*/`).test(css2)) && css2.includes("bold is our house style"), css2.split("\n").filter((l) => l.includes("kept:")).join(" ~ "));
  ok("9c and the summary lists what was kept", (await page.textContent("#view-upgrade .upgrade-review-summary")).includes("You're keeping 20 rules of your own"));

  // the final report: what was decided and why, to keep
  ok("9c the report appears once the review is finished, and says what was kept", await page.isVisible("#view-upgrade .upgrade-report-summary") && (await page.textContent("#view-upgrade .upgrade-report-summary")).includes("Kept as your own: 20. Following the template: 0."));
  const reportCards = await page.$$eval("#view-upgrade .upgrade-report-kept", (l) => l.map((x) => x.textContent));
  ok("9c every kept rule is in the report with its reason and note", reportCards.length === 20 && reportCards.every((t) => t.includes("Why: A deliberate design choice")) && reportCards.some((t) => t.includes("bold is our house style")), reportCards.length + " cards");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click('#view-upgrade button:has-text("Download report")')]);
  const reportText = fs.readFileSync(await download.path(), "utf8");
  ok("9c the downloaded report is a Markdown file a person can keep", download.suggestedFilename() === "migration-report.md" && reportText.startsWith("# Migration report") && reportText.includes("## Kept as your own (20)") && reportText.includes("- **Why:** A deliberate design choice. bold is our house style") && reportText.includes("strong — text weight: yours `bold`, template `not set`") && reportText.includes("## Still worth a look"), reportText.slice(0, 80));

  // change one group afterwards: back to the template for the first
  await page.click('#view-upgrade .upgrade-review-summary button:has-text("Change") >> nth=0');
  await page.click('#view-upgrade button:has-text("Use the template for all of these")');
  await page.waitForTimeout(500);
  ok("9c changing one group takes only that one out", !(await code("CSS")).includes("kept: Text and headings") && (await code("CSS")).includes("kept: Your phone and tablet layout") && (await probe(await frame2())).strong !== was.strong);
  await page.click(NEXT);
  await decideAll("template"); // finish again, so the page is in a settled state for what follows


  // 9d. a third real page with an OLDER icon toggle (<div id="data-icons-grid">, onclick="openAccordion(...)" tiles, none of the
  // current block's classes). It must still WORK, not only look right: recognised by class alone it was missed, the standard JS
  // left out openAccordion, and every tile threw "openAccordion is not defined".
  const L3 = (f) => fs.readFileSync(path.join(ROOT, "test", "fixtures", "legacy3", f), "utf8");
  await page.fill("#view-upgrade .upgrade-input >> nth=0", L3("page.html"));
  await page.fill("#view-upgrade .upgrade-input >> nth=1", L3("page.css"));
  await page.fill("#view-upgrade .upgrade-input >> nth=2", L3("page.js"));
  await page.click("#view-upgrade .primary-btn");
  await page.waitForSelector("#view-upgrade .upgrade-checks", { state: "visible" });
  const checks3 = await page.textContent("#view-upgrade .upgrade-checks");
  ok("9d checks: every function the HTML calls is defined", checks3.includes("Every function your HTML calls is defined"));
  ok("9d checks: the unclosed quote in the page's own HTML is reported", checks3.includes("unclosed quote") && checks3.includes('alt=" class='));
  ok("9d the author is told the older block now gets the current version's styling", (await page.textContent("#view-upgrade .upgrade-results")).includes("older version of the"));
  ok("9d the new JS defines the tile handlers", (await code("JS")).includes("function openAccordion(") && (await code("JS")).includes("function openAccordionKey("));

  await page.click("#view-upgrade .upgrade-preview summary");
  const tileWorks = async (which) => {
    await page.click(`#view-upgrade .upgrade-seg-btn:has-text("${which}")`);
    await page.waitForTimeout(400);
    const frame = await frame2();
    return frame.evaluate(() => {
      const errors = [];
      window.addEventListener("error", (e) => errors.push(e.message));
      document.querySelectorAll(".data-icon-card")[0].closest("[onclick]").click();
      const first = { open: document.querySelectorAll(".content-display.active").length, shown: getComputedStyle(document.querySelector("#info-gov-content")).display };
      document.querySelectorAll(".data-icon-card")[1].closest("[onclick]").click();
      return { first, second: { open: document.querySelectorAll(".content-display.active").length, firstNow: getComputedStyle(document.querySelector("#info-gov-content")).display, shown: getComputedStyle(document.querySelector("#clinical-quality-content")).display }, errors };
    });
  };
  const tilesBefore = await tileWorks("Before"), tilesAfter = await tileWorks("After");
  ok("9d the icon tiles work in the original page", tilesBefore.first.open === 1 && tilesBefore.second.shown === "block");
  ok("9d and they still work after migrating: the first panel opens, then only the second", JSON.stringify(tilesAfter) === JSON.stringify(tilesBefore) && tilesAfter.first.shown === "block" && tilesAfter.second.firstNow === "none" && tilesAfter.errors.length === 0, JSON.stringify(tilesAfter));
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
  ok("preview: gets the larger share of the width by default", side0 > 600 && side0 > form0, `preview ${Math.round(side0)}px, form ${Math.round(form0)}px`);
  const stageH = await page.$eval("#panel-two-column .preview-stage", (e) => e.getBoundingClientRect().height);
  const vh = await page.evaluate(() => window.innerHeight);
  const copyBottom = await page.$eval("#panel-two-column .head-copy", (e) => e.getBoundingClientRect().bottom);
  const stageBottom = await page.$eval("#panel-two-column .preview-stage", (e) => e.getBoundingClientRect().bottom);
  ok("preview: the preview, and Copy HTML, are both on screen without scrolling", stageBottom <= vh && copyBottom <= vh && stageH > 200, `stage ${Math.round(stageH)}px tall, ends at ${Math.round(stageBottom)}/${vh}px`);
  const containerMax = () => page.$eval("#panel-two-column .live-preview", (f) => getComputedStyle(f.contentDocument.getElementById("page-container")).maxWidth);

  // Text is NEVER scaled. For every device, at the default pane width and at a very narrow one, the
  // preview must render 1:1: no transform or zoom on the iframe or any ancestor, rendered size equal to
  // layout size, and 16px text really is 16px on screen.
  const trueSize = () => page.$eval("#panel-two-column .live-preview", (f) => {
    const transforms = [];
    let zoom = 1;
    for (let n = f; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.transform !== "none") transforms.push(n.className || n.tagName);
      if (cs.zoom && cs.zoom !== "1") zoom *= parseFloat(cs.zoom);
    }
    const r = f.getBoundingClientRect();
    const px = parseFloat(getComputedStyle(f.contentDocument.body).fontSize);
    return { ratioW: r.width / f.offsetWidth, ratioH: r.height / f.offsetHeight, transforms, zoom, px, onScreen: px * (r.width / f.offsetWidth) };
  });
  const checkTrueSize = async (label) => {
    for (const d of ["Desktop", "Tablet", "Phone"]) {
      await page.click(`#panel-two-column .device-toggle button:has-text("${d}")`);
      await page.waitForTimeout(250);
      const t = await trueSize();
      ok(`preview: ${label}, ${d}: true size, no scaling anywhere`, t.ratioW === 1 && Math.abs(t.ratioH - 1) < 0.005 /* sub-pixel rounding of a flex height, not scaling */ && t.transforms.length === 0 && t.zoom === 1 && t.onScreen === 16, JSON.stringify(t));
    }
  };
  await checkTrueSize("default pane width");
  await page.evaluate(() => document.documentElement.style.setProperty("--side-w", "400px"));
  await page.waitForTimeout(300);
  await page.click('#panel-two-column .device-toggle button:has-text("Desktop")');
  await page.waitForTimeout(250);
  const narrowStage = await page.$eval("#panel-two-column .preview-stage", (e) => ({ client: e.clientWidth, scroll: e.scrollWidth }));
  ok("preview: in a narrow pane the page scrolls sideways instead of shrinking", narrowStage.client < 620 && narrowStage.scroll > narrowStage.client, JSON.stringify(narrowStage));
  ok("preview: a narrow pane says the preview is clipped", await page.isVisible("#panel-two-column .clip-note"));
  await checkTrueSize("narrow pane (400px)");
  await page.evaluate(() => document.documentElement.style.removeProperty("--side-w"));
  await page.waitForTimeout(250);
  await page.click('#panel-two-column .device-toggle button:has-text("Desktop")');
  await page.waitForTimeout(250);
  ok("preview: the clipped-preview note is gone once the pane is wide enough", !(await page.isVisible("#panel-two-column .clip-note")));
  ok("preview: desktop shows the real ~600px page column", (await containerMax()) === "600px", await containerMax());
  await page.click('#panel-two-column .device-toggle button:has-text("Tablet")');
  await page.waitForTimeout(300);
  ok("preview: tablet fills its width (single column)", (await containerMax()) === "none", await containerMax());
  await page.click('#panel-two-column .device-toggle button:has-text("Desktop")');
  const hb = await (await page.$("#panel-two-column .panel-split")).boundingBox();
  await page.mouse.move(hb.x + 10, hb.y + 200);
  await page.mouse.down();
  await page.mouse.move(hb.x - 190, hb.y + 200, { steps: 6 });
  await page.mouse.up();
  const side1 = await widthOf("#panel-two-column .panel-side");
  ok("preview: dragging the divider widens it", side1 > side0 + 120, `${Math.round(side0)} -> ${Math.round(side1)}px`);
  await page.focus("#panel-two-column .panel-split");
  await page.keyboard.press("ArrowRight"); // the drag above may already be at the widest allowed, so go narrower
  ok("preview: divider works from the keyboard", (await widthOf("#panel-two-column .panel-side")) < side1);
  const widthBefore = Math.round(await widthOf("#panel-two-column .panel-side"));
  await page.reload({ waitUntil: "networkidle" });
  await page.click('#tabbar .tab-btn:has-text("Media beside text")');
  const widthAfter = Math.round(await widthOf("#panel-two-column .panel-side"));
  ok("preview: width is remembered after reload", Math.abs(widthAfter - widthBefore) <= 2, `${widthBefore} -> ${widthAfter}px`);
  await page.dblclick("#panel-two-column .panel-split");
  const widthReset = await widthOf("#panel-two-column .panel-side");
  ok("preview: double-click resets", Math.abs(widthReset - side0) <= 2, Math.round(widthReset) + "px");
  await page.screenshot({ path: path.join(OUT, "ui-wide-preview.png") });
  // Real text in the preview, at true size (screenshot for a human to judge).
  await page.click("#panel-two-column .ql-editor");
  await page.keyboard.type("This is body text in the preview. At the default layout it should look the same size as the text in the form beside it.");
  await page.waitForTimeout(500);
  await page.locator("#panel-two-column .preview-card").screenshot({ path: path.join(OUT, "preview-true-size.png") });

  // ---- workbench round: collapsing lists, click-to-edit, pop-out, code collapse, rail, narrow --------
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await page.click('#tabbar .tab-btn:has-text("Resource cards")');
  const card = (n) => `#panel-resource-cards .item-card:nth-child(${n})`;
  const isOpen = (sel) => page.$eval(sel, (e) => e.classList.contains("is-open"));
  ok("lists: first card open, second collapsed", (await isOpen(card(1))) && !(await isOpen(card(2))) && !(await page.isVisible(card(2) + " .card-title")));
  await page.fill(card(1) + " .card-title", "Alpha");
  await page.click(card(2) + " .item-toggle");
  ok("lists: opening one card closes the other (one at a time)", (await isOpen(card(2))) && !(await isOpen(card(1))));
  await page.fill(card(2) + " .card-title", "Beta");
  ok("lists: a collapsed card shows its title", (await page.textContent(card(1) + " .item-summary")) === "Alpha");
  await page.click("#panel-resource-cards .item-add");
  ok("lists: + Add opens the new card and closes the others", (await isOpen(card(3))) && !(await isOpen(card(2))));
  ok("lists: an empty card says so", (await page.textContent(card(3) + " .item-summary")).startsWith("Empty"));
  await page.click('#tabbar .tab-btn:has-text("Navigation cards")');
  const navH = await page.$eval("#panel-nav-cards .panel-form", (e) => e.scrollHeight);
  ok("lists: Navigation cards form is far shorter than before (was 1769px)", navH < 1100, navH + "px");

  // click-to-edit
  await page.click('#tabbar .tab-btn:has-text("Resource cards")');
  const pv = page.frameLocator("#panel-resource-cards .live-preview");
  await pv.locator("text=Alpha").first().hover();
  ok("click-to-edit: hovering something editable outlines it", (await pv.locator("[data-pick-hover]").count()) === 1);
  await pv.locator("text=Beta").first().click();
  const focused = await page.evaluate(() => ({ cls: document.activeElement.className, value: document.activeElement.value, open: !!document.activeElement.closest(".item-card.is-open") }));
  ok("click-to-edit: clicking a card in the preview opens its fields and focuses its title", focused.value === "Beta" && focused.open && /card-title/.test(focused.cls), JSON.stringify(focused));
  await page.click('#tabbar .tab-btn:has-text("Intro text")');
  await page.click("#panel-hero-text .ql-editor");
  await page.keyboard.type("Hello rich world");
  await page.waitForTimeout(400);
  await page.click("#panel-hero-text .panel-title");
  await page.frameLocator("#panel-hero-text .live-preview").locator("text=Hello rich world").click();
  ok("click-to-edit: clicking rich text in the preview focuses the editor", await page.evaluate(() => !!document.activeElement.closest(".ql-editor")));

  // pop-out preview
  await page.click('#tabbar .tab-btn:has-text("Resource cards")');
  const [popup] = await Promise.all([ctx.waitForEvent("page"), page.click("#panel-resource-cards .popout-btn")]);
  await popup.waitForLoadState();
  await popup.waitForFunction(() => document.getElementById("frame").srcdoc.includes("Beta"), null, { timeout: 5000 });
  ok("pop-out: opens its own window showing the live preview", /preview\.html/.test(popup.url()));
  ok("pop-out: the builder's preview says it has moved", await page.isVisible("#panel-resource-cards .popout-note"));
  await page.click(card(3) + " .item-toggle").catch(() => {});
  await page.fill(card(3) + " .card-title", "Gamma");
  await popup.waitForFunction(() => document.getElementById("frame").srcdoc.includes("Gamma"), null, { timeout: 5000 });
  ok("pop-out: follows edits live", true);
  await page.click('#tabbar .tab-btn:has-text("Buttons")');
  await popup.waitForFunction(() => document.title.includes("Buttons"), null, { timeout: 5000 });
  ok("pop-out: follows the block you switch to", true);
  await page.click('#tabbar .tab-btn:has-text("Resource cards")');
  await page.click("#panel-resource-cards .popout-return");
  await popup.waitForEvent("close", { timeout: 5000 }).catch(() => {});
  ok("pop-out: 'Bring it back' closes the window and restores the preview", popup.isClosed() && !(await page.isVisible("#panel-resource-cards .popout-note")));

  // code card collapses; Copy HTML stays in reach
  const stage0 = await page.$eval("#panel-resource-cards .preview-stage", (e) => e.getBoundingClientRect().height);
  await page.click("#panel-resource-cards .collapse-btn");
  const stage1 = await page.$eval("#panel-resource-cards .preview-stage", (e) => e.getBoundingClientRect().height);
  ok("code: collapsing hides the code but keeps Copy HTML visible", !(await page.isVisible("#panel-resource-cards .output-bodies")) && (await page.isVisible("#panel-resource-cards .head-copy")));
  ok("code: collapsing gives the preview the room", stage1 > stage0 + 80, `${Math.round(stage0)} -> ${Math.round(stage1)}px`);
  await page.click("#panel-resource-cards .collapse-btn");

  // rail toggle
  await page.click("#rail-toggle");
  ok("rail: the Blocks button hides the block list", !(await page.isVisible("#tabbar")));
  await page.click("#rail-toggle");
  ok("rail: and shows it again", await page.isVisible("#tabbar"));

  // narrow window: stacks, the rail becomes a row, the page scrolls
  await page.setViewportSize({ width: 820, height: 900 });
  await page.waitForTimeout(300);
  const narrow = await page.evaluate(() => ({ dir: getComputedStyle(document.getElementById("tabbar")).flexDirection, scrolls: document.documentElement.scrollHeight > window.innerHeight, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, toggle: getComputedStyle(document.getElementById("rail-toggle")).display }));
  ok("narrow: the rail becomes a row, the page scrolls, nothing overflows sideways", narrow.dir === "row" && narrow.scrolls && narrow.overflowX <= 0 && narrow.toggle === "none", JSON.stringify(narrow));
  await page.setViewportSize({ width: 1400, height: 900 });

  // ---- "How it works" lightbox ---------------------------------------------------------------
  await page.click('#tabbar .tab-btn:has-text("Accordion")');
  ok("guide: no inline toggle block any more", (await page.$$(".how-it-works")).length === 0);
  ok("guide: a How it works button sits in the panel header", await page.isVisible("#panel-accordion .panel-head .guide-btn"));
  await page.click("#panel-accordion .guide-btn");
  ok("guide: opens as a modal dialog", await page.evaluate(() => { const d = document.querySelector(".guide-dialog"); return !!d && d.open && d.matches(":modal"); }));
  ok("guide: shows this block's explanation under its name", (await page.textContent(".guide-dialog")).includes("filing cabinet") && (await page.textContent("#guide-title")).includes("Accordion"), await page.textContent("#guide-title"));
  ok("guide: keyboard focus moves inside the dialog", await page.evaluate(() => !!document.activeElement.closest(".guide-dialog")));
  await page.keyboard.press("Escape");
  ok("guide: Escape closes it", await page.evaluate(() => !document.querySelector(".guide-dialog").open));
  ok("guide: focus returns to the button that opened it", await page.evaluate(() => document.activeElement.classList.contains("guide-btn")));
  await page.click("#panel-accordion .guide-btn");
  await page.click(".guide-close");
  ok("guide: the close button closes it", await page.evaluate(() => !document.querySelector(".guide-dialog").open));
  await page.click("#panel-accordion .guide-btn");
  await page.mouse.click(8, 8); // on the backdrop, outside the card
  ok("guide: clicking outside closes it", await page.evaluate(() => !document.querySelector(".guide-dialog").open));
  await page.click('#tabbar .tab-btn:has-text("Navigation cards")');
  await page.click("#panel-nav-cards .guide-btn");
  const gbox = await page.evaluate(() => { const b = document.querySelector(".guide-body"); const c = document.querySelector(".guide-card").getBoundingClientRect(); return { text: b.textContent.includes("Two styles live in this one block"), scrolls: b.scrollHeight > b.clientHeight, cardH: c.height, vh: innerHeight }; });
  ok("guide: each block shows its own explanation", gbox.text);
  ok("guide: long explanations scroll inside the dialog and never outgrow the window", gbox.scrolls && gbox.cardH <= gbox.vh * 0.9, JSON.stringify(gbox));
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(200);
  await page.click("#panel-nav-cards .guide-btn");
  const pbox = await page.evaluate(() => { const c = document.querySelector(".guide-card").getBoundingClientRect(); return { left: c.left, right: c.right, vw: innerWidth }; });
  ok("guide: fits a phone screen", pbox.left >= 0 && pbox.right <= pbox.vw, JSON.stringify(pbox));
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1400, height: 900 });

  // ---- Explain tab + X-ray (pilot blocks: Accordion, Text around media) ----------------------------
  const tabNames = (panel) => page.$$eval(`${panel} .output-tab`, (t) => t.map((x) => x.textContent));
  const xrayOn = (panel) => page.$eval(`${panel} .xray-btn`, (b) => b.getAttribute("aria-pressed") === "true");
  await page.click('#tabbar .tab-btn:has-text("Buttons")');
  ok("explain: blocks without an explain.json show no Explain tab (pilot)", !(await tabNames("#panel-buttons")).includes("Explain"));
  await page.click('#tabbar .tab-btn:has-text("Accordion")');
  ok("explain: the Accordion has an Explain tab", (await tabNames("#panel-accordion")).includes("Explain"));
  await page.fill("#panel-accordion .text-field-input", "Demo group");
  const arows = await page.$$("#panel-accordion .bullet-row input");
  await arows[0].fill("Getting started");
  await arows[1].fill("Staying safe");
  await page.waitForTimeout(500);
  ok("explain: X-ray is off until you ask for it", !(await xrayOn("#panel-accordion")));
  await page.click('#panel-accordion .output-tab:has-text("Explain")');
  await page.waitForTimeout(600);
  ok("explain: opening the tab switches the X-ray on", await xrayOn("#panel-accordion"));
  const codeText = await page.textContent("#panel-accordion .explain-code");
  ok("explain: it shows YOUR code (your names and titles)", codeText.includes("accordion-demo-group") && codeText.includes("Getting started") && codeText.includes("collapse-staying-safe"));
  const apv = page.frameLocator("#panel-accordion .live-preview");
  ok("explain: X-ray puts numbered chips on the preview", (await apv.locator(".xray-chip").count()) >= 5, String(await apv.locator(".xray-chip").count()));
  ok("explain: code and X-ray use the same numbers", (await page.$$eval("#panel-accordion .explain-code .tk-badge", (b) => b.map((x) => x.textContent))).includes("4") && (await apv.locator(".xray-chip", { hasText: /^4$/ }).count()) >= 1);

  // hover a line of code -> its element lights up in the preview, and the card explains it
  await page.hover('#panel-accordion .explain-code .tk-tag[data-el="3"] >> nth=0');
  ok("explain: hovering code outlines that element in the preview", (await apv.locator("button.accordion-button[data-xray-hover]").count()) === 1);
  ok("explain: hovering code explains it in plain English", (await page.textContent("#panel-accordion .explain-label")) === "The title you click" && (await page.textContent("#panel-accordion .explain-what")).includes("real button"));
  ok("explain: the card has layered detail (how it's built, developer detail)", (await page.$$("#panel-accordion .explain-more")).length === 2);

  // hover something in the preview -> the code lights up and the card explains it
  await apv.locator("h3.accordion-header").nth(1).hover({ position: { x: 300, y: 4 } }); // the heading's empty right side
  await page.waitForTimeout(200);
  ok("explain: hovering the preview explains that part", (await page.textContent("#panel-accordion .explain-label")) === "The heading");
  ok("explain: hovering the preview highlights its code", (await page.$$("#panel-accordion .explain-code .is-tag")).length >= 2);
  await apv.locator(".xray-chip", { hasText: /^4$/ }).nth(1).hover();   // a numbered chip is hoverable too
  await page.waitForTimeout(200);
  ok("explain: hovering a numbered chip explains that part", (await page.textContent("#panel-accordion .explain-label")) === "The title you click");

  // hover an attribute: its note, and every identical value lights up (ids that must match)
  await page.hover('#panel-accordion .explain-code .tk-val[data-attr="data-bs-target"] >> nth=0');
  ok("explain: hovering an attribute explains it", (await page.textContent("#panel-accordion .explain-attr")).includes("must match") || (await page.textContent("#panel-accordion .explain-attr")).includes("match the panel"));
  const same = await page.$$eval("#panel-accordion .explain-code .is-same", (s) => s.map((x) => x.textContent));
  ok("explain: every copy of the same id/target lights up (3: target, controls, id)", same.length === 3, same.join(" | "));
  ok("explain: and it says how many there are", (await page.textContent("#panel-accordion .explain-same")).includes("3 times"));

  // click pins an explanation; Escape unpins
  await page.click('#panel-accordion .explain-code .tk-tag[data-el="5"] >> nth=0');
  await page.mouse.move(5, 300);
  await page.waitForTimeout(150);
  ok("explain: clicking pins it, even when the pointer leaves", (await page.textContent("#panel-accordion .explain-label")) === "The hidden panel" && (await page.isVisible("#panel-accordion .explain-unpin")));
  await page.keyboard.press("Escape");
  ok("explain: Escape unpins and returns to the overview", (await page.isVisible("#panel-accordion .explain-legend")) && !(await page.isVisible("#panel-accordion .explain-unpin")));
  ok("explain: the overview lists every part, numbered", (await page.$$("#panel-accordion .legend-item")).length === 7);

  // it follows your edits
  await arows[0].fill("A brand new title");
  await page.waitForTimeout(600);
  ok("explain: editing the form updates the explained code", (await page.textContent("#panel-accordion .explain-code")).includes("A brand new title"));

  // leaving the tab switches X-ray off (and click-to-edit comes back)
  await page.click('#panel-accordion .output-tab:has-text("HTML")');
  await page.waitForTimeout(400);
  ok("explain: leaving the Explain tab switches the X-ray off", !(await xrayOn("#panel-accordion")) && (await apv.locator(".xray-chip").count()) === 0);

  // the lightbox leads into it
  await page.click("#panel-accordion .guide-btn");
  ok("explain: the guide is layered: a 30-second summary, a pointer to Explain, and a Deep dive fold", (await page.isVisible(".guide-tldr")) && (await page.isVisible(".guide-try")) && (await page.textContent(".guide-body details summary")).includes("Deep dive") && !(await page.$eval(".guide-body details", (d) => d.open)));
  ok("explain: the Deep dive opens to show the detail", await (async () => { await page.click(".guide-body details summary"); return (await page.textContent(".guide-body details")).includes("aria-expanded"); })());
  ok("explain: the How it works lightbox offers to explore on your block", await page.isVisible(".guide-explore"));
  await page.click(".guide-explore");
  ok("explain: 'Explore it on my block' closes the lightbox and opens Explain with X-ray on", (await page.evaluate(() => !document.querySelector(".guide-dialog").open)) && (await xrayOn("#panel-accordion")) && (await page.$eval('#panel-accordion .output-tab:has-text("Explain")', (t) => t.getAttribute("aria-selected"))) === "true");
  await page.click('#tabbar .tab-btn:has-text("Buttons")');
  await page.click("#panel-buttons .guide-btn");
  ok("explain: blocks without Explain do not offer the button", !(await page.isVisible(".guide-explore")));
  await page.keyboard.press("Escape");

  // the visual pilot
  await page.click('#tabbar .tab-btn:has-text("Text around media")');
  ok("explain: Text around media has an Explain tab", (await tabNames("#panel-image-text-section")).includes("Explain"));
  await page.fill("#panel-image-text-section .media-image-url", "https://example.org/pic.png");
  await page.click("#panel-image-text-section .ql-editor");
  await page.keyboard.type("Some words beside the picture.");
  await page.waitForTimeout(600);
  await page.click('#panel-image-text-section .output-tab:has-text("Explain")');
  await page.waitForTimeout(400);
  const legend = await page.$$eval("#panel-image-text-section .legend-label", (l) => l.map((x) => x.textContent));
  ok("explain: Text around media explains its parts (wrapper, image, text, paragraph)", ["The wrapper", "The image", "Your text", "A paragraph"].every((n) => legend.includes(n)), legend.join(" | "));
  await page.hover('#panel-image-text-section .explain-code .tk-tag[data-el="1"] >> nth=0');
  ok("explain: the image part teaches the float idea", (await page.textContent("#panel-image-text-section .explain-what")).includes("float"));
  await page.click('#panel-image-text-section .output-tab:has-text("HTML")');

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

  // the generated page (template/): base CSS 3.2.0 behaviour in a real browser
  const tctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await stubCdn(tctx);
  const tp = await tctx.newPage();
  await tp.goto(BASE + "/template/index.html", { waitUntil: "load" });
  await tp.focus(".accordion-button");
  await tp.keyboard.press("Shift+Tab");
  await tp.keyboard.press("Tab");
  const ring = await tp.evaluate(() => { const c = getComputedStyle(document.activeElement); return { cls: document.activeElement.className, w: c.outlineWidth, st: c.outlineStyle, col: c.outlineColor }; });
  ok("template: keyboard focus on an accordion button shows a 3px black ring", /accordion-button/.test(ring.cls) && ring.st === "solid" && ring.w === "3px" && ring.col === "rgb(0, 0, 0)", JSON.stringify(ring));
  const gap = () => tp.evaluate(() => document.querySelector(".content-body h2").getBoundingClientRect().top - document.querySelector("#header-h1").getBoundingClientRect().bottom);
  const aagGap = await tp.evaluate(() => document.querySelector("#at-a-glance").getBoundingClientRect().top - document.querySelector("#header-h1").getBoundingClientRect().bottom);
  ok("template: At a glance sits one normal H1 margin (24px) below the title; the base H1 margin is unchanged", Math.round(aagGap) === 24, "gap=" + aagGap);
  ok("template: the At a glance heading is the theme colour, not black", await tp.$eval("#at-a-glance-heading", (e) => getComputedStyle(e).color === "rgb(163, 25, 91)"));
  await tp.evaluate(() => document.querySelector("#at-a-glance").remove());
  const before = await gap();
  await tp.evaluate(() => document.querySelector(".content-body h2").classList.add("tight-heading"));
  const after = await gap();
  ok("template: .tight-heading pulls an H2 up under the H1 (by 40px)", Math.round(before - after) === 40, `before=${before} after=${after}`);
  ok("template: content-column H3 is black", await tp.evaluate(() => { const h = document.createElement("h3"); document.querySelector(".content-body").prepend(h); return getComputedStyle(h).color === "rgb(0, 0, 0)"; }));
  ok("template: contents items have a themed border", await tp.$eval("#table-of-contents li", (e) => getComputedStyle(e).borderTopWidth === "1px"));

  ok("no page errors", errors.length === 0, errors.join("; "));
  await browser.close();
  server.close();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR", e.message.split("\n")[0], "\n" + (e.stack || "").split("\n").slice(1, 4).join("\n")); server.close(); process.exit(1); });
