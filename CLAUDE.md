# Working in this repo

- Read README.md and docs/ARCHITECTURE.md first.
- Run `npm test` before and after every change. The golden snapshots (`test/snapshots/golden.json`) pin every block's output; a failing snapshot means output changed. If that was intended, run `npm run snapshot:update` and review the diff.
- Template CSS/JS (`template/template.css`, `template.js`) are generated: edit `src/`, then `npm run build`. Never edit them directly.
- Base/block code changes need a changelog release and `npm run release` (see docs/RELEASING.md). Choose the version by the Versioning rules in changelog/SCHEMA.md: a fix is always a patch; something new to use or a noticeable design change is a minor; a major is only a page rebuild.
- The builder has no bundler: `src/` is loaded by the browser as ES modules. Keep `generateHTML` functions pure (no DOM) so they run in Node tests.
- UI changes: run `npm run test:e2e` (needs Playwright). It drives the real builder in a browser; add a check there for any new interaction.
- The sandbox may block the CDNs (Quill, Bootstrap); serve Quill locally when browser-testing.
