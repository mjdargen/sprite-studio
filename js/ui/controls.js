/*
  Wiring the fixed controls in index.html to the state.

  Any element with data-setting="a.b.c" reads and writes state.a.b.c:
    - checkboxes          true / false
    - radio buttons       the checked one's value
    - number and range    a number (ignored while the box is empty)
    - <select data-type="number">  a number
    - everything else     the text
  Any element with data-show="a.b.c" shows state.a.b.c as its text.

  So to add a setting: put a default in js/state.js, add a control with
  data-setting in index.html, and read the value where it's needed.
*/

import { state, requestRender } from "../state.js";

/** Read a value from an object by a dotted path: getPath(state, "settings.crop.left"). */
export function getPath(object, path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), object);
}

/** Set a value in an object by a dotted path. */
export function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((value, key) => value[key], object);
  parent[last] = value;
}

/**
 * Listen to every data-setting control. `onChange(path, value)` is called
 * after the state changes, before the redraw, for settings that need more
 * than a redraw (like switching mode).
 */
export function bindControls(onChange = () => {}) {
  for (const el of document.querySelectorAll("[data-setting]")) {
    const update = () => {
      const value = readControl(el);
      if (value === undefined) return;
      const path = el.dataset.setting;
      if (getPath(state, path) === value) return;
      setPath(state, path, value);
      onChange(path, value);
      requestRender();
    };
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  }
  syncControls();
}

/** The value a control holds, or undefined if it doesn't hold one right now. */
function readControl(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.type === "radio") return el.checked ? el.value : undefined;
  if (el.type === "number" || el.type === "range" || el.dataset.type === "number") {
    if (el.value.trim() === "") return undefined; // still typing
    let number = parseFloat(el.value);
    if (!Number.isFinite(number)) return undefined;
    if (el.min !== "" && el.min !== undefined) number = Math.max(parseFloat(el.min), number);
    if (el.max !== "" && el.max !== undefined) number = Math.min(parseFloat(el.max), number);
    return number;
  }
  return el.value;
}

/**
 * Make every control show what's in the state, e.g. after the example is
 * loaded. The control being typed in is left alone.
 */
export function syncControls() {
  for (const el of document.querySelectorAll("[data-setting]")) {
    if (el === document.activeElement && (el.type === "text" || el.type === "number")) continue;
    const value = getPath(state, el.dataset.setting);
    if (el.type === "checkbox") el.checked = Boolean(value);
    else if (el.type === "radio") el.checked = el.value === String(value);
    else el.value = String(value);
  }
  for (const el of document.querySelectorAll("[data-show]")) {
    el.textContent = String(getPath(state, el.dataset.show));
  }
}
