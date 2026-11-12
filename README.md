# YTD tools

Static site for the Gwella page builder and its reference template. Hosted with GitHub Pages.

- `index.html`, `builder.css`, `builder.js`: the page builder (root of the site).
- `template/`: the reference template page, opened from the builder's "Open template" button.

## Publishing

1. Create a repository and copy these files into its root (keep the `template/` folder).
2. In the repository settings, open Pages, choose "Deploy from a branch", select `main` and `/ (root)`, then save.
3. The builder is served at `https://<user>.github.io/<repo>/` and the template at `.../<repo>/template/`.

The base HTML, CSS and JS that the builder produces are copied into thinqi pages by hand. Keep them in step with the reference template.
