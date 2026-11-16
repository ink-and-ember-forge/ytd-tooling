// The tours' content: which element each step points at, and what it says.
// The engine is tour.js. Add a view's tour here and give the view's id as the key;
// the header's "? Tour" button shows only for views that have one.
// Bodies are trusted HTML (our own text). `ctx` lets a step reach into the page: { setRail(open) }.
const active = (sel) => () => document.querySelector(".panel.active " + sel);

export function buildTours(ctx) {
  // Upgrade and Validate exist only in developer mode, so the tours mention them only then.
  const dev = !!ctx.devMode;
  return {
    build: [
      {
        title: "Welcome to the page builder",
        body: "<p>Each block on a Gwella page (a section, an accordion, a set of cards) has its own tab here. You fill in a form, watch the page appear, and copy the code into thinqi.</p><p>This tour takes about a minute. Use the <kbd>←</kbd> <kbd>→</kbd> keys to move and <kbd>Esc</kbd> to leave.</p>",
      },
      {
        target: "#tabbar",
        title: "Pick a block",
        body: "<p>Blocks are grouped by purpose: Structure, Content, Interactive and Links. The builder remembers the last one you used.</p>",
        before: () => ctx.setRail(true),
        placement: "right",
      },
      {
        target: active(".panel-form"),
        title: "Fill in the form",
        body: "<p>Everything updates as you type. There is no Generate button.</p><p>Lists (cards, steps, items) can be collapsed to one line, moved up or down, duplicated, or removed with an Undo.</p>",
      },
      {
        target: active(".preview-card"),
        title: "Watch it appear",
        body: "<p>This is the live preview. Switch between Desktop, Tablet and Phone widths to check it on each.</p><p><strong>Click anything in the preview</strong> and the builder jumps to the form field behind it. You can also pop the preview out into its own window for a second screen.</p>",
        placement: "left",
      },
      {
        target: active(".output-card"),
        title: "Copy the code",
        body: "<p>The HTML tab is what you paste into your thinqi page; <strong>Copy HTML</strong> is always in view. The CSS and JS tabs hold the block's styles and behaviour, which go into the page's base CSS and JS.</p><p>Some blocks also have an Explain tab, which annotates the code line by line.</p>",
        placement: "left",
      },
      {
        target: active(".panel-actions"),
        title: "How it works, and Reset",
        body: "<p><strong>ⓘ How it works</strong> explains the block in plain English. <strong>Reset this block</strong> clears the form, and you can undo it.</p>",
        placement: "bottom",
      },
      {
        target: ".theme-toggle",
        title: "Pick the theme",
        body: "<p>Switch between Gwella and Y Tŷ Dysgu. The whole builder takes on the theme's colour (burgundy or blue) so you always know which version you are building, and the base code you download matches.</p>",
        placement: "bottom",
      },
      {
        target: "#menu-base",
        title: "Base code",
        body: "<p>The base HTML, CSS and JS are pasted into a new thinqi page once. You can leave out the table of contents here.</p>",
        placement: "bottom",
      },
      {
        target: "#menu-project",
        title: "Your work is saved",
        body: "<p>Everything autosaves in this browser. To back it up or carry on from another computer, save the project to a file and load it back later.</p>",
        placement: "bottom",
      },
      {
        target: "#modes",
        title: "More tools",
        body: dev
          ? "<p><strong>Upgrade a page</strong> brings an old page up to the latest version. <strong>Validate code</strong> reports what is wrong with a page's code. <strong>What's changed</strong> lists every release.</p>"
          : "<p><strong>What's changed</strong> lists every release of the builder, newest first.</p>",
        placement: "bottom",
      },
      {
        target: "#tour-btn",
        title: "That's it",
        body: "<p>You can take this tour again from here whenever you like. It also has a short version for the What's changed page.</p>",
        placement: "bottom",
      },
    ],

    changelog: [
      {
        target: "#view-changelog .panel-desc",
        title: "What's changed",
        body: "<p>Release notes for the page builder, newest first. The current version is the newest release; there is no separate number to look up.</p><p>When something has changed since you last opened the builder, a short pop-up tells you so.</p>",
        placement: "bottom",
      },
      {
        target: "#view-changelog .release",
        title: "One card per release",
        body: "<p>Each release has a version, a date and a one-line summary. The number tells you how much to care:</p><ul><li><strong>Patch</strong> (3.4.<em>1</em>): a fix or a tidy-up.</li><li><strong>Minor</strong> (3.<em>5</em>.0): something new to use, or a design change you would notice.</li><li><strong>Major</strong> (<em>4</em>.0.0): pages have to be rebuilt.</li></ul>",
        placement: "bottom",
      },
      {
        target: "#view-changelog .change-card",
        title: "Each change, in plain English",
        body: "<p>A change has an id, a coloured type (additive, visual, behaviour, fix, breaking or tool-only) and a summary. The line under it says which part of the code it touches.</p>",
        placement: "bottom",
      },
      {
        target: "#view-changelog .change-type--action",
        title: "What your page needs",
        body: "<p>This tag says what to do about a change: copy the new code in, hand edit the page, or rebuild it in the tool. No tag means nothing to do.</p>",
        placement: "bottom",
      },
      ...(dev ? [{
        target: '.mode-btn[data-view="upgrade"]',
        title: "Updating an old page?",
        body: "<p><strong>Upgrade a page</strong> reads this same history to work out which changes apply to your page and what to do about each.</p>",
        placement: "bottom",
      }] : []),
    ],
  };
}
