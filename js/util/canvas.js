/*
  Helpers for working with pixels in canvases.

  Every image in the app (a loaded file, a frame, the finished sheet) is an
  off-screen <canvas>, because a canvas can be drawn, cut up and read pixel by
  pixel. These functions do those jobs so the rest of the code doesn't have to
  deal with the canvas API directly.

  Pixel data (ImageData.data) is a flat list of numbers, 4 per pixel, in the
  order red, green, blue, alpha (0-255 each), going across each row and then
  down. So the alpha of pixel (x, y) is data[(y * width + x) * 4 + 3].
*/

/** A new, see-through canvas. Sizes below 1 become 1, since canvases can't be empty. */
export function newCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/**
 * The 2D drawing context of a canvas.
 * willReadFrequently tells the browser we'll read pixels back often, which
 * makes getImageData much faster.
 */
export function context(canvas) {
  return canvas.getContext("2d", { willReadFrequently: true });
}

/** A copy of a w x h rectangle of `source`, starting at (x, y), as a new canvas. */
export function copyRegion(source, x, y, w, h) {
  const canvas = newCanvas(w, h);
  context(canvas).drawImage(source, x, y, w, h, 0, 0, w, h);
  return canvas;
}

/** A copy of a whole canvas. */
export function cloneCanvas(source) {
  return copyRegion(source, 0, 0, source.width, source.height);
}

/** All the pixels of a canvas (see the note at the top about the format). */
export function readPixels(canvas) {
  return context(canvas).getImageData(0, 0, canvas.width, canvas.height);
}

/** A canvas showing these pixels. `pixels` is a Uint8ClampedArray of RGBA values. */
export function canvasFromPixels(pixels, width, height) {
  const canvas = newCanvas(width, height);
  context(canvas).putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

/** True if no pixel in the rectangle can be seen (every alpha is 0). */
export function isRegionEmpty(imageData, x, y, w, h) {
  const { data, width } = imageData;
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (data[(row * width + col) * 4 + 3] !== 0) return false;
    }
  }
  return true;
}

/** True if no pixel in the canvas can be seen. */
export function isEmpty(canvas) {
  return isRegionEmpty(readPixels(canvas), 0, 0, canvas.width, canvas.height);
}

/**
 * The smallest box around every pixel that can be seen, as
 * { left, top, right, bottom } (right and bottom are one past the last pixel),
 * or null if the canvas is completely see-through.
 */
export function visibleBox(canvas) {
  const { data, width, height } = readPixels(canvas);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { left, top, right: right + 1, bottom: bottom + 1 };
}

/** The smallest box that holds all of these boxes. Nulls are skipped. */
export function unionBoxes(boxes) {
  let union = null;
  for (const box of boxes) {
    if (!box) continue;
    union = union
      ? {
          left: Math.min(union.left, box.left),
          top: Math.min(union.top, box.top),
          right: Math.max(union.right, box.right),
          bottom: Math.max(union.bottom, box.bottom),
        }
      : { ...box };
  }
  return union;
}

/**
 * A copy of `source`, `factor` times the size.
 * smooth=false keeps hard pixel edges (right for pixel art); smooth=true
 * blends neighboring pixels (right for drawings and photos).
 */
export function resizeCanvas(source, factor, smooth) {
  if (factor === 1) return source;
  const canvas = newCanvas(source.width * factor, source.height * factor);
  const ctx = context(canvas);
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** "#ff8800" -> [255, 136, 0] */
export function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** [255, 136, 0] -> "#ff8800" */
export function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
