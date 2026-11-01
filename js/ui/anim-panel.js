/*
  Step 2, second half (sprites mode): the animations made from the selected
  file.

  At the top, "Make animations from" picks a layout (js/core/layouts.js).
  Below, each animation has its name, its frames as text ("0-3, 5"), its
  speed and whether it plays once. Clicking an animation selects it; then
  clicking frames in "Your file" adds or removes them (js/ui/source-view.js).

  Changing an animation's frames, deleting one or adding one switches the
  file to the "Frames I pick" layout, so the change isn't undone the next
  time the layout is worked out.
*/

import { state, selectedSource, requestRender } from "../state.js";
import { $, h, rebuild, safeId } from "../util/dom.js";
import { layoutChoices } from "../core/layouts.js";
import { parseFrameList, formatFrameList } from "../core/frame-list.js";
import { newAnimId } from "../core/sources.js";
import { prepare } from "../core/prepare.js";

/** Text typed into a frames box that isn't valid yet, by animation id. */
const draftFrames = new Map();

export function drawAnimPanel() {
  const panel = $("anim-panel");
  const source = selectedSource();
  if (!source || state.mode !== "sprites") {
    rebuild(panel);
    return;
  }
  const count = prepare(source, state.settings.background).count;

  const layoutSelect = h("select", {
    id: "layout",
    onchange: (event) => {
      source.layout = event.target.value;
      requestRender({ now: true });
    },
  }, layoutChoices(source).map(([value, text]) => h("option", { value, selected: value === source.layout }, text)));

  const usesEmptyRule = ["rows", "columns", "across", "down"].includes(source.layout);
  const skipEmpty = usesEmptyRule && h("label", { class: "choice" },
    h("input", {
      type: "checkbox", id: "skip-empty", checked: source.skipEmpty,
      onchange: (event) => { source.skipEmpty = event.target.checked; requestRender({ now: true }); },
    }),
    " Leave out empty frames at the end of a row");

  const items = source.anims.map((anim, index) => animItem(source, anim, index, count));

  const add = h("button", {
    type: "button", class: "small",
    onclick: () => {
      source.layout = "own";
      const anim = { id: newAnimId(source), name: `animation_${source.anims.length + 1}`, cells: [], fps: source.fps, loop: true };
      source.anims.push(anim);
      state.selectedAnimId = anim.id;
      requestRender({ now: true });
    },
  }, "+ Add an animation");

  rebuild(panel,
    h("div", { class: "field" }, h("label", { for: "layout" }, "Make animations from"), layoutSelect),
    skipEmpty,
    h("div", { class: "list" }, items),
    h("div", { class: "toolbar" }, add),
    h("p", { class: "hint" },
      "Select an animation, then click frames in “Your file” to add or remove them. " +
      "Shift-click adds a frame again. Frames are numbered from 0."));
}

/** One animation's little form. */
function animItem(source, anim, index, count) {
  const id = safeId(anim.id);
  const selected = anim.id === state.selectedAnimId;
  const draft = draftFrames.get(anim.id);
  const shownFrames = draft !== undefined ? draft.text : formatFrameList(anim.cells);

  const nameBox = h("input", {
    type: "text", id: `anim-name-${id}`, value: anim.name, spellcheck: false, autocomplete: "off",
    "aria-label": "Animation name",
    oninput: (event) => { anim.name = event.target.value; requestRender(); },
  });

  const framesBox = h("input", {
    type: "text", id: `anim-frames-${id}`, class: "mono", value: shownFrames, spellcheck: false, autocomplete: "off",
    "aria-invalid": draft ? "true" : "false",
    oninput: (event) => {
      const parsed = parseFrameList(event.target.value, count);
      if (parsed.error) {
        draftFrames.set(anim.id, { text: event.target.value, error: parsed.error });
      } else {
        draftFrames.delete(anim.id);
        anim.cells = parsed.cells;
        source.layout = "own";
      }
      requestRender();
    },
    onblur: (event) => {
      // Leaving the box with a mistake in it goes back to the last good frames.
      // Redrawing the panel also causes a blur (the old box is removed), but
      // then the new box has the focus straight after, so check that first.
      const boxId = event.target.id;
      setTimeout(() => {
        if (document.activeElement && document.activeElement.id === boxId) return;
        if (draftFrames.delete(anim.id)) requestRender();
      });
    },
  });

  const fpsBox = h("input", {
    type: "number", id: `anim-fps-${id}`, min: 1, max: 60, value: anim.fps,
    oninput: (event) => {
      const fps = parseInt(event.target.value, 10);
      if (fps >= 1 && fps <= 60) { anim.fps = fps; requestRender(); }
    },
  });

  const onceBox = h("input", {
    type: "checkbox", id: `anim-once-${id}`, checked: !anim.loop,
    onchange: (event) => { anim.loop = !event.target.checked; requestRender({ now: true }); },
  });

  const remove = h("button", {
    type: "button", class: "small", "aria-label": `Delete ${anim.name}`,
    onclick: (event) => {
      event.stopPropagation();
      source.layout = "own";
      source.anims.splice(index, 1);
      if (state.selectedAnimId === anim.id) state.selectedAnimId = null;
      requestRender({ now: true });
    },
  }, "Delete");

  return h("div", {
    class: "item anim" + (selected ? " selected" : ""),
    onclick: (event) => {
      if (state.selectedAnimId === anim.id) return;
      state.selectedAnimId = anim.id;
      state.player.animId = anim.id;
      // Don't steal the focus from the box that was clicked
      if (!event.target.closest("input, button")) requestRender({ now: true });
      else requestRender();
    },
  },
    h("div", { class: "row" },
      h("div", { class: "field" }, nameBox),
      h("div", { class: "buttons" }, remove)),
    h("div", { class: "row" },
      h("div", { class: "field frames" }, h("label", { for: framesBox.id }, "Frames"), framesBox),
      h("div", { class: "field fps" }, h("label", { for: fpsBox.id }, "Speed (fps)"), fpsBox)),
    h("label", { class: "choice" }, onceBox, " Plays once (doesn't loop)"),
    draft ? h("p", { class: "field-error" }, draft.error) : null);
}
