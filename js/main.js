/*
  Sprite Studio: where everything starts.

  The app works in a loop:

     student changes something  ->  the state changes (js/state.js)
                                ->  requestRender()
                                ->  render() below:
                                      1. work out every file's animations (core/layouts.js)
                                      2. build the sheet (core/sprite-sheet.js or core/tile-sheet.js)
                                      3. redraw every part of the page (ui/*.js)

  Building from scratch every time keeps things simple: no part of the page
  can show something out of date. Slow steps (removing the background,
  cutting up a sheet) are cached in js/core/prepare.js, so it stays quick.

  Folders:
    js/formats/  reading each kind of file
    js/core/     the work: slicing, cleaning up, building, writing code
    js/ui/       the page: one file per panel
    js/util/     small helpers used everywhere
  See MAINTAINING.md for more.
*/

import { state, setRenderHandler, requestRender, DEFAULT_SETTINGS } from "./state.js";
import { prepare } from "./core/prepare.js";
import { applyLayout } from "./core/layouts.js";
import { createSource } from "./core/sources.js";
import { buildSpriteSheet } from "./core/sprite-sheet.js";
import { buildTileSheet } from "./core/tile-sheet.js";
import { bindControls, syncControls } from "./ui/controls.js";
import { setUpFileInputs, drawFileList, clearSources } from "./ui/files-panel.js";
import { drawGridPanel } from "./ui/grid-panel.js";
import { drawAnimPanel } from "./ui/anim-panel.js";
import { setUpSourceView, drawSourceView } from "./ui/source-view.js";
import { setUpSheetView, drawSheetView } from "./ui/sheet-view.js";
import { drawOrderList } from "./ui/order-list.js";
import { setUpPlayer, drawPlayer } from "./ui/player.js";
import { drawTileCheck } from "./ui/tile-check.js";
import { setUpSavePanel, drawSavePanel } from "./ui/save-panel.js";
import { drawMessages } from "./ui/messages.js";
import { EXAMPLES, loadExampleSpec, exampleUrl } from "./example.js";
import { $ } from "./util/dom.js";

/* ---------- Rebuilding and redrawing ---------- */

/** How long to wait after a change before redrawing, so typing stays smooth. */
const RENDER_DELAY_MS = 80;
let renderTimer = null;

function scheduleRender(options = {}) {
  clearTimeout(renderTimer);
  if (options.now) render();
  else renderTimer = setTimeout(render, RENDER_DELAY_MS);
}

function render() {
  clearTimeout(renderTimer);
  document.body.dataset.mode = state.mode;

  // 1-2. Work out the animations and build the sheet
  state.messages.buildError = null;
  try {
    for (const source of state.sources) applyLayout(source, prepare(source, state.settings.background));
    fixSelection();
    state.result = state.mode === "sprites" ? buildSpriteSheet(state) : buildTileSheet(state);
  } catch (error) {
    console.error(error);
    state.result = null;
    state.messages.buildError = error.message;
  }

  // 3. Redraw the page
  syncControls();
  drawFileList();
  drawGridPanel();
  drawAnimPanel();
  drawSourceView();
  drawSheetView();
  drawOrderList();
  drawPlayer();
  drawTileCheck();
  drawSavePanel();
  drawMessages();
}

/** Make sure the selected file and animation still exist. */
function fixSelection() {
  let source = state.sources.find((s) => s.id === state.selectedSourceId);
  if (!source) {
    source = state.sources[0];
    state.selectedSourceId = source ? source.id : null;
  }
  if (!source || !source.anims.some((a) => a.id === state.selectedAnimId)) {
    state.selectedAnimId = source && source.anims.length ? source.anims[0].id : null;
  }
}

/* ---------- The examples ---------- */

/**
 * Show the example for the current mode. The settings start at their
 * defaults, so the slime's pink background shows until the student removes
 * it in step 3 (the warning under the sheet tells them how).
 */
async function loadExample() {
  const mode = state.mode;
  const spec = await loadExampleSpec(mode);
  // Give up if the file is missing, or the student added files or changed
  // mode while it was loading
  if (!spec || state.mode !== mode || (state.sources.length && !state.isExample)) return;

  clearSources();
  state.settings = structuredClone(DEFAULT_SETTINGS);
  const source = createSource(spec, mode);
  // Give the rows their names and speeds (applyLayout keeps them, by id)
  source.anims = EXAMPLES[mode].animations.map((a) => ({
    id: `${source.id}:rows:${a.key}`, name: a.name, cells: [], fps: a.fps, loop: true,
  }));
  state.sources.push(source);
  state.selectedSourceId = source.id;
  state.isExample = true;
  $("example-download").href = exampleUrl(mode);
  $("example-download").download = EXAMPLES[mode].file;
  requestRender({ now: true });
}

/* ---------- Starting up ---------- */

setRenderHandler(scheduleRender);

bindControls((path) => {
  if (path === "mode") {
    state.view.selectedTile = 0;
    // The example changes to match; the student's own files stay
    if (state.isExample || !state.sources.length) loadExample();
  }
});
setUpFileInputs();
setUpSourceView();
setUpSheetView();
setUpPlayer();
setUpSavePanel();
window.addEventListener("resize", () => scheduleRender());

loadExample();
render();
