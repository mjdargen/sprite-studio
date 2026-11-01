/*
  Preparing a source's frames: making the background see-through and cutting
  the sheet into frames.

  prepare(source, background) returns a "prepared" object that the rest of the
  app uses to get frames, so nothing else needs to know whether a source is a
  sheet or a list of frames:

    {
      count,           how many frames (or grid cells) there are
      cols, rows,      the grid's size (a "frames" source is one row)
      size,            { width, height } of one frame
      frame(i),        frame number i as a canvas, background removed
      isEmpty(i),      true if frame i has nothing visible in it
      picture,         the whole sheet with the background removed (sheets only)
      frames,          all the frames with the background removed (frames only)
    }

  The work is saved in source.cache and reused until the background setting
  or the grid changes, so redrawing the page stays fast.
*/

import { cloneCanvas, readPixels, isRegionEmpty, isEmpty, copyRegion, context, hexToRgb } from "../util/canvas.js";
import { gridSize, cellRect } from "./grid.js";

/**
 * Get a source's frames ready to use (see the top of this file).
 * `background` is settings.background: { mode, color, tolerance }.
 */
export function prepare(source, background) {
  const cache = source.cache;

  // 1. Remove the background, once per background setting
  const backgroundKey = JSON.stringify(background);
  if (cache.backgroundKey !== backgroundKey) {
    cache.backgroundKey = backgroundKey;
    cache.prepared = null;
    if (source.kind === "sheet") {
      cache.picture = removeBackground(source.image, background, source.image);
    } else {
      cache.frames = source.frames.map((frame) => removeBackground(frame, background, source.frames[0]));
    }
  }

  // 2. Cut the sheet up, once per grid
  const gridKey = source.kind === "sheet" ? JSON.stringify(source.grid) : "frames";
  if (cache.prepared && cache.gridKey === gridKey) return cache.prepared;
  cache.gridKey = gridKey;
  cache.prepared = source.kind === "sheet" ? prepareSheet(source, cache.picture) : prepareFrames(cache.frames);
  return cache.prepared;
}

function prepareSheet(source, picture) {
  const { cols, rows } = gridSize(picture, source.grid);
  const pixels = readPixels(picture);
  const frames = new Map();
  const empties = new Map();
  const rect = (i) => cellRect(source.grid, cols, i);
  return {
    count: cols * rows,
    cols,
    rows,
    size: { width: source.grid.width, height: source.grid.height },
    picture,
    frame(i) {
      if (!frames.has(i)) {
        const r = rect(i);
        frames.set(i, copyRegion(picture, r.x, r.y, r.w, r.h));
      }
      return frames.get(i);
    },
    isEmpty(i) {
      if (!empties.has(i)) {
        const r = rect(i);
        empties.set(i, isRegionEmpty(pixels, r.x, r.y, r.w, r.h));
      }
      return empties.get(i);
    },
  };
}

function prepareFrames(frames) {
  const empties = new Map();
  return {
    count: frames.length,
    cols: frames.length,
    rows: 1,
    size: { width: frames[0].width, height: frames[0].height },
    frames,
    frame: (i) => frames[i],
    isEmpty(i) {
      if (!empties.has(i)) empties.set(i, isEmpty(frames[i]));
      return empties.get(i);
    },
  };
}

/**
 * The color that "auto" removes: the top-left pixel of `sample`, or null if
 * that pixel is already see-through (then there's nothing to remove).
 */
export function autoBackgroundColor(sample) {
  const [r, g, b, a] = context(sample).getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : [r, g, b];
}

/**
 * If `sample` looks like it has a solid background (all four corners are the
 * same solid color), that color as "#rrggbb"; otherwise null. Used to suggest
 * removing it.
 */
export function solidBackground(sample) {
  const corner = (x, y) => Array.from(context(sample).getImageData(x, y, 1, 1).data);
  const w = sample.width - 1;
  const h = sample.height - 1;
  const corners = [corner(0, 0), corner(w, 0), corner(0, h), corner(w, h)];
  const [r, g, b, a] = corners[0];
  if (a !== 255 || !corners.every((c) => c.join() === corners[0].join())) return null;
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * A copy of `canvas` with one color made see-through.
 * `sample` is the picture whose top-left pixel "auto" uses (for a GIF, the
 * first frame, so every frame loses the same color).
 * Returns `canvas` itself if there's nothing to remove.
 */
export function removeBackground(canvas, background, sample) {
  if (background.mode === "off") return canvas;
  const color = background.mode === "auto" ? autoBackgroundColor(sample) : hexToRgb(background.color);
  if (!color) return canvas;

  const copy = cloneCanvas(canvas);
  const ctx = context(copy);
  const pixels = ctx.getImageData(0, 0, copy.width, copy.height);
  const data = pixels.data;
  // tolerance 0-100 becomes a distance of 0-255 in each of red, green and blue
  const reach = Math.round((background.tolerance / 100) * 255);
  for (let i = 0; i < data.length; i += 4) {
    if (
      Math.abs(data[i] - color[0]) <= reach &&
      Math.abs(data[i + 1] - color[1]) <= reach &&
      Math.abs(data[i + 2] - color[2]) <= reach
    ) {
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return copy;
}
