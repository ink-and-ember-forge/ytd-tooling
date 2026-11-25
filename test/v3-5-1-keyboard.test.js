// 3.5.1: reduced motion, focus rings, icon tiles as buttons, accordion ids scoped to their accordion.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS } from "../src/blocks/index.js";
import { FIXTURES } from "./fixtures.js";
import { validate } from "../src/validate/index.js";

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const out = (id, name) => BLOCKS[id].generateHTML(FIXTURES[id][name]);

test("reduced motion: no smooth scroll, no transitions or animations in the page, and the scripts ask first", () => {
  const css = read("base/base.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*html \{\s*scroll-behavior: auto;[\s\S]*#page-container \*,[\s\S]*transition: none !important;[\s\S]*animation: none !important;/);
  assert.match(read("base/base.js"), /prefers-reduced-motion: reduce.*"auto" : "smooth"/);
  assert.match(BLOCKS["icon-toggle"].js, /prefers-reduced-motion: reduce.*"auto" : "smooth"/);
});

test("icon toggle: tiles are buttons that say what they open and whether it is open; Space works like Enter", () => {
  const html = out("icon-toggle", "named");
  for (const m of html.matchAll(/<div class="data-icon-trigger"[^>]*>/g)) {
    assert.match(m[0], /role="button"/);
    assert.match(m[0], /aria-expanded="false"/);
    const id = m[0].match(/openAccordion\(this, '([^']+)'\)/)[1];
    assert.ok(m[0].includes(`aria-controls="${id}"`), "aria-controls names the panel the tile opens");
    assert.ok(html.includes(`id="${id}"`), "and the panel exists");
  }
  const js = BLOCKS["icon-toggle"].js;
  assert.match(js, /event\.key === "Enter" \|\| event\.key === " "[\s\S]*event\.preventDefault\(\)/);
  assert.match(js, /setExpanded\(tile, true\)/);
  assert.equal(validate({ html }).findings.filter((f) => f.id === "html/missing-target").length, 0, "aria-controls points at a real id");
  assert.match(BLOCKS["icon-toggle"].css, /\.data-icon-trigger \{[\s\S]*&:focus-visible \{[\s\S]*\.data-icon-card \{\s*outline: 3px solid var\(--focus-ring-colour\)/);
});

test("clickable cards ring the card when their stretched link has keyboard focus", () => {
  assert.match(BLOCKS["nav-cards"].css, /&:has\(> \.stretched-link:focus-visible\) \{\s*outline: 3px solid var\(--focus-ring-colour\)/);
  assert.match(BLOCKS["resource-cards"].css, /&:has\(\.stretched-link:focus-visible\) \{\s*outline: 3px solid var\(--focus-ring-colour\)/);
});

test("accordion: two accordions with an item of the same name share no id", () => {
  const a = BLOCKS.accordion.generateHTML({ groupName: "First", titles: ["Overview", "Details"] });
  const b = BLOCKS.accordion.generateHTML({ groupName: "Second", titles: ["Overview"] });
  const page = validate({ html: `${a}\n${b}` });
  assert.equal(page.findings.filter((f) => f.id === "html/duplicate-id").length, 0);
  assert.equal(page.findings.filter((f) => f.id === "html/missing-target").length, 0);
  assert.match(a, /id="accordion-first-heading-overview"/);
  assert.match(a, /data-bs-target="#accordion-first-collapse-overview" aria-expanded="false" aria-controls="accordion-first-collapse-overview"/);
  assert.match(a, /aria-labelledby="accordion-first-heading-overview" data-bs-parent="#accordion-first"/);
  const anon = [BLOCKS.accordion.generateHTML({ groupName: "", titles: ["Same"] }), BLOCKS.accordion.generateHTML({ groupName: "", titles: ["Same"] })];
  assert.equal(validate({ html: anon.join("\n") }).findings.filter((f) => f.id === "html/duplicate-id").length, 0, "random group ids keep them apart too");
});
