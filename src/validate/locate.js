// Offsets to line and column, and the shape of a finding. Pure.

// locator(text).at(offset) -> { line, column } (both 1-based). Binary search over the line starts.
export function locator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return {
    lines: starts.length,
    at(offset) {
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid - 1; }
      return { line: lo + 1, column: offset - starts[lo] + 1 };
    },
  };
}

export const SEVERITIES = ["error", "warning", "info"];

// A finding, from offsets into one language's text:
//   { id, severity, language, line, column, endLine, endColumn, message, why?, related[], data? }
// `related` locations are { language, line, column, note } (the other site of a duplicate id, where an unclosed tag should have closed...).
export function makeFinding(loc, language, id, severity, start, end, message, { why = null, related = [], data = null } = {}) {
  const from = loc.at(start), to = loc.at(Math.max(start, end));
  return { id, severity, language, line: from.line, column: from.column, endLine: to.line, endColumn: to.column, message, why, related, data };
}

export const relatedAt = (loc, language, offset, note) => ({ language, ...loc.at(offset), note });
