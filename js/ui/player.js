/*
  The animation player (sprites mode).

  It plays each animation by cutting its frames out of the finished sheet,
  the same way Pygame Zero Plus will, at the animation's own speed. So if it
  looks right here, it will look right in the game. "Plays once" animations
  stop on their last frame, like they do in the game.

  The view options (zoom, what's behind it, the Actor's edges and center)
  only change the preview.

  drawPlayer() is called on every redraw and draws the animation buttons;
  drawFrame() draws just the current frame and is called by the timer.
*/

import { state, requestRender } from "../state.js";
import { $, h, rebuild } from "../util/dom.js";
import { newCanvas, context } from "../util/canvas.js";
import { fitZoom, zoomLabel, stageSize, drawZoomed, clearView, themeColor } from "../util/view.js";

let timer = null;

export function setUpPlayer() {
  $("play-toggle").addEventListener("click", () => {
    const row = currentRow();
    // A finished "plays once" animation starts again from the beginning
    if (!state.player.playing && row && !row.loop && state.player.frame >= row.frames.length - 1) state.player.frame = 0;
    state.player.playing = !state.player.playing;
    drawFrame();
  });
  $("play-back").addEventListener("click", () => step(-1));
  $("play-next").addEventListener("click", () => step(1));
}

/** Show the previous (-1) or next (1) frame, and pause. */
function step(by) {
  const row = currentRow();
  if (!row) return;
  state.player.playing = false;
  state.player.frame = (state.player.frame + by + row.frames.length) % row.frames.length;
  drawFrame();
}

/** The row of the sheet being played (choosing another if it's gone), or null. */
function currentRow() {
  const result = state.result;
  if (!result || state.mode !== "sprites") return null;
  let row = result.rows.find((r) => r.animId === state.player.animId);
  if (!row) {
    // Play the selected animation if it's in the sheet, or else the first
    row = result.rows.find((r) => r.animId === state.selectedAnimId) || result.rows[0];
    state.player.animId = row.animId;
    state.player.frame = 0;
  }
  return row;
}

/** Draw the buttons for choosing an animation, then the current frame. */
export function drawPlayer() {
  const row = currentRow();
  const rows = row ? state.result.rows : [];
  rebuild($("anim-chips"), rows.map((r) =>
    h("button", {
      type: "button", class: "chip small", id: `chip-${r.name}`, "aria-pressed": String(r.animId === row.animId),
      onclick: () => {
        state.player.animId = r.animId;
        state.player.frame = 0;
        state.player.playing = true;
        requestRender({ now: true });
      },
    }, r.name)));
  drawFrame();
}

/** Draw the current frame, and set a timer for the next one. */
function drawFrame() {
  clearTimeout(timer);
  const canvas = $("play-canvas");
  const row = currentRow();
  if (!row) {
    clearView(canvas);
    $("play-stats").textContent = "";
    return;
  }
  const result = state.result;
  const rowIndex = result.rows.indexOf(row);
  const { cellWidth: width, cellHeight: height } = result;
  state.player.frame = Math.min(state.player.frame, row.frames.length - 1);

  // Cut the frame out of the sheet, like the game does
  const frame = newCanvas(width, height);
  context(frame).drawImage(result.sheet, state.player.frame * width, rowIndex * height, width, height, 0, 0, width, height);

  const room = stageSize($("play-stage"), 320);
  const zoom = state.view.playerZoom === "fit" ? fitZoom(width, height, room.width, room.height) : Number(state.view.playerZoom);
  const ctx = drawZoomed(canvas, frame, zoom, state.view.playerBackground);
  if (state.view.showCenter) drawActorGuides(ctx, canvas);

  const finished = !row.loop && state.player.frame === row.frames.length - 1;
  $("play-toggle").textContent = state.player.playing && !finished ? "Pause" : "Play";
  $("play-stats").textContent =
    `frame ${state.player.frame} (0 to ${row.frames.length - 1}) · ${row.fps} fps · ${width}×${height} at ${zoomLabel(zoom)}`;

  // Wait one frame's time, then show the next
  if (state.player.playing && !finished) {
    timer = setTimeout(() => {
      state.player.frame = row.loop ? (state.player.frame + 1) % row.frames.length : state.player.frame + 1;
      drawFrame();
    }, 1000 / row.fps);
  }
}

/** The Actor's edges (dashed) and its center (a cross), which is where pos puts it. */
function drawActorGuides(ctx, canvas) {
  ctx.strokeStyle = themeColor("--mark");
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  ctx.setLineDash([]);
  const cx = Math.round(canvas.width / 2);
  const cy = Math.round(canvas.height / 2);
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy + 0.5);
  ctx.lineTo(cx + 6, cy + 0.5);
  ctx.moveTo(cx + 0.5, cy - 6);
  ctx.lineTo(cx + 0.5, cy + 6);
  ctx.stroke();
}
