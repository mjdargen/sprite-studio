/*
  Step 3's clean-up jobs on lists of frames: cutting off edges, trimming
  empty space, adding padding, changing the size and changing the colors.

  Each function takes canvases and returns new ones, and never changes the
  canvases it was given (they're shared with the cache in prepare.js).
  Background removal is in prepare.js, because it's done once per file.
*/

import { copyRegion, newCanvas, context, visibleBox, unionBoxes, resizeCanvas, readPixels, canvasFromPixels, hexToRgb } from "../util/canvas.js";

/**
 * Cut `crop.left`, `crop.right`, `crop.top` and `crop.bottom` pixels off the
 * edges of every frame. Throws an error if that leaves nothing.
 */
export function cropEdges(frames, crop) {
  const { left, right, top, bottom } = crop;
  if (!left && !right && !top && !bottom) return frames;
  return frames.map((frame) => {
    const w = frame.width - left - right;
    const h = frame.height - top - bottom;
    if (w < 1 || h < 1) {
      throw new Error(`Cutting those edges off a ${frame.width}×${frame.height} frame leaves nothing. Make the numbers in step 3 smaller.`);
    }
    return copyRegion(frame, left, top, w, h);
  });
}

/** The box around everything visible in all of these frames, or null if they're all empty. */
export function sharedBox(frames) {
  return unionBoxes(frames.map(visibleBox));
}

/**
 * Cut every frame down to `box` (from sharedBox), leaving `padding`
 * see-through pixels around it. Using one box for several frames keeps them
 * lined up with each other.
 */
export function trimToBox(frames, box, padding) {
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  return frames.map((frame) => {
    const canvas = newCanvas(w + padding * 2, h + padding * 2);
    context(canvas).drawImage(frame, box.left, box.top, w, h, padding, padding, w, h);
    return canvas;
  });
}

/** Add `padding` see-through pixels around every frame. */
export function pad(frames, padding) {
  if (!padding) return frames;
  return frames.map((frame) => {
    const canvas = newCanvas(frame.width + padding * 2, frame.height + padding * 2);
    context(canvas).drawImage(frame, padding, padding);
    return canvas;
  });
}

/** Make every frame `factor` times bigger (or smaller, below 1). */
export function scale(frames, factor, smooth) {
  if (factor === 1) return frames;
  return frames.map((frame) => resizeCanvas(frame, factor, smooth));
}

/**
 * Change the colors of every frame (settings.filters): invert them, make them
 * gray, blend them toward a tint color, and/or make them partly see-through. Pixels that
 * are already see-through stay that way.
 */
export function filterColors(frames, filters) {
  const { invert, gray, tint, tintAmount, opacity } = filters;
  if (!invert && !gray && !tintAmount && opacity === 100) return frames;
  const [tr, tg, tb] = hexToRgb(tint);
  const mix = tintAmount / 100;
  const see = opacity / 100;
  return frames.map((frame) => {
    const { data } = readPixels(frame);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      let r = data[i], g = data[i + 1], b = data[i + 2];
      if (invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
      if (gray) r = g = b = 0.299 * r + 0.587 * g + 0.114 * b; // how bright it looks
      data[i] = r + (tr - r) * mix;
      data[i + 1] = g + (tg - g) * mix;
      data[i + 2] = b + (tb - b) * mix;
      data[i + 3] *= see;
    }
    return canvasFromPixels(data, frame.width, frame.height);
  });
}
