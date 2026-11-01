/*
  Helpers for building the page with JavaScript.

  The panels that change with the selected file (step 2, the lists) are built
  from scratch on every redraw with h(), then put on the page with rebuild().
  Building from scratch keeps the code simple: each panel is one function that
  turns the state into elements, with no "update this bit" logic.
*/

/** Shortcut for document.getElementById. */
export const $ = (id) => document.getElementById(id);

/**
 * Make an element.
 *   h("button", { class: "small", onclick: save }, "Save")
 *   h("input", { type: "number", id: "fw", value: 32, min: 1 })
 *
 * - Props starting with "on" become event listeners (onclick, oninput, ...).
 * - Props that are true/false/numbers (checked, disabled, value, ...) are set
 *   as properties; strings are set as attributes. null/undefined/false are skipped.
 * - Children can be strings, elements, arrays of them, or null (skipped).
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "class") el.className = value;
    else if (key === "style") el.style.cssText = value;
    else if (typeof value !== "string" && key in el) el[key] = value;
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) el.append(child);
  }
  return el;
}

/**
 * Replace everything inside `container` with `children`.
 *
 * If the student was typing in one of the old inputs, the new input with the
 * same id gets the focus, the text and the cursor position back, so redrawing
 * while they type doesn't interrupt them. That's why every input built with
 * h() needs a stable id.
 */
export function rebuild(container, ...children) {
  const active = document.activeElement;
  let keep = null;
  if (active && active.id && container.contains(active)) {
    keep = { id: active.id, value: active.value, start: null, end: null };
    try {
      keep.start = active.selectionStart;
      keep.end = active.selectionEnd;
    } catch {
      // number inputs don't have a cursor position
    }
  }

  container.replaceChildren(...children.flat(Infinity).filter(Boolean));

  if (keep) {
    const el = document.getElementById(keep.id);
    if (!el) return;
    if (el.type === "text" || el.type === "number") el.value = keep.value;
    el.focus({ preventScroll: true });
    if (keep.start !== null) {
      try {
        el.setSelectionRange(keep.start, keep.end);
      } catch {
        // not a text input
      }
    }
  }
}

/** Make an id safe to use in HTML from any text (e.g. an animation id "3:rows:0"). */
export function safeId(text) {
  return String(text).replace(/[^a-zA-Z0-9_-]/g, "-");
}
