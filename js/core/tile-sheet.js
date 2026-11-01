/*
  Building the tile sheet (tiles mode).

  Tiled numbers the tiles in a tile sheet across each row, then down,
  starting from 0. Maps store those numbers, so the order matters: a map made
  with a sheet only shows the right tiles with a sheet in the same order.

  buildTileSheet():
    1. takes every tile from every file, in order (each grid cell of a sheet,
       or each separate image), with the background removed (prepare.js)
    2. leaves out empty tiles, if the student asked
    3. cuts the edges off each tile and resizes it (clean-up.js)
    4. lays the tiles out `columns` across, with no gaps

  Keeping the same number of tiles across and not leaving any out keeps every
  tile's number the same, so maps made with the old sheet still work.

  It returns:
    {
      sheet,                     the finished canvas
      tileWidth, tileHeight,
      columns, count,
      tiles: [{ sourceId, cell }]  where each tile came from, in order
      warnings: [text...]
    }
  or null if there's nothing to build yet.
*/

import { newCanvas, context } from "../util/canvas.js";
import { prepare } from "./prepare.js";
import { cropEdges, scale } from "./clean-up.js";

/** Tiles across when the student leaves it on automatic and it can't be kept the same. */
const AUTO_COLUMNS_MOST = 16;

export function buildTileSheet(state) {
  const { settings } = state;
  const warnings = [];
  if (!state.sources.length) return null;

  // 1-2. Every tile, in order
  const picked = [];
  for (const source of state.sources) {
    const prepared = prepare(source, settings.background);
    for (let cell = 0; cell < prepared.count; cell++) {
      if (settings.tiles.skipEmpty && prepared.isEmpty(cell)) continue;
      picked.push({ source, cell, picture: prepared.frame(cell) });
    }
  }
  if (!picked.length) return null;

  // 3. Clean up each tile on its own, so resizing never blends neighbors together
  const pictures = scale(cropEdges(picked.map((t) => t.picture), settings.crop), settings.scale, settings.smooth);
  const tileWidth = Math.max(...pictures.map((p) => p.width));
  const tileHeight = Math.max(...pictures.map((p) => p.height));
  if (pictures.some((p) => p.width !== tileWidth || p.height !== tileHeight)) {
    warnings.push(`Your tiles aren't all the same size, so the smaller ones are centered in a ${tileWidth}×${tileHeight} space.`);
  }

  // 4. Lay them out
  const columns = chooseColumns(state, picked.length);
  const rows = Math.ceil(pictures.length / columns);
  const sheet = newCanvas(columns * tileWidth, rows * tileHeight);
  const ctx = context(sheet);
  pictures.forEach((picture, i) => {
    const x = (i % columns) * tileWidth + Math.floor((tileWidth - picture.width) / 2);
    const y = Math.floor(i / columns) * tileHeight + Math.floor((tileHeight - picture.height) / 2);
    ctx.drawImage(picture, x, y);
  });

  return {
    sheet,
    tileWidth,
    tileHeight,
    columns,
    count: pictures.length,
    tiles: picked.map((t) => ({ sourceId: t.source.id, cell: t.cell })),
    warnings,
  };
}

/**
 * How many tiles across: the student's number, or else the same as the
 * original sheet (so tile numbers don't change), or else a roughly square
 * sheet of at most AUTO_COLUMNS_MOST.
 */
export function chooseColumns(state, count) {
  const asked = Math.floor(state.settings.tiles.columns);
  if (asked > 0) return Math.min(asked, count);
  const sheets = state.sources.filter((s) => s.kind === "sheet");
  if (state.sources.length === 1 && sheets.length === 1 && !state.settings.tiles.skipEmpty) {
    const cache = sheets[0].cache.prepared;
    if (cache && cache.cols > 0) return cache.cols;
  }
  return Math.max(1, Math.min(AUTO_COLUMNS_MOST, Math.ceil(Math.sqrt(count))));
}
