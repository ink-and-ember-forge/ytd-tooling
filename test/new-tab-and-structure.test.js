// 3.4.1: new-tab links say so, the base structure is valid, nav cards line up, the old structure is upgraded mechanically.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { BLOCKS } from "../src/blocks/index.js";
import { cleanQuillHTML } from "../src/lib/richtext.js";
import { getBaseHTML } from "../src/base/index.js";
import { upgradeBaseHtml } from "../src/changelog/upgrade.js";
import { FIXTURES } from "./fixtures.js";
import { validate } from "../src/validate/index.js";
import { templatePack } from "../src/validate/template-pack.js";

const html = (id, name) => BLOCKS[id].generateHTML(FIXTURES[id][name]);
const all = (id) => Object.keys(FIXTURES[id]).map((n) => html(id, n)).join("\n");

test("every block that can open a link in a new tab labels it, and none writes the unstyled inline-icon class", () => {
  for (const id of ["nav-cards", "resource-cards", "buttons"]) {
    const out = all(id);
    assert.doesNotMatch(out, /inline-icon/, id);
    for (const m of out.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /aria-label="[^"]*\(opens in a new tab\)"/, `${id}: ${m[0]}`);
  }
});

test("labels name the visible text, and a link that stays in the tab gets no suffix", () => {
  const nav = all("nav-cards");
  assert.match(nav, /class="nav-card__button" target="_blank"[^>]* aria-label="[^"]+ \(opens in a new tab\)"/);
  const stays = nav.match(/<a\b(?![^>]*target="_blank")[^>]*>/g) || [];
  assert.ok(stays.length > 0 && stays.every((t) => !/opens in a new tab/.test(t)), "links that stay in the tab have no suffix");
  const res = all("resource-cards");
  assert.equal((res.match(/\(opens in a new tab\)/g) || []).length, (res.match(/target="_blank"/g) || []).length);
});

test("rich text: a new-tab link gets visually hidden text and a hidden decorative icon; its visible text does not change", () => {
  const out = cleanQuillHTML('<p>See <a href="https://example.org" target="_blank">the site</a> and <a href="/x">here</a>.</p>');
  assert.match(out, /<a href="https:\/\/example\.org" target="_blank">the site <span class="visually-hidden"> \(opens in a new tab\)<\/span><i aria-hidden="true" class="fa-solid fa-up-right-from-square button-icon"><\/i><\/a>/);
  assert.doesNotMatch(out, /inline-icon/);
  assert.match(out, /<a href="\/x">here<\/a>/);
  const twice = cleanQuillHTML(out);
  assert.equal((twice.match(/opens in a new tab/g) || []).length, 1, "cleaning twice does not add it twice");
});

test("base HTML: no <main>, the contents label is not a heading, the date line has no <sup>", () => {
  for (const toc of [true, false]) {
    const base = getBaseHTML(toc, "gwella");
    assert.doesNotMatch(base, /<main\b|<\/main>/);
    assert.doesNotMatch(base, /<sup/);
    assert.match(base, /<div class="main-grid standard-container">/);
    assert.match(base, /<p class="timestamp">Webpage last updated on <span class="timestamp__date">\[27th November 2025\]<\/span>\.<\/p>/);
  }
  const withToc = getBaseHTML(true, "gwella");
  assert.match(withToc, /<nav id="table-of-contents" aria-labelledby="table-of-contents-heading">\s*<p id="table-of-contents-heading">/);
  assert.equal(validate({ html: withToc }, { packs: [templatePack] }).findings.filter((f) => /heading/.test(f.id)).length, 0);
  assert.equal(html("at-a-glance", Object.keys(FIXTURES["at-a-glance"])[0]).includes('<h2 id="at-a-glance-heading">'), true);
});

test("upgradeBaseHtml: turns the old grid and contents label into the 3.4.1 shape and touches nothing else", () => {
  const old = '<main class="main-grid standard-container">\n<nav id="table-of-contents">\n<h3 id="table-of-contents-heading">Contents</h3>\n<ul></ul></nav>\n<div class="content-column"><h1>T</h1></div>\n</main>\n<main>another</main>';
  const r = upgradeBaseHtml(old);
  assert.equal(r.html, '<div class="main-grid standard-container">\n<nav id="table-of-contents" aria-labelledby="table-of-contents-heading">\n<p id="table-of-contents-heading">Contents</p>\n<ul></ul></nav>\n<div class="content-column"><h1>T</h1></div>\n</div>\n<main>another</main>');
  assert.deepEqual(r.changes.map((c) => c.id), ["CHG-3.4.1-01", "CHG-3.4.1-02"]);
  assert.equal(upgradeBaseHtml(r.html).changes.length, 0, "idempotent");
  const unclosed = upgradeBaseHtml('<main class="main-grid"><p>never closed');
  assert.equal(unclosed.html, '<main class="main-grid"><p>never closed', "an unclosed <main> is left alone");
});

test("nav cards: the button is pushed to the bottom of an equal-height card, with subgrid where supported", () => {
  const css = BLOCKS["nav-cards"].css;
  assert.match(css, /\.nav-card__button \{\s*display: block;\s*margin-top: auto;/);
  assert.match(css, /\.nav-card \{[^}]*display: flex;\s*flex-direction: column;/);
  assert.match(css, /@supports \(grid-template-rows: subgrid\)[\s\S]*?&:not\(\.nav-card--numbered\)[\s\S]*?grid-row: span 3/);
});
