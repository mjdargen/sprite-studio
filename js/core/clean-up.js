/*
  Step 3's clean-up jobs on lists of frames: cutting off edges, trimming
  empty space, adding padding and changing the size.

  Each function takes canvases and returns new ones, and never changes the
  canvases it was given (they're shared with the cache in prepare.js).
  Background removal is in prepare.js, because it's done once per file.
*/

import { copyRegion, newCanvas, context, visibleBox, unionBoxes, resizeCanvas } from "../util/canvas.js";

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
