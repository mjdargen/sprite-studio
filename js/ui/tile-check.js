/*
  The tile check (tiles mode): the selected tile repeated in a 4 x 3 block,
  so students can see whether its edges join up without seams, and that the
  cut is in the right place (a wrong tile size shows up as broken patterns).
*/

import { state } from "../state.js";
import { $ } from "../util/dom.js";
import { newCanvas, context } from "../util/canvas.js";
import { fitZoom, zoomLabel, stageSize, drawZoomed, clearView } from "../util/view.js";

const ACROSS = 4;
const DOWN = 3;

export function drawTileCheck() {
  const canvas = $("tile-canvas");
  const result = state.result;
  if (state.mode !== "tiles" || !result) {
    clearView(canvas);
    $("tile-stats").textContent = "";
    return;
  }

  const index = Math.min(Math.max(0, state.view.selectedTile), result.count - 1);
  const { tileWidth: tw, tileHeight: th, columns } = result;
  const sx = (index % columns) * tw;
  const sy = Math.floor(index / columns) * th;

  const block = newCanvas(tw * ACROSS, th * DOWN);
  const ctx = context(block);
  for (let y = 0; y < DOWN; y++) {
    for (let x = 0; x < ACROSS; x++) ctx.drawImage(result.sheet, sx, sy, tw, th, x * tw, y * th, tw, th);
  }

  const room = stageSize($("tile-stage"), 320);
  const zoom = fitZoom(block.width, block.height, room.width, room.height);
  drawZoomed(canvas, block, zoom);
  $("tile-stats").textContent = `tile ${index} · ${tw}×${th} · shown at ${zoomLabel(zoom)}`;
}
