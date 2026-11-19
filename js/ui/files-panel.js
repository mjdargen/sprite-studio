/*
  Step 1: adding files (the button, the drop zone, dropping anywhere on the
  page) and the list of files that have been added. In tiles mode the list
  has buttons to move files, since files are stacked in the tile sheet in
  this order.
*/

import { state, requestRender, DEFAULT_SETTINGS } from "../state.js";
import { $, h, rebuild } from "../util/dom.js";
import { loadFiles } from "../formats/index.js";
import { createSource, shareGrid } from "../core/sources.js";

/** Set up the file button and dragging and dropping. Call once. */
export function setUpFileInputs() {
  const input = $("file-input");
  $("choose-files").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    addFiles(input.files);
    input.value = ""; // so choosing the same file again still counts
  });

  // Files can be dropped anywhere on the page. While something is being
  // dragged over the page, the drop zone lights up.
  let dragDepth = 0;
  document.addEventListener("dragenter", (event) => {
    if (!hasFiles(event)) return;
    dragDepth++;
    document.body.classList.add("dragging");
  });
  document.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) document.body.classList.remove("dragging");
  });
  document.addEventListener("dragover", (event) => {
    if (hasFiles(event)) event.preventDefault(); // allows dropping
  });
  document.addEventListener("drop", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    document.body.classList.remove("dragging");
    addFiles(event.dataTransfer.files);
  });
}

function hasFiles(event) {
  return event.dataTransfer && Array.from(event.dataTransfer.types).includes("Files");
}

/** Load files and add them as sources. */
export async function addFiles(fileList) {
  if (!fileList || !fileList.length) return;
  const drop = $("drop-zone");
  drop.setAttribute("aria-busy", "true");
  const { specs, errors } = await loadFiles(fileList, {
    mode: state.mode,
    groupNumbered: state.settings.groupNumbered,
  });
  drop.removeAttribute("aria-busy");

  state.messages.loadErrors = errors;
  if (specs.length && state.isExample) {
    // The example's settings were for the example, so start the student's
    // files from the defaults (keeping the one setting that affected loading)
    const groupNumbered = state.settings.groupNumbered;
    clearSources();
    state.settings = structuredClone(DEFAULT_SETTINGS);
    state.settings.groupNumbered = groupNumbered;
  }
  for (const spec of specs) {
    const source = createSource(spec, state.mode);
    state.sources.push(source);
    state.selectedSourceId = source.id;
    state.selectedAnimId = null; // the first animation of the new file gets picked
  }
  // Tile sets that go in one tile sheet are cut the same way, so new ones
  // use the grid of the first one (fixing it in step 2 fixes them all)
  const firstSheet = state.sources.find((s) => s.kind === "sheet");
  if (state.mode === "tiles" && firstSheet) shareGrid(state.sources, firstSheet.grid);
  requestRender({ now: true });
}

/** Remove every source (and the example). */
export function clearSources() {
  state.sources = [];
  state.order = [];
  state.selectedSourceId = null;
  state.selectedAnimId = null;
  state.isExample = false;
}

/** Draw the list of added files. */
export function drawFileList() {
  const items = state.sources.map((source, index) => {
    const select = () => {
      state.selectedSourceId = source.id;
      state.selectedAnimId = null;
      requestRender({ now: true });
    };
    const remove = () => {
      state.sources.splice(index, 1);
      if (state.selectedSourceId === source.id) {
        state.selectedSourceId = state.sources.length ? state.sources[Math.max(0, index - 1)].id : null;
        state.selectedAnimId = null;
      }
      if (!state.sources.length) state.isExample = false;
      requestRender({ now: true });
    };
    const move = (to) => {
      [state.sources[index], state.sources[to]] = [state.sources[to], state.sources[index]];
      requestRender({ now: true });
    };
    const arrows = state.mode === "tiles" && state.sources.length > 1 && [
      h("button", { type: "button", class: "small", "aria-label": `Move ${source.name} up`, disabled: index === 0, onclick: () => move(index - 1) }, "↑"),
      h("button", { type: "button", class: "small", "aria-label": `Move ${source.name} down`, disabled: index === state.sources.length - 1, onclick: () => move(index + 1) }, "↓"),
    ];
    return h("div", { class: "item" + (source.id === state.selectedSourceId ? " selected" : "") },
      h("div", {},
        h("div", {
          class: "name pickable", role: "button", tabindex: "0", title: "Show this file",
          onclick: select,
          onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } },
        }, source.name),
        h("div", { class: "meta" }, source.note)),
      h("div", { class: "buttons" },
        arrows,
        h("button", { type: "button", class: "small", "aria-label": `Remove ${source.name}`, onclick: remove }, "Remove")));
  });
  rebuild($("file-list"), items);
  $("example-note").hidden = !state.isExample;
}
