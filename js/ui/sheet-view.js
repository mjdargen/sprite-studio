/*
  The finished sheet preview, exactly as it will be downloaded, plus its
  frame or tile lines and (in tiles mode) tile numbers.

  Clicking a frame plays that animation in the player; clicking a tile shows
  it in the tile check.
*/

import { state, requestRender } from "../state.js";
import { $ } from "../util/dom.js";
import { fitZoom, zoomLabel, stageSize, drawZoomed, clearView, themeColor, artPoint, outline, label } from "../util/view.js";
import { sheetName } from "../core/naming.js";

let shownZoom = 1;

export function setUpSheetView() {
  $("sheet-canvas").addEventListener("click", (event) => {
    const result = state.result;
    if (!result) return;
    const point = artPoint(event, $("sheet-canvas"), shownZoom);
    if (state.mode === "sprites") {
      const row = result.rows[Math.floor(point.y / result.cellHeight)];
      if (row) {
        state.player.animId = row.animId;
        state.player.frame = Math.min(Math.floor(point.x / result.cellWidth), row.frames.length - 1);
        state.selectedSourceId = row.sourceId;
        state.selectedAnimId = row.animId;
      }
    } else {
      const index = Math.floor(point.y / result.tileHeight) * result.columns + Math.floor(point.x / result.tileWidth);
      if (index < result.count) state.view.selectedTile = index;
    }
    requestRender({ now: true });
  });
}

export function drawSheetView() {
  const canvas = $("sheet-canvas");
  const stage = $("sheet-stage");
  const result = state.result;
  stage.classList.toggle("clickable", Boolean(result));
  if (!result) {
    clearView(canvas);
    $("sheet-stats").textContent = state.sources.length ? "" : "Add some art in step 1 to start.";
    return;
  }

  const room = stageSize(stage, 560);
  shownZoom = fitZoom(result.sheet.width, result.sheet.height, room.width, room.height);
  const ctx = drawZoomed(canvas, result.sheet, shownZoom);
  const accent = themeColor("--accent");
  const name = sheetName(state);

  if (state.mode === "sprites") {
    if (state.view.showLines) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      result.rows.forEach((row, r) => {
        for (let c = 0; c < row.frames.length; c++) {
          outline(ctx, shownZoom, c * result.cellWidth, r * result.cellHeight, result.cellWidth, result.cellHeight);
        }
      });
      ctx.globalAlpha = 1;
    }
    const rows = result.rows.length;
    $("sheet-stats").textContent =
      `${name}.png · ${result.sheet.width}×${result.sheet.height} · frames ${result.cellWidth}×${result.cellHeight} · ` +
      `${rows} row${rows === 1 ? "" : "s"} · shown at ${zoomLabel(shownZoom)}`;
    return;
  }

  // Tiles mode
  const { tileWidth: tw, tileHeight: th, columns, count } = result;
  const numbers = state.view.tileNumbers && tw * shownZoom >= 22 && th * shownZoom >= 16;
  for (let i = 0; i < count; i++) {
    if (!result.tiles[i]) continue; // an empty space after a narrower file
    const x = (i % columns) * tw;
    const y = Math.floor(i / columns) * th;
    if (state.view.showLines) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      outline(ctx, shownZoom, x, y, tw, th);
      ctx.globalAlpha = 1;
    }
    if (numbers) label(ctx, String(i), x * shownZoom + 1, y * shownZoom + 1, "rgba(0,0,0,0.6)", "#fff");
  }
  const selected = Math.min(state.view.selectedTile, count - 1);
  ctx.strokeStyle = themeColor("--mark");
  ctx.lineWidth = 2;
  outline(ctx, shownZoom, (selected % columns) * tw, Math.floor(selected / columns) * th, tw, th);

  const smallNote = state.view.tileNumbers && !numbers ? " · zoom too small to number the tiles" : "";
  $("sheet-stats").textContent =
    `${name}.png · ${result.sheet.width}×${result.sheet.height} · ${result.tiles.filter(Boolean).length} tiles of ${tw}×${th}, ` +
    `${columns} across · shown at ${zoomLabel(shownZoom)}${smallNote}`;
}
