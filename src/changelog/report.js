// The final report of a migration: what was decided about every place the page differed from the template, and why. It is
// what an author keeps (or hands to the team), so it records the REASONS, says which of the changes you will actually SEE on the
// page, lists what is still worth a look, and says what the page now takes from the template. Pure: the date is passed in.
import { BUILDER_VERSION } from "./index.js";
import { THEMES } from "./migrate.js";
import { REASONS } from "./review.js";

const reasonLabel = (id) => (REASONS.find(([k]) => k === id) || REASONS[2])[1];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// "not set" means the template has no rule for that EXACT selector; the measured values below say what it really gives here.
const line = (l) => `${l.media ? "On small screens: " : ""}${l.where} — ${l.label}: yours \`${l.mine}\`, template \`${l.template ?? "not set"}\``;
const shown = (v) => (v === "" || v == null ? "not set" : v);
const measuredLine = (m) => `${m.label}: the template gives \`${shown(m.template)}\`, yours gives \`${shown(m.yours)}\``;

// How a rule's measured effect on this page groups it: what you will see, what makes no difference, or what could not be previewed.
const groupOf = (impact) => (impact.status === "differs" ? "differs" : impact.status === "same" || impact.status === "none" ? "same" : "unchecked");
const IMPACT_NOTE = {
  unmeasured: "Not previewed: this rule was decided without its preview (for example by choosing the template for the rest), so its effect on the page was not measured.",
  state: "Only applies on hover or focus, which cannot be previewed here.",
  screen: "Only applies on a different screen size from the one previewed.",
};

// migration: buildMigration() result. steps: buildReview(). decisions: Map(row id -> { choice, reason, note }): one decision
// per RULE (a row of a step), so the report says what was decided about each.
// measured: Map(row id -> the summary the preview measured: { status, n, differing, text, lines[] }), for the rules that were
// previewed. Without it a rule's effect is "not previewed".
export function buildReport(migration, steps, decisions, { date, measured = new Map() }) {
  const decided = (s) => decisions.get(s.id) || { choice: "template", reason: "", note: "" };
  const impactOf = (row) => {
    const m = measured.get(row.id);
    if (!m) return { status: "unmeasured", text: IMPACT_NOTE.unmeasured, lines: [] };
    const text = m.status === "differs" || m.status === "same" || m.status === "none" ? m.text : IMPACT_NOTE[m.status] || m.text;
    return { status: m.status, text, differing: m.differing, n: m.n, lines: (m.lines || []).filter((l) => l.measurable && l.differs) };
  };
  const rows = steps.flatMap((st) => st.rows.map((r) => ({ ...r, title: r.path, step: st.title, impact: impactOf(r) })));
  const kept = rows.filter((s) => decided(s).choice === "keep");
  const template = rows.filter((s) => decided(s).choice !== "keep");
  const components = migration.groups.filter((g) => g.kind === "custom");
  const differences = migration.groups.filter((g) => g.kind === "deviation").length;
  const lint = migration.lint;

  // The rules that follow the template, those you will see first.
  const order = { differs: 0, unchecked: 1, same: 2 };
  const byImpact = (a, b) => order[groupOf(a.impact)] - order[groupOf(b.impact)];
  const templateSorted = [...template].sort(byImpact);
  const templateGroups = { differs: [], same: [], unchecked: [] };
  templateSorted.forEach((s) => templateGroups[groupOf(s.impact)].push(s));

  const toCheck = [];
  for (const s of kept) {
    const d = decided(s);
    if (d.reason === "unsure") toCheck.push(`Revisit "${s.title}": you kept it but weren't sure why.`);
    else if (d.reason === "problem" && !d.note.trim()) toCheck.push(`"${s.title}" was kept to fix a problem, but no note says which. Add one in the CSS comment so it can be re-tested later.`);
    else if (!d.note.trim()) toCheck.push(`"${s.title}" was kept without a note. Say what it is for in the CSS comment, so the next person to see it knows.`);
  }
  for (const g of components.filter((c) => !c.kept)) toCheck.push(`Not carried: ${g.key}. Anything using it has lost its styling.`);
  if (lint.missingFunctions?.length) toCheck.push(`The HTML calls ${lint.missingFunctions.map((f) => `${f}()`).join(", ")}, which the JS doesn't define, so those controls do nothing.`);
  if (lint.unstyledClasses.length) toCheck.push(`No styling left for: ${lint.unstyledClasses.map((c) => `.${c}`).join(", ")}.`);
  if (lint.undefinedVars.length) toCheck.push(`CSS variables used but never defined: ${lint.undefinedVars.join(", ")}.`);
  if (lint.tagProblems.length) toCheck.push(`${plural(lint.tagProblems.length, "problem", "problems")} in the page's own HTML tags (first: ${lint.tagProblems[0]})`);
  migration.notes.forEach((n) => toCheck.push(n));

  return {
    date, version: BUILDER_VERSION, theme: migration.theme ? THEMES[migration.theme].label : "not chosen",
    totals: {
      differences, decisions: steps.reduce((n, s) => n + s.rows.length, 0), kept: kept.length, template: template.length,
      visible: templateGroups.differs.length, invisible: templateGroups.same.length, unchecked: templateGroups.unchecked.length,
      components: components.length, componentsKept: components.filter((c) => c.kept).length, htmlChanges: migration.htmlChanges.length,
    },
    kept: kept.map((s) => ({ title: s.title, reason: reasonLabel(decided(s).reason), note: decided(s).note.trim(), elements: s.elements, lines: s.lines, linked: s.linked, impact: s.impact })),
    template: templateSorted.map((s) => ({ title: s.title, elements: s.elements, lines: s.lines, impact: s.impact })),
    templateGroups: Object.fromEntries(Object.entries(templateGroups).map(([k, v]) => [k, v.map((s) => ({ title: s.title, elements: s.elements, lines: s.lines, impact: s.impact }))])),
    components: components.map((g) => ({ name: g.key, kept: g.kept })),
    dropped: { unused: migration.dropped.unused.length },
    htmlChanges: migration.htmlChanges.map((c) => c.summary),
    toCheck,
  };
}

const entry = (s, heading) => {
  const out = [`${heading} ${s.title}`, ""];
  if (s.elements !== null) out.push(`Affects ${plural(s.elements, "element", "elements")}.`, "");
  if (s.impact?.text) out.push(`**On this page:** ${s.impact.text}`);
  (s.impact?.lines || []).forEach((m) => out.push(`- Measured: ${measuredLine(m)}`));
  if (s.impact?.text) out.push("");
  out.push("What your rule sets:", "", ...s.lines.map((l) => `- ${line(l)}`), "");
  return out;
};

export function reportMarkdown(r) {
  const t = r.totals, out = [];
  out.push("# Migration report", "", `Migrated to template version ${r.version} · theme ${r.theme} · ${r.date}`, "");
  out.push("## Summary", "");
  out.push(`- The page differed from the template in ${plural(t.differences, "place", "places")}, decided as ${plural(t.decisions, "rule", "rules")} (rules that depend on each other are decided together).`);
  out.push(`- **Kept as your own: ${t.kept}.** Following the template: ${t.template}.`);
  if (t.template) out.push(`- Of the ${plural(t.template, "rule", "rules")} following the template, **${t.visible} change how the page looks**, ${t.invisible} make no visible difference, and ${t.unchecked} could not be checked (not previewed, or only on hover or another screen size).`);
  out.push(`- Your own components carried over: ${t.componentsKept} of ${t.components}.`);
  out.push(`- ${plural(t.htmlChanges, "change", "changes")} to the HTML. ${r.dropped.unused ? `Dropped ${plural(r.dropped.unused, "rule", "rules")} for classes not used on the page.` : "No rules for unused classes were dropped."}`, "");

  out.push(`## Kept as your own (${t.kept})`, "");
  if (!r.kept.length) out.push("Nothing: the page follows the template everywhere.", "");
  for (const k of r.kept) {
    out.push(`### ${k.title}`, "", `- **Why:** ${k.reason}${k.note ? `. ${k.note}` : ""}`);
    if (k.elements !== null) out.push(`- **Affects:** ${plural(k.elements, "element", "elements")} on this page`);
    if (k.impact?.text) out.push(`- **On this page:** ${k.impact.text}`);
    (k.impact?.lines || []).forEach((m) => out.push(`- **Measured:** ${measuredLine(m)}`));
    k.linked.forEach((l) => out.push(`- **Works together:** ${l}`));
    out.push("- **What it overrides:**", ...k.lines.map((l) => `  - ${line(l)}`), "");
  }

  out.push(`## Following the template (${t.template})`, "", "The page now takes these from the template, so it matches every other page. This is what changes compared with how it was built. `not set` means the template has no rule for that exact selector; the measured values say what it really gives on this page.", "");
  if (!r.template.length) out.push("Nothing: every difference was kept.", "");
  const sections = [["differs", "Changes you will see"], ["unchecked", "Could not be checked"], ["same", "No visible difference on this page"]];
  for (const [key, label] of sections) {
    const list = r.templateGroups?.[key] || [];
    if (!list.length) continue;
    out.push(`### ${label} (${list.length})`, "");
    list.forEach((s) => out.push(...entry(s, "####")));
  }

  out.push(`## Your own components (${t.components})`, "");
  if (!r.components.length) out.push("None.", "");
  else out.push(...r.components.map((c) => `- ${c.name}: ${c.kept ? "carried over" : "**not carried**"}`), "");

  if (r.htmlChanges.length) out.push("## Changes to your HTML", "", ...r.htmlChanges.map((c) => `- ${c}`), "");
  out.push("## Still worth a look", "");
  out.push(...(r.toCheck.length ? r.toCheck.map((c) => `- ${c}`) : ["Nothing flagged."]), "");
  return out.join("\n");
}
