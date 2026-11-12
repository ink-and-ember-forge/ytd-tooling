// Turns "the builder's pure logic" into a plain JSON object, so the same
// capture can be taken from the original monolith and from the modules.
import { FIXTURES, QUILL_SAMPLES } from "./fixtures.js";

const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

export function capture(api) {
  const out = { base: {}, blocks: {}, richtext: {}, helpers: {}, preview: "" };

  // Deterministic ids: randomId() uses Math.random.
  const realRandom = Math.random;
  let n = 0;
  Math.random = () => ((++n * 0.137) % 1);
  try {
    for (const toc of [true, false]) {
      out.base[`css toc=${toc}`] = api.getBaseCSS(toc);
      for (const theme of ["gwella", "ytydysgu"]) {
        out.base[`html toc=${toc} ${theme}`] = api.getBaseHTML(toc, theme);
      }
    }
    out.base.js = api.BASE_JS;

    for (const [id, block] of Object.entries(api.BLOCKS)) {
      const entry = {
        label: block.label,
        description: block.description,
        htmlOutputLabel: block.htmlOutputLabel || null,
        secondaryLabel: block.secondaryHTML ? block.secondaryHTML.label : null,
        fields: block.fields,
        css: block.css || null,
        js: block.js || null,
        guide: norm(api.guideFor(id)),
        variants: {},
      };
      for (const [variant, values] of Object.entries(FIXTURES[id] || {})) {
        entry.variants[variant] = {
          html: block.generateHTML(values),
          secondary: block.secondaryHTML ? block.secondaryHTML.generate(values) : null,
          warnings: block.warnings ? block.warnings(values) : null,
        };
      }
      out.blocks[id] = entry;
    }

    for (const [k, v] of Object.entries(QUILL_SAMPLES)) {
      out.richtext[k] = { clean: api.cleanQuillHTML(v), hero: api.markFirstParagraphLarge(api.cleanQuillHTML(v), "hero-text__intro") };
    }

    out.helpers = {
      slugify: ["Hello World", "  ", "A&B/C", "x".repeat(60), "Ünï"].map((s) => api.slugify(s)),
      youtube: ["https://www.youtube.com/watch?v=NSUm8ZhTBXY", "https://youtu.be/NSUm8ZhTBXY", "NSUm8ZhTBXY", "https://www.youtube.com/embed/abc", "nonsense"].map((s) => api.toYouTubeEmbed(s)),
      external: ["https://example.org", "/relative", "#id", "https://leadershipportal.heiw.wales/x", "https://sub.ytydysgu.heiw.wales", "mailto:a@b.c", "", "not a url"].map((u) => [api.linkIsExternal(u), api.newTabAttrs(u, true), api.newTabAttrs(u, false)]),
      escape: api.escapeHTML(`<a href="x">&'</a>`),
      indent: api.indentLines("a\n\n b", 2),
      compare: [["3.1.1", "3.1.0"], ["3.0.0", "3.0.0"], ["3.0.9", "3.1.0"]].map(([a, b]) => api.compareVersions(a, b)),
    };

    const block = api.BLOCKS["nav-cards"];
    out.preview = api.buildPreviewDoc(block, "<p>x</p>", block.css, block.js, "ytydysgu");
  } finally {
    Math.random = realRandom;
  }
  return JSON.parse(JSON.stringify(out));
}
