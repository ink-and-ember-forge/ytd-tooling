// The final report of a migration: what was decided about every place the page differed from the template, and why. It is
// what an author keeps (or hands to the team), so it records the REASONS, lists what is still worth a look, and says what the
// page now takes from the template. Pure: the date is passed in.
import { BUILDER_VERSION } from "./index.js";
import { THEMES } from "./migrate.js";
import { REASONS } from "./review.js";

const reasonLabel = (id) => (REASONS.find(([k]) => k === id) || REASONS[2])[1];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const line = (l) => `${l.media ? "On small screens: " : ""}${l.where} — ${l.label}: yours \`${l.mine}\`, template \`${l.template ?? "not set"}\``;

// migration: buildMigration() result. steps: buildReview(). decisions: Map(step id -> { choice, reason, note }).
export function buildReport(migration, steps, decisions, { date }) {
  const decided = (s) => decisions.get(s.id) || { choice: "template", reason: "", note: "" };
  const kept = steps.filter((s) => decided(s).choice === "keep");
  const template = steps.filter((s) => decided(s).choice !== "keep");
  const components = migration.groups.filter((g) => g.kind === "custom");
  const differences = migration.groups.filter((g) => g.kind === "deviation").length;
  const lint = migration.lint;

  const toCheck = [];
  for (const s of kept) {
    const d = decided(s);
    if (d.reason === "unsure") toCheck.push(`Revisit "${s.title}": you kept it but weren't sure why.`);
    else if (d.reason === "problem" && !d.note.trim()) toCheck.push(`"${s.title}" was kept to fix a problem, but no note says which. Add one in the CSS comment so it can be re-tested later.`);
  }
  for (const g of components.filter((c) => !c.kept)) toCheck.push(`Not carried: ${g.key}. Anything using it has lost its styling.`);
  if (lint.missingFunctions?.length) toCheck.push(`The HTML calls ${lint.missingFunctions.map((f) => `${f}()`).join(", ")}, which the JS doesn't define, so those controls do nothing.`);
  if (lint.unstyledClasses.length) toCheck.push(`No styling left for: ${lint.unstyledClasses.map((c) => `.${c}`).join(", ")}.`);
  if (lint.undefinedVars.length) toCheck.push(`CSS variables used but never defined: ${lint.undefinedVars.join(", ")}.`);
  if (lint.tagProblems.length) toCheck.push(`${plural(lint.tagProblems.length, "problem", "problems")} in the page's own HTML tags (first: ${lint.tagProblems[0]})`);
  migration.notes.forEach((n) => toCheck.push(n));

  return {
    date, version: BUILDER_VERSION, theme: migration.theme ? THEMES[migration.theme].label : "not chosen",
    totals: { differences, decisions: steps.length, kept: kept.length, template: template.length, components: components.length, componentsKept: components.filter((c) => c.kept).length, htmlChanges: migration.htmlChanges.length },
    kept: kept.map((s) => ({ title: s.title, reason: reasonLabel(decided(s).reason), note: decided(s).note.trim(), elements: s.elements, lines: s.lines, linked: s.linked })),
    template: template.map((s) => ({ title: s.title, elements: s.elements, lines: s.lines })),
    components: components.map((g) => ({ name: g.key, kept: g.kept })),
    dropped: { unused: migration.dropped.unused.length },
    htmlChanges: migration.htmlChanges.map((c) => c.summary),
    toCheck,
  };
}

export function reportMarkdown(r) {
  const t = r.totals, out = [];
  out.push("# Migration report", "", `Migrated to template version ${r.version} · theme ${r.theme} · ${r.date}`, "");
  out.push("## Summary", "");
  out.push(`- The page differed from the template in ${plural(t.differences, "place", "places")}, grouped into ${plural(t.decisions, "decision", "decisions")}.`);
  out.push(`- **Kept as your own: ${t.kept}.** Following the template: ${t.template}.`);
  out.push(`- Your own components carried over: ${t.componentsKept} of ${t.components}.`);
  out.push(`- ${plural(t.htmlChanges, "change", "changes")} to the HTML. ${plural(r.dropped.unused, "rule", "rules")} for classes not used on the page were dropped.`, "");

  out.push(`## Kept as your own (${t.kept})`, "");
  if (!r.kept.length) out.push("Nothing: the page follows the template everywhere.", "");
  for (const k of r.kept) {
    out.push(`### ${k.title}`, "", `- **Why:** ${k.reason}${k.note ? `. ${k.note}` : ""}`);
    if (k.elements !== null) out.push(`- **Affects:** ${plural(k.elements, "element", "elements")} on this page`);
    k.linked.forEach((l) => out.push(`- **Works together:** ${l}`));
    out.push("- **What it overrides:**", ...k.lines.map((l) => `  - ${line(l)}`), "");
  }

  out.push(`## Following the template (${t.template})`, "", "The page now takes these from the template, so it matches every other page. This is what changes compared with how it was built.", "");
  if (!r.template.length) out.push("Nothing: every difference was kept.", "");
  for (const s of r.template) {
    out.push(`### ${s.title}`, "");
    if (s.elements !== null) out.push(`Affects ${plural(s.elements, "element", "elements")}.`, "");
    out.push(...s.lines.map((l) => `- ${line(l)}`), "");
  }

  out.push(`## Your own components (${t.components})`, "");
  if (!r.components.length) out.push("None.", "");
  else out.push(...r.components.map((c) => `- ${c.name}: ${c.kept ? "carried over" : "**not carried**"}`), "");

  if (r.htmlChanges.length) out.push("## Changes to your HTML", "", ...r.htmlChanges.map((c) => `- ${c}`), "");
  out.push("## Still worth a look", "");
  out.push(...(r.toCheck.length ? r.toCheck.map((c) => `- ${c}`) : ["Nothing flagged."]), "");
  return out.join("\n");
}
