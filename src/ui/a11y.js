// Gives every <label> a real association with the control that follows it, so
// clicking a label focuses its input and screen readers announce it.
let counter = 0;

export function associateLabels(root) {
  root.querySelectorAll("label").forEach((label) => {
    if (label.htmlFor || label.querySelector("input, select, textarea")) return;
    const next = label.nextElementSibling;
    if (next && next.matches("input, select, textarea")) {
      if (!next.id) next.id = `f-${++counter}`;
      label.htmlFor = next.id;
    }
  });
}

export const uniqueId = (prefix) => `${prefix}-${++counter}`;
