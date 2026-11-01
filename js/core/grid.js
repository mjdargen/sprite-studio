/*
  The maths of cutting a sheet into a grid of frames (or tiles).

  A grid is { width, height, margin, spacing }:

     margin  spacing
     |<->|      |<>|
     +-----------------------------+
     |                             |
     |   +------+  +------+        |   width x height: one frame
     |   |  0   |  |  1   |  ...   |   margin: the gap around the edge of the image
     |   +------+  +------+        |   spacing: the gap between frames
     |   +------+  +------+        |
     |   |  N   |  | N+1  |  ...   |   Frames are numbered across each row, then down,
     |   +------+  +------+        |   starting from 0 (like Python lists).

  These rules match Tiled's and Pygame Zero Plus's, so a grid set up here
  means the same thing there.
*/

import { readPixels } from "../util/canvas.js";

/** How many frames fit across and down: { cols, rows }. */
export function gridSize(image, grid) {
  const fit = (length, size) =>
    size > 0 ? Math.max(0, Math.floor((length - grid.margin + grid.spacing) / (size + grid.spacing))) : 0;
  return { cols: fit(image.width, grid.width), rows: fit(image.height, grid.height) };
}

/** The rectangle of frame number `index` in a grid `cols` frames across: { x, y, w, h }. */
export function cellRect(grid, cols, index) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: grid.margin + col * (grid.width + grid.spacing),
    y: grid.margin + row * (grid.height + grid.spacing),
    w: grid.width,
    h: grid.height,
  };
}

/**
 * Pixels on the right and bottom of the image that no frame covers (apart
 * from a margin the same size as the one on the left and top). Something
 * left over usually means the frame size is a little wrong.
 */
export function leftover(image, grid) {
  const { cols, rows } = gridSize(image, grid);
  const used = (count, size) => grid.margin * 2 + count * size + Math.max(0, count - 1) * grid.spacing;
  return {
    right: Math.max(0, image.width - used(cols, grid.width)),
    bottom: Math.max(0, image.height - used(rows, grid.height)),
  };
}

/**
 * The frame size that fits `count` frames into `length` pixels, for when the
 * student knows "there are 8 frames across" rather than the size in pixels.
 */
export function sizeFromCount(length, count, margin, spacing) {
  if (count < 1) return 0;
  return Math.max(1, Math.floor((length - 2 * margin - (count - 1) * spacing) / count));
}

/** Tile sizes that tile sets usually use, most likely first. */
const COMMON_TILE_SIZES = [16, 32, 18, 24, 48, 64, 8, 12, 20, 21, 128];

/**
 * A first guess at how to cut an image. The student can always change it;
 * the guess just saves typing in the usual cases.
 *
 * Tiles mode: a common tile size (with a gap of 0, 1 or 2 pixels) that fits
 * the image exactly. If several fit (16, 32 and 64 all fit a 1408x768
 * image), the one whose lines fall where the picture changes most sharply
 * wins, since tiles usually have visible edges.
 *
 * Sprites mode:
 *   1. Look for the smallest frame size whose lines between frames have
 *      much less art crossing them than usual (see frameSizeAlong). Most
 *      sheets leave space around each character, so this finds the real
 *      frame size even for big multi-row sheets.
 *   2. Otherwise, a strip of square frames (e.g. 192x32 is six 32x32 frames).
 *   3. Otherwise, the whole image is one frame.
 */
export function guessGrid(image, mode) {
  const { width, height } = image;
  const grid = (w, h, spacing = 0) => ({ width: w, height: h, margin: 0, spacing });

  if (mode === "tiles") {
    const fits = (size, spacing) =>
      (width + spacing) % (size + spacing) === 0 &&
      (height + spacing) % (size + spacing) === 0 &&
      (width > size || height > size);
    const sizes = COMMON_TILE_SIZES.filter((size) => fits(size, 0)).sort((a, b) => a - b);
    if (!sizes.length) {
      // No size fits without gaps; one that fits with gaps between tiles is a
      // strong sign, so take the first
      for (const spacing of [1, 2]) {
        const size = COMMON_TILE_SIZES.find((s) => fits(s, spacing));
        if (size) return grid(size, size, spacing);
      }
      return grid(width, height);
    }
    const pixels = readPixels(image);
    let best = sizes[0];
    let bestScore = edgeScore(pixels, best);
    for (const size of sizes.slice(1)) {
      // A bigger size has to be clearly better: its lines are also lines of
      // its smaller factors, so their scores are close when the smaller is right
      const score = edgeScore(pixels, size);
      if (score > bestScore * 1.15) {
        best = size;
        bestScore = score;
      }
    }
    return grid(best, best);
  }

  const crossed = crossings(image);
  const across = frameSizeAlong(width, crossed.columns);
  const down = frameSizeAlong(height, crossed.rows);
  if (across !== width || down !== height) return grid(across, down);

  if (width > height && width % height === 0) return grid(height, height);
  if (height > width && height % width === 0) return grid(width, width);
  return grid(width, height);
}

/**
 * How sharply the picture changes across the lines of a grid of `size`
 * squares: the average difference between the pixels on each side of every
 * line. Lines between real tiles usually score higher than lines through
 * the middle of tiles.
 */
function edgeScore({ data, width, height }, size) {
  const difference = (i, j) =>
    Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) +
    Math.abs(data[i + 2] - data[j + 2]) + Math.abs(data[i + 3] - data[j + 3]);
  let total = 0;
  let count = 0;
  for (let x = size; x < width; x += size) {
    for (let y = 0; y < height; y++) {
      total += difference((y * width + x - 1) * 4, (y * width + x) * 4);
      count++;
    }
  }
  for (let y = size; y < height; y += size) {
    for (let x = 0; x < width; x++) {
      total += difference(((y - 1) * width + x) * 4, (y * width + x) * 4);
      count++;
    }
  }
  return count ? total / count : 0;
}

/**
 * How much art crosses each line between two columns, and between two rows,
 * of pixels: crossings.columns[x] is the share of rows where the pixels at
 * x - 1 and x both have art in them (0 = nothing crosses, 1 = everything does).
 *
 * "Art" means not background: not see-through, and not the color of the
 * top-left pixel when that's a solid background color.
 */
function crossings(image) {
  const { data, width, height } = readPixels(image);
  const corner = [data[0], data[1], data[2], data[3]];
  const art = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const background = data[i + 3] === 0 ||
      (corner[3] === 255 && data[i] === corner[0] && data[i + 1] === corner[1] && data[i + 2] === corner[2]);
    art[p] = background ? 0 : 1;
  }
  const columns = new Float64Array(width);
  const rows = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!art[p]) continue;
      if (x > 0 && art[p - 1]) columns[x] += 1 / height;
      if (y > 0 && art[p - width]) rows[y] += 1 / width;
    }
  }
  return { columns, rows };
}

/**
 * The frame size along one side of the image (its `length` pixels), given
 * how much art crosses each line (from crossings()).
 *
 * The lines between real frames have much less art crossing them than a
 * typical line, because most frames leave a little space around the art. So
 * the answer is the smallest size (at least 8, dividing the length into 2 or
 * more frames) whose lines have less than a third of the typical amount.
 * Its multiples pass too, which is why the smallest wins.
 *
 * Returns `length` (one frame) if no size passes.
 */
function frameSizeAlong(length, crossed) {
  let typical = 0;
  for (let i = 1; i < length; i++) typical += crossed[i];
  typical /= Math.max(1, length - 1);
  if (typical === 0) return length;

  for (let size = 8; size <= length / 2; size++) {
    if (length % size !== 0) continue;
    let total = 0;
    let lines = 0;
    for (let edge = size; edge < length; edge += size) {
      total += crossed[edge];
      lines++;
    }
    if (total / lines < typical / 3) return size;
  }
  return length;
}
