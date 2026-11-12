// Input values for every block, in the shape the form produces (see collectValue in src/ui/fields.js).
// Each block has several variants so every branch of its generator is exercised.
// Snapshots of the output live in test/snapshots/; regenerate with `npm run snapshot:update`.

const rich = "<p>Opening <strong>paragraph</strong> with a <a href=\"https://example.org\" target=\"_blank\" rel=\"noopener noreferrer\">link</a>.</p><h3>A heading</h3><ul><li>One</li><li>Two</li></ul><p>Closing paragraph.</p>";
const richPlain = "<p>Just <em>one</em> paragraph.</p>";

const media = (over = {}) => ({ type: "image", imageUrl: "https://example.org/pic.png", imageAlt: "A \"quoted\" <alt>", imageSize: "standard", videoUrl: "", ...over });

const navCard = (over = {}) => ({
  iconUrl: "https://example.org/icon.png", iconAlt: "", description: "Learn what it means",
  buttonLabel: "Understand it", buttonUrl: "https://leadershipportal.heiw.wales/page", newTab: false,
  heading: "Agree direction", targetUrl: "https://example.org/direction", ...over,
});

export const FIXTURES = {
  section: {
    basic: { title: "Putting into practice" },
    special: { title: "  Q&A: What's <new>?  " },
  },
  "nav-cards": {
    standard: { cardsData: { style: "standard", autoNumber: true, cards: [navCard(), navCard({ buttonLabel: "Go external", buttonUrl: "https://example.org/x", newTab: true }), navCard({ buttonLabel: "" })] } },
    numbered: { cardsData: { style: "numbered", autoNumber: true, cards: [navCard(), navCard({ heading: "Create environments", newTab: true }), navCard({ heading: "" })] } },
    "numbered-unnumbered": { cardsData: { style: "numbered", autoNumber: false, cards: [navCard()] } },
    "standard-empty": { cardsData: { style: "standard", autoNumber: true, cards: [navCard({ buttonLabel: "" })] } },
    "numbered-empty": { cardsData: { style: "numbered", autoNumber: true, cards: [navCard({ heading: "" })] } },
  },
  "at-a-glance": {
    basic: { bullets: ["First point", "  ", "Second & <third>"] },
  },
  "hero-text": {
    basic: { content: rich },
    single: { content: richPlain },
    empty: { content: "" },
  },
  "image-text-section": {
    image: { media: media(), content: rich },
    "image-large": { media: media({ imageSize: "large" }), content: richPlain },
    video: { media: media({ type: "video", videoUrl: "https://www.youtube.com/watch?v=NSUm8ZhTBXY" }), content: richPlain },
    "video-short-id": { media: media({ type: "video", videoUrl: "NSUm8ZhTBXY" }), content: richPlain },
    none: { media: media({ type: "none" }), content: richPlain },
    "image-no-url": { media: media({ imageUrl: "" }), content: richPlain },
  },
  accordion: {
    named: { groupName: "Digital literacy resources", titles: ["Topic one", "Idea two", "Topic one", ""] },
    unnamed: { groupName: "", titles: ["Only item"] },
  },
  "icon-toggle": {
    named: { groupName: "Communication scenarios", items: [
      { iconUrl: "https://example.org/a.png", iconAlt: "", label: "Meetings", separateImage: false, panelImageUrl: "" },
      { iconUrl: "https://example.org/b.png", iconAlt: "Clinical icon", label: "Clinical", separateImage: true, panelImageUrl: "https://example.org/b-big.png" },
      { iconUrl: "https://example.org/c.png", iconAlt: "", label: "Meetings", separateImage: true, panelImageUrl: "" },
      { iconUrl: "", iconAlt: "", label: "", separateImage: false, panelImageUrl: "" },
    ] },
    unnamed: { groupName: "", items: [{ iconUrl: "https://example.org/a.png", iconAlt: "", label: "One", separateImage: false, panelImageUrl: "" }] },
  },
  "resource-cards": {
    mixed: { cards: [
      { imageUrl: "https://example.org/w.png", imageAlt: "", title: "A website", linkUrl: "https://example.org/site", newTab: true, type: "Website", duration: "" },
      { imageUrl: "https://example.org/a.png", imageAlt: "Alt", title: "An article", linkUrl: "https://ytydysgu.heiw.wales/article", newTab: true, type: "Article", duration: "5 Minutes" },
      { imageUrl: "https://example.org/a.png", imageAlt: "", title: "Same tab", linkUrl: "/local", newTab: false, type: "Page", duration: "2 Minutes" },
      { imageUrl: "", imageAlt: "", title: "", linkUrl: "", newTab: false, type: "", duration: "" },
    ] },
  },
  buttons: {
    mixed: { buttons: [
      { label: "Apply now", url: "https://example.org/apply", newTab: true },
      { label: "Stay here", url: "/stay", newTab: false },
      { label: "", url: "", newTab: false },
    ] },
  },
  "flex-section": {
    image: { content: rich, media: media({ imageAlt: "" }) },
    video: { content: richPlain, media: media({ type: "video", videoUrl: "https://youtu.be/NSUm8ZhTBXY" }) },
    other: { content: richPlain, media: media({ type: "other" }) },
    "image-no-url": { content: richPlain, media: media({ imageUrl: "" }) },
  },
  "two-column": {
    left: { flip: "media-left", media: media(), content: rich },
    right: { flip: "media-right", media: media({ type: "video", videoUrl: "https://www.youtube.com/shorts/NSUm8ZhTBXY" }), content: richPlain },
    other: { flip: "media-left", media: media({ type: "other" }), content: richPlain },
  },
};

// Raw Quill output, to check cleanQuillHTML() and markFirstParagraphLarge().
export const QUILL_SAMPLES = {
  lists: '<ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Bullet one</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Bullet two</li><li data-list="ordered"><span class="ql-ui" contenteditable="false"></span>Step one</li></ol><p><br></p>',
  classes: '<p class="ql-align-center ql-size-large keep">Styled</p>',
  newtab: '<p>See <a href="https://example.org" target="_blank" rel="noopener noreferrer">here</a> and <a href="/x">there</a>.</p>',
  empty: '<p><br></p>',
};
