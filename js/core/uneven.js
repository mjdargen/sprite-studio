/*
  Cutting a sheet whose gaps aren't even ("Gaps aren't even" in step 2).

  Some tile sets put a gap around most tiles but not inside bigger things
  made of several tiles (a 2 × 2 tree has no gaps between its four tiles),
  so no single margin and spacing fits, and Tiled can't use the sheet.

  So instead of a grid, this finds the art itself:
    1. Every block of art: pixels that can be seen, with see-through space
       all around them (findBlocks).
    2. Each block is cut into tiles of the tile size. A block that isn't a
       whole number of tiles (a round shape that doesn't fill its squares)
       is centered in the nearest whole number of tiles.
    3. The tiles are snapped into rows and columns: tiles that start within
       half a tile of each other across (or down) share a column (or row).
       This drops the gaps but keeps everything where it was relative to
       everything else, so the new sheet looks like the old one.

  It works on the picture after background removal, so a sheet whose gaps
  are a solid color works once that color is made see-through in step 3.
*/

import { readPixels } from "../util/canvas.js";

/**
 * Find the tiles in `picture` (see the top of this file).
 * Returns { cols, rows, cells, found, overlaps }:
 *   cells     cols * rows entries, across then down: null for an empty
 *             space, or { x, y, w, h, dx, dy }: copy the w x h rectangle at
 *             (x, y) in the picture to (dx, dy) in a new tile
 *   found     how many tiles were found
 *   overlaps  tiles that landed on a space already taken (and were left out)
 */
export function unevenGrid(picture, tileWidth, tileHeight) {
  const pieces = [];
  for (const block of findBlocks(picture)) {
    const w = block.right - block.left;
    const h = block.bottom - block.top;
    const across = tilesFor(w, tileWidth);
    const down = tilesFor(h, tileHeight);
    // Where the block's whole-tile area starts, with the art centered in it
    const startX = block.left - Math.floor((across * tileWidth - w) / 2);
    const startY = block.top - Math.floor((down * tileHeight - h) / 2);
    for (let j = 0; j < down; j++) {
      for (let i = 0; i < across; i++) {
        const tx = startX + i * tileWidth;
        const ty = startY + j * tileHeight;
        // The part of this tile that's inside the block
        const x = Math.max(tx, block.left);
        const y = Math.max(ty, block.top);
        const right = Math.min(tx + tileWidth, block.right);
        const bottom = Math.min(ty + tileHeight, block.bottom);
        if (right <= x || bottom <= y) continue;
        pieces.push({ tx, ty, cell: { x, y, w: right - x, h: bottom - y, dx: x - tx, dy: y - ty } });
      }
    }
  }

  const columns = snap(pieces.map((p) => p.tx), tileWidth);
  const rows = snap(pieces.map((p) => p.ty), tileHeight);
  const cells = new Array(columns.count * rows.count).fill(null);
  let overlaps = 0;
  for (const piece of pieces) {
    const index = rows.index.get(piece.ty) * columns.count + columns.index.get(piece.tx);
    if (cells[index]) overlaps++;
    else cells[index] = piece.cell;
  }
  return { cols: columns.count, rows: rows.count, cells, found: pieces.length - overlaps, overlaps };
}

/**
 * A guess at the tile size from the blocks of art in `picture`, as
 * { width, height }, or null if it has none: the biggest size that divides
 * every block width (and height) that appears more than once. So blocks of
 * 8, 16 and 24 pixels mean 8-pixel tiles, and a one-off odd shape is ignored.
 */
export function guessTileSize(picture) {
  const blocks = findBlocks(picture);
  if (!blocks.length) return null;
  return {
    width: commonDivisor(blocks.map((b) => b.right - b.left)),
    height: commonDivisor(blocks.map((b) => b.bottom - b.top)),
  };
}

function commonDivisor(lengths) {
  const counts = new Map();
  for (const n of lengths) counts.set(n, (counts.get(n) || 0) + 1);
  const repeated = [...counts.keys()].filter((n) => counts.get(n) > 1);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const divisor = (repeated.length ? repeated : [...counts.keys()]).reduce(gcd);
  // Too small to be a tile: use the most common length instead
  return divisor >= 4 ? divisor : [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * The boxes around each block of art: { left, top, right, bottom } (right
 * and bottom are one past the last pixel). Pixels that can be seen and touch
 * (side by side or up and down) are in the same block, and blocks whose
 * boxes overlap are joined, so art with holes in it stays in one piece.
 */
export function findBlocks(picture) {
  const { data, width, height } = readPixels(picture);
  const seen = new Uint8Array(width * height);
  const stack = [];
  let boxes = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || data[start * 4 + 3] === 0) continue;
    seen[start] = 1;
    stack.push(start);
    const box = { left: width, top: height, right: 0, bottom: 0 };
    while (stack.length) {
      const p = stack.pop();
      const x = p % width;
      const y = (p - x) / width;
      if (x < box.left) box.left = x;
      if (y < box.top) box.top = y;
      if (x + 1 > box.right) box.right = x + 1;
      if (y + 1 > box.bottom) box.bottom = y + 1;
      const visit = (q) => {
        if (!seen[q] && data[q * 4 + 3] !== 0) {
          seen[q] = 1;
          stack.push(q);
        }
      };
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y < height - 1) visit(p + width);
    }
    boxes.push(box);
  }

  // Join overlapping boxes until none overlap
  let joined = true;
  while (joined) {
    joined = false;
    const kept = [];
    for (const box of boxes) {
      const other = kept.find((k) => k.left < box.right && box.left < k.right && k.top < box.bottom && box.top < k.bottom);
      if (other) {
        other.left = Math.min(other.left, box.left);
        other.top = Math.min(other.top, box.top);
        other.right = Math.max(other.right, box.right);
        other.bottom = Math.max(other.bottom, box.bottom);
        joined = true;
      } else {
        kept.push({ ...box });
      }
    }
    boxes = kept;
  }
  return boxes;
}

/**
 * How many tiles a block `length` pixels long covers. A little over a whole
 * number (17 pixels of 8-pixel tiles) is a stray pixel, not another tile.
 */
function tilesFor(length, size) {
  return Math.max(1, Math.ceil(length / size - 0.25));
}

/**
 * Group positions into columns (or rows): sorted, a position less than half
 * a tile after the one before it is in the same group.
 * Returns { index: Map(position -> group number), count }.
 */
function snap(positions, size) {
  const index = new Map();
  let count = 0;
  let previous = -Infinity;
  for (const position of [...new Set(positions)].sort((a, b) => a - b)) {
    if (position - previous >= size / 2) count++;
    index.set(position, count - 1);
    previous = position;
  }
  return { index, count };
}
