# YTD tools

Static site for the Gwella page builder and its reference template. Hosted with GitHub Pages. No build step, no runtime dependencies.

## Layout

| Path | What it is |
|------|------------|
| `index.html`, `builder.css`, `builder.js` | The page builder (root of the site). `builder.js` holds the base HTML/CSS/JS strings, every block definition (`BLOCKS`), the changelog and the upgrade checker. |
| `template/index.html`, `template/template.css`, `template/template.js` | The reference template page, opened from the builder's "Open template" button. It is the base code plus one example of every block. |
| `scripts/check-sync.js` | Parity check between the builder and the template (see below). |

## Keeping the builder and template in step

The base HTML, CSS and JS that the builder produces are copied into thinqi pages by hand, and the template is the reference for them. The builder holds its own copy of that code, so the two can drift.

```bash
npm run check
```

This fails if any of these disagree:

- the version in `BUILDER_VERSION`, the newest `CHANGELOG` release, the `template.css` / `template.js` headers and `data-base-version` in `template/index.html`;
- `template/template.css` versus the builder's base CSS plus every block's CSS (comments and whitespace ignored);
- `template/template.js` versus the builder's base JS plus every block's JS;
- the CDN includes in the base HTML versus `template/index.html`.

It also syntax-checks `builder.js` and `template/template.js`. Run it before and after every refactoring step.

## Local preview

```bash
npm run serve
```

## Publishing

1. In the repository settings, open Pages, choose "Deploy from a branch", select `main` and `/ (root)`, then save.
2. The builder is served at `https://<user>.github.io/<repo>/` and the template at `.../<repo>/template/`.
