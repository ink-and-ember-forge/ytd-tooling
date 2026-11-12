// Block registry. Order here is the tab order in the builder and the order
// block CSS/JS appear in the assembled template. To add a block, create
// src/blocks/<id>/ (see docs/ADDING-A-BLOCK.md) and add it to this list.
import section from "./section/index.js";
import navCards from "./nav-cards/index.js";
import atAGlance from "./at-a-glance/index.js";
import heroText from "./hero-text/index.js";
import imageTextSection from "./image-text-section/index.js";
import accordion from "./accordion/index.js";
import iconToggle from "./icon-toggle/index.js";
import resourceCards from "./resource-cards/index.js";
import buttons from "./buttons/index.js";
import flexSection from "./flex-section/index.js";
import twoColumn from "./two-column/index.js";


export const BLOCK_LIST = [
  section,
  navCards,
  atAGlance,
  heroText,
  imageTextSection,
  accordion,
  iconToggle,
  resourceCards,
  buttons,
  flexSection,
  twoColumn,
];

export const BLOCKS = Object.fromEntries(BLOCK_LIST.map((block) => [block.id, block]));
