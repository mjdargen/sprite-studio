/*
  The "Your file" preview: the selected file with its grid drawn on top.

  What the outlines mean:
    thick accent outline + number   in the selected animation (the number is
                                    its place in the animation, from 1)
    thin accent outline             in another animation from this file
    gray veil                       not used
    dashed line                     the edges step 3 will cut off

  Clicking:
    - sprites mode: adds or removes the frame from the selected animation
      (shift-click adds it again, for animations like 0 1 2 1)
    - tiles mode: shows that tile in the tile check
    - after "Pick from your file": picks the background color

  The art is shown exactly as it is in the file, so the clean-up in step 3
  can be compared with the finished sheet below it.
*/

import { state, selectedSource, requestRender } from "../state.js";
import { $ } from "../util/dom.js";
import { newCanvas, context, rgbToHex } from "../util/canvas.js";
import { fitZoom, zoomLabel, stageSize, drawZoomed, clearView, themeColor, artPoint, outline, label } from "../util/view.js";
import { prepare } from "../core/prepare.js";
import { syncControls } from "./controls.js";
import { newAnimId } from "../core/sources.js";

/** Space between frames when separate frames are laid out to be shown. */
const FRAME_GAP = 2;

/** What's currently drawn, so clicks can be matched to frames. */
let shown = null; // { source, zoom, cells: [{ index, x, y, w, h }], original }

export function setUpSourceView() {
  const canvas = $("source-canvas");
  canvas.addEventListener("click", onClick);

  $("pick-color").addEventListener("click", () => {
    state.picking = !state.picking;
    requestRender({ now: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.picking) {
      state.picking = false;
      requestRender({ now: true });
    }
  });
}

export function drawSourceView() {
  const canvas = $("source-canvas");
  const stage = $("source-stage");
  const source = selectedSource();
  stage.classList.toggle("picking", state.picking);
  $("pick-color").setAttribute("aria-pressed", String(state.picking));
  $("pick-color").textContent = state.picking ? "Click a color in your file…" : "Pick from your file";

  if (!source) {
    clearView(canvas);
    shown = null;
    $("source-stats").textContent = "";
    $("source-hint").textContent = "";
    return;
  }

  const prepared = prepare(source, state.settings.background);
  const layout = source.kind === "sheet" ? sheetLayout(source, prepared) : framesLayout(source, prepared, stage);
  const room = stageSize(stage);
  const zoom = fitZoom(layout.picture.width, layout.picture.height, room.width, room.height);
  const ctx = drawZoomed(canvas, layout.picture, zoom);
  shown = { source, zoom, cells: layout.cells, original: layout.original };

  drawOverlay(ctx, source, prepared, layout.cells, zoom);

  stage.classList.toggle("clickable", !state.picking);
  $("source-stats").textContent = layout.stats + ` · shown at ${zoomLabel(zoom)}`;
  $("source-hint").textContent = state.mode === "sprites"
    ? "Outlined frames are in an animation; the numbered ones are in the selected animation. Click a frame to add or remove it."
    : "Each outlined square is a tile. Gray ones are left out.";
}

/** A sheet is shown as it is, with each grid cell's rectangle. */
function sheetLayout(source, prepared) {
  const cells = [];
  for (let i = 0; i < prepared.count; i++) {
    const rect = prepared.rect(i);
    if (rect) cells.push({ index: i, ...rect }); // an uneven sheet has empty spaces
  }
  return {
    picture: source.image,
    original: source.image,
    cells,
    stats: `${source.image.width}×${source.image.height} · ${prepared.cols} across × ${prepared.rows} down of ${source.grid.width}×${source.grid.height}`,
  };
}

/** Separate frames are laid out in rows, with a small gap, to fit the box. */
function framesLayout(source, prepared, stage) {
  const { width: fw, height: fh } = prepared.size;
  const room = stageSize(stage);
  // As many across as fit at 2x zoom, but at least enough to keep it from being very tall
  const fitAcross = Math.max(1, Math.floor(room.width / 2 / (fw + FRAME_GAP)));
  const across = Math.min(prepared.count, Math.max(fitAcross, Math.ceil(Math.sqrt(prepared.count))));
  const down = Math.ceil(prepared.count / across);
  const picture = newCanvas(across * (fw + FRAME_GAP) - FRAME_GAP, down * (fh + FRAME_GAP) - FRAME_GAP);
  const ctx = context(picture);
  const cells = [];
  for (let i = 0; i < prepared.count; i++) {
    const x = (i % across) * (fw + FRAME_GAP);
    const y = Math.floor(i / across) * (fh + FRAME_GAP);
    ctx.drawImage(source.frames[i], x, y);
    cells.push({ index: i, x, y, w: fw, h: fh });
  }
  return { picture, original: null, cells, stats: `${prepared.count} frames of ${fw}×${fh}` };
}

/** Draw the outlines, veils, numbers and crop lines described at the top. */
function drawOverlay(ctx, source, prepared, cells, zoom) {
  const accent = themeColor("--accent");
  const accentInk = themeColor("--accent-ink");
  const mark = themeColor("--mark");
  const crop = state.settings.crop;
  const cropping = crop.left || crop.right || crop.top || crop.bottom;

  // Where each cell is used: in the selected animation (and at which places),
  // or elsewhere. Animations don't matter in tiles mode.
  const sprites = state.mode === "sprites";
  const selected = sprites && source.anims.find((a) => a.id === state.selectedAnimId);
  const places = new Map(); // cell -> [1, 4] (places in the selected animation, from 1)
  if (selected) selected.cells.forEach((cell, i) => places.set(cell, [...(places.get(cell) || []), i + 1]));
  const usedElsewhere = new Set(sprites ? source.anims.filter((a) => a !== selected).flatMap((a) => a.cells) : []);

  const bigEnoughForNumbers = cells.length && cells[0].w * zoom >= 18 && cells[0].h * zoom >= 16;

  for (const cell of cells) {
    let used;
    if (!sprites) used = !(state.settings.tiles.skipEmpty && prepared.isEmpty(cell.index));
    else used = places.has(cell.index) || usedElsewhere.has(cell.index);

    if (!used) {
      ctx.fillStyle = "rgba(110, 110, 110, 0.55)";
      ctx.fillRect(cell.x * zoom, cell.y * zoom, cell.w * zoom, cell.h * zoom);
    }

    ctx.setLineDash([]);
    if (places.has(cell.index)) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      outline(ctx, zoom, cell.x, cell.y, cell.w, cell.h);
      if (bigEnoughForNumbers) label(ctx, places.get(cell.index).join(","), cell.x * zoom + 2, cell.y * zoom + 2, accent, accentInk);
    } else if (used) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      outline(ctx, zoom, cell.x, cell.y, cell.w, cell.h);
      ctx.globalAlpha = 1;
    }

    if (used && cropping) {
      ctx.strokeStyle = mark;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      outline(ctx, zoom, cell.x + crop.left, cell.y + crop.top,
        cell.w - crop.left - crop.right, cell.h - crop.top - crop.bottom);
    }
  }
  ctx.setLineDash([]);
}

function onClick(event) {
  if (!shown) return;
  const canvas = $("source-canvas");
  const point = artPoint(event, canvas, shown.zoom);
  const { source } = shown;

  if (state.picking) {
    pickColor(point);
    return;
  }

  const cell = shown.cells.find((c) => point.x >= c.x && point.x < c.x + c.w && point.y >= c.y && point.y < c.y + c.h);
  if (!cell) return;

  if (state.mode === "tiles") {
    // Find where this tile ended up in the new sheet
    const result = state.result;
    if (result) {
      const index = result.tiles.findIndex((t) => t && t.sourceId === source.id && t.cell === cell.index);
      if (index >= 0) state.view.selectedTile = index;
    }
    requestRender({ now: true });
    return;
  }

  // Sprites mode: add or remove the frame from the selected animation
  let anim = source.anims.find((a) => a.id === state.selectedAnimId);
  if (!anim) {
    // Nothing selected in this file: make a new animation to hold the frame
    anim = { id: newAnimId(source), name: `animation_${source.anims.length + 1}`, cells: [], fps: source.fps, loop: true };
    source.anims.push(anim);
    state.selectedAnimId = anim.id;
  }
  source.layout = "own";
  const at = anim.cells.lastIndexOf(cell.index);
  if (at >= 0 && !event.shiftKey) anim.cells.splice(at, 1);
  else anim.cells.push(cell.index);
  state.player.animId = anim.id;
  requestRender({ now: true });
}

/** Set the background color from the pixel that was clicked. */
function pickColor(point) {
  const { source } = shown;
  // Read from the original file, before any background was removed
  let picture = shown.original;
  let x = point.x;
  let y = point.y;
  if (!picture) {
    const cell = shown.cells.find((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
    if (!cell) return;
    picture = source.frames[cell.index];
    x -= cell.x;
    y -= cell.y;
  }
  if (x < 0 || y < 0 || x >= picture.width || y >= picture.height) return;
  const [r, g, b, a] = context(picture).getImageData(x, y, 1, 1).data;
  state.picking = false;
  if (a === 0) {
    requestRender({ now: true }); // already see-through
    return;
  }
  state.settings.background.color = rgbToHex([r, g, b]);
  state.settings.background.mode = "pick";
  syncControls();
  requestRender({ now: true });
}
