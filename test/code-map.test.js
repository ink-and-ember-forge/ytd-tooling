// The parser that links a line of generated code to the element it draws.
// If these fail, the Explain tab and X-ray would point at the wrong things.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { mapHTML, rangeOf, sameValue } from "../src/lib/code-map.js";
import { BLOCKS } from "../src/blocks/index.js";
import { FIXTURES } from "./fixtures.js";

const domElements = (html) => {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  return Array.from(doc.getElementById("root").querySelectorAll("*"));
};

test("tokens concatenate back to exactly the input (nothing lost or changed)", () => {
  const html = `<div class="a" id='b' hidden data-x=1>\n  <img src="x.png" alt="" />\n  text &amp; more <!-- c -->\n</div>`;
  assert.equal(mapHTML(html).tokens.map((t) => t.text).join(""), html);
  const pieces = mapHTML(html).tokens.filter((t) => t.type === "open").map((t) => t.pieces.map((p) => p.text).join(""));
  assert.deepEqual(pieces, [`<div class="a" id='b' hidden data-x=1>`, `<img src="x.png" alt="" />`]);
});

test("elements, attributes, nesting and ranges", () => {
  const { elements, tokens } = mapHTML(`<ul class="l"><li>One</li><li id="two">Two<br></li></ul>`);
  assert.deepEqual(elements.map((e) => e.tag), ["ul", "li", "li", "br"]);
  assert.deepEqual(elements.map((e) => e.parent), [-1, 0, 0, 2]);
  assert.deepEqual(elements.map((e) => e.depth), [0, 1, 1, 2]);
  assert.equal(elements[0].attrs.class, "l");
  assert.equal(elements[2].attrs.id, "two");
  assert.equal(elements[3].close, null); // void element: no closing tag
  const [a, b] = rangeOf({ tokens, elements }, 0);
  assert.equal(tokens[a].text, `<ul class="l">`);
  assert.equal(tokens[b].text, `</ul>`);
});

test("every block's output maps 1:1 onto the DOM (same elements, same order)", () => {
  let checked = 0;
  for (const [id, variants] of Object.entries(FIXTURES)) {
    for (const [name, values] of Object.entries(variants)) {
      const html = BLOCKS[id].generateHTML(values);
      const map = mapHTML(html);
      const dom = domElements(html);
      assert.equal(map.elements.length, dom.length, `${id}/${name}: ${map.elements.length} parsed vs ${dom.length} in the DOM`);
      map.elements.forEach((e, i) => assert.equal(e.tag, dom[i].tagName.toLowerCase(), `${id}/${name}: element ${i}`));
      assert.equal(map.tokens.map((t) => t.text).join(""), html, `${id}/${name}: tokens must reproduce the HTML`);
      for (const e of map.elements) {
        assert.ok(e.close === null || e.close > e.open, `${id}/${name}: element ${e.index} closes after it opens`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 30, `expected to check every fixture variant, checked ${checked}`);
});

test("sameValue links ids that must match, ignoring the leading #", () => {
  const html = BLOCKS.accordion.generateHTML(FIXTURES.accordion.named);
  const map = mapHTML(html);
  const hits = sameValue(map, "#collapse-topic-one");
  const attrs = hits.map((h) => map.tokens[h.token].pieces[h.piece - 2]?.text); // the attribute name two pieces before the value
  assert.ok(hits.length >= 3, `expected the id, data-bs-target and aria-controls, got ${hits.length}`);
  assert.ok(attrs.includes("data-bs-target") && attrs.includes("id") && attrs.includes("aria-controls"), attrs.join());
});
