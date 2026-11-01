/*
  Loading Piskel files (.piskel), from https://www.piskelapp.com.

  A .piskel file is JSON text. Each layer holds its frames as PNG images
  (written as base64 data: URLs). Newer files split a layer's frames into
  "chunks", each with a "layout" saying which frame is in which spot of the
  chunk's image; older files have one horizontal strip per layer.

  We stack the layers (bottom first) to get each finished frame.
*/

import { newCanvas, context } from "../util/canvas.js";
import { imageFromDataUrl } from "./image.js";

/**
 * Open a .piskel file.
 * Returns { frames: [canvas...], fps }.
 */
export async function loadPiskelFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("this doesn't look like a Piskel file.");
  }
  const piskel = data.piskel;
  if (!piskel || !Array.isArray(piskel.layers)) throw new Error("this doesn't look like a Piskel file.");

  const width = piskel.width;
  const height = piskel.height;
  // Layers are stored as JSON text inside the JSON
  const layers = piskel.layers.map((layer) => (typeof layer === "string" ? JSON.parse(layer) : layer));
  const frameCount = Math.max(0, ...layers.map((layer) => layer.frameCount || 0));
  if (!frameCount) throw new Error("the Piskel file has no frames.");
  const frames = Array.from({ length: frameCount }, () => newCanvas(width, height));

  for (const layer of layers) {
    const opacity = layer.opacity === undefined ? 1 : layer.opacity;
    if (opacity <= 0) continue; // a hidden layer

    // Older files: one strip with every frame side by side
    const chunks = layer.chunks || (layer.base64PNG
      ? [{ base64PNG: layer.base64PNG, layout: Array.from({ length: layer.frameCount }, (_, i) => [i]) }]
      : []);

    for (const chunk of chunks) {
      const image = await imageFromDataUrl(chunk.base64PNG);
      // layout[column][row] is the number of the frame drawn in that spot
      chunk.layout.forEach((column, col) => {
        column.forEach((frameIndex, row) => {
          if (frameIndex >= frameCount) return;
          const ctx = context(frames[frameIndex]);
          ctx.globalAlpha = opacity;
          ctx.drawImage(image, col * width, row * height, width, height, 0, 0, width, height);
          ctx.globalAlpha = 1;
        });
      });
    }
  }

  // Frames hidden in Piskel's preview aren't part of the animation
  const hidden = new Set(piskel.hiddenFrames || []);
  return {
    frames: frames.filter((_, i) => !hidden.has(i)),
    fps: piskel.fps || 12,
  };
}
