// Gives Node the one browser API the generators use (DOMParser).
import { parseHTML } from "linkedom";
globalThis.DOMParser = parseHTML("<html></html>").DOMParser;
