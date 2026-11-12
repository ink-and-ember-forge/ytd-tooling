// The Explain tab's teaching content is checked against the REAL generated output,
// so an explanation can't quietly go stale when a block changes.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { BLOCKS } from "../src/blocks/index.js";
import { analyse, attributeNote, validateExplain, GLOSSARY } from "../src/explain/engine.js";
import { FIXTURES } from "./fixtures.js";

const withExplain = Object.values(BLOCKS).filter((b) => b.explain);

// Fixtures lack a couple of things real output has (the new-tab icon, emphasis, ordered lists):
// these samples make sure those parts are exercised too.
const EXTRA = {
  "image-text-section": [{
    media: { type: "image", imageUrl: "https://example.org/a.png", imageAlt: "", imageSize: "large", videoUrl: "" },
    content: '<h3>Hi</h3><p>Some <em>stressed</em> and <strong>bold</strong> words, <a href="/x" target="_blank">a link <i class="fa-solid fa-up-right-from-square"></i></a>.</p><ol><li>One</li></ol><ul><li>Two</li></ul>',
  }],
};

const outputs = (block) => {
  const all = Object.values(FIXTURES[block.id] || {}).concat(EXTRA[block.id] || []);
  return all.map((values) => block.generateHTML(values));
};

test("at least the two pilot blocks have an explain.json", () => {
  assert.ok(withExplain.some((b) => b.id === "accordion"));
  assert.ok(withExplain.some((b) => b.id === "image-text-section"));
});

for (const block of withExplain) {
  test(`explain.json is well-formed: ${block.id}`, () => {
    assert.deepEqual(validateExplain(block.explain), []);
  });

  test(`every element a ${block.id} block produces is explained`, () => {
    for (const html of outputs(block)) {
      const a = analyse(html, block.explain);
      assert.ok(a, "HTML must line up with the DOM");
      a.partOf.forEach((part, i) => assert.ok(part >= 0, `element ${i} <${a.map.elements[i].tag} class="${a.map.elements[i].attrs.class || ""}"> has no part. Add one to explain.json`));
    }
  });

  test(`every part of ${block.id}'s explain.json matches something real (no stale selectors)`, () => {
    const used = new Set();
    for (const html of outputs(block)) analyse(html, block.explain).partOf.forEach((p) => used.add(p));
    block.explain.parts.forEach((p, i) => assert.ok(used.has(i), `part "${p.label}" (${p.selector}) matches nothing in any fixture. Is the selector stale?`));
  });

  test(`every attribute ${block.id} outputs has a plain-English note`, () => {
    const missing = new Set();
    for (const html of outputs(block)) {
      const { map } = analyse(html, block.explain);
      map.elements.forEach((e) => Object.keys(e.attrs).forEach((name) => { if (!attributeNote(name, block.explain)) missing.add(name); }));
    }
    assert.deepEqual([...missing], [], "add these to the block's explain.json \"attributes\", or to src/explain/glossary.json if every block could use them");
  });
}

test("the shared glossary has notes for the attributes blocks commonly use", () => {
  for (const name of ["class", "id", "href", "src", "alt", "target", "rel", "aria-*", "data-bs-*"]) assert.ok(GLOSSARY[name], name);
});

test("validateExplain catches a broken file", () => {
  assert.ok(validateExplain({ parts: [{ selector: "((", label: "x", what: "y" }] }).some((e) => /not a valid selector/.test(e)));
  assert.ok(validateExplain({ parts: [{ selector: ".a", label: "", what: "y" }] }).some((e) => /missing "label"/.test(e)));
  assert.ok(validateExplain({}).length > 0);
});
