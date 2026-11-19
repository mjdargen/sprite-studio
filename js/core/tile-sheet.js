/*
  Building the tile sheet (tiles mode).

  Tiled numbers the tiles in a tile sheet across each row, then down,
  starting from 0. Maps store those numbers, so the order matters: a map made
  with a sheet only shows the right tiles with a sheet in the same order.

  buildTileSheet():
    1. takes every tile from every file, in order (each grid cell of a sheet,
       or each separate image), with the background removed (prepare.js)
    2. leaves out empty tiles, if the student asked
    3. cuts the edges off each tile, resizes it and changes its colors (clean-up.js)
    4. lays the tiles out `columns` across, with no gaps between them. Each
       file starts on a new row, so several tile sets (ground, buildings,
       items...) stack on top of each other in one sheet, each looking the
       way it did on its own

  Keeping the same number of tiles across and not leaving any out keeps every
  tile's number the same, so maps made with the old sheet still work.

  A file narrower than the sheet leaves empty spaces at the end of its rows.
  Tiled still counts those spaces, so they're in the result as null tiles.

  It returns:
    {
      sheet,                     the finished canvas
      tileWidth, tileHeight,
      columns,
      count,                     tile spaces, including empty ones between files
      tiles: [{ sourceId, cell } or null]  where each tile came from, in order
      warnings: [text...]
    }
  or null if there's nothing to build yet.
*/

import { newCanvas, context } from "../util/canvas.js";
import { prepare } from "./prepare.js";
import { cropEdges, scale, filterColors } from "./clean-up.js";

/** Tiles across when the student leaves it on automatic and it can't be kept the same. */
const AUTO_COLUMNS_MOST = 16;

export function buildTileSheet(state) {
  const { settings } = state;
  const warnings = [];
  if (!state.sources.length) return null;

  // 1-2. Every tile, file by file
  const files = [];
  for (const source of state.sources) {
    const prepared = prepare(source, settings.background);
    const tiles = [];
    for (let cell = 0; cell < prepared.count; cell++) {
      if (settings.tiles.skipEmpty && prepared.isEmpty(cell)) continue;
      tiles.push({ source, cell, picture: prepared.frame(cell) });
    }
    if (tiles.length) files.push({ source, prepared, tiles });
    if (prepared.overlaps) {
      warnings.push(`${prepared.overlaps} tile${prepared.overlaps === 1 ? "" : "s"} in ${source.name} landed on top of others and ` +
        `${prepared.overlaps === 1 ? "was" : "were"} left out. Check the tile size in step 2.`);
    }
  }
  if (!files.length) return null;

  // 3. Clean up each tile on its own, so resizing never blends neighbors together
  const picked = files.flatMap((f) => f.tiles);
  const sized = scale(cropEdges(picked.map((t) => t.picture), settings.crop), settings.scale, settings.smooth);
  const pictures = filterColors(sized, settings.filters);
  picked.forEach((t, i) => (t.picture = pictures[i]));
  const tileWidth = Math.max(...pictures.map((p) => p.width));
  const tileHeight = Math.max(...pictures.map((p) => p.height));
  if (pictures.some((p) => p.width !== tileWidth || p.height !== tileHeight)) {
    warnings.push(`Your tiles aren't all the same size, so the smaller ones are centered in a ${tileWidth}×${tileHeight} space.`);
  }

  // 4. Lay them out, each file starting on a new row
  const columns = chooseColumns(state, files);
  const slots = [];
  const nextRow = () => { while (slots.length % columns) slots.push(null); };
  for (const file of files) {
    nextRow();
    const across = Math.min(columns, naturalColumns(state, file));
    file.tiles.forEach((tile, i) => {
      if (i > 0 && i % across === 0) nextRow();
      slots.push(tile);
    });
  }

  const rows = Math.ceil(slots.length / columns);
  const sheet = newCanvas(columns * tileWidth, rows * tileHeight);
  const ctx = context(sheet);
  slots.forEach((tile, i) => {
    if (!tile) return;
    const x = (i % columns) * tileWidth + Math.floor((tileWidth - tile.picture.width) / 2);
    const y = Math.floor(i / columns) * tileHeight + Math.floor((tileHeight - tile.picture.height) / 2);
    ctx.drawImage(tile.picture, x, y);
  });

  return {
    sheet,
    tileWidth,
    tileHeight,
    columns,
    count: slots.length,
    tiles: slots.map((t) => (t ? { sourceId: t.source.id, cell: t.cell } : null)),
    warnings,
  };
}

/**
 * How many tiles across: the student's number, or else as wide as the widest
 * sheet (so every sheet keeps its own layout and tile numbers), or else a
 * roughly square sheet of at most AUTO_COLUMNS_MOST.
 * `files` is [{ source, prepared, tiles }] from buildTileSheet.
 */
export function chooseColumns(state, files) {
  const most = Math.max(...files.map((f) => f.tiles.length));
  const asked = Math.floor(state.settings.tiles.columns);
  if (asked > 0) return Math.min(asked, most);
  const sheets = files.filter((f) => f.source.kind === "sheet");
  if (sheets.length && !state.settings.tiles.skipEmpty) {
    return Math.max(...sheets.map((f) => f.prepared.cols));
  }
  const count = files.reduce((total, f) => total + f.tiles.length, 0);
  return Math.max(1, Math.min(AUTO_COLUMNS_MOST, Math.ceil(Math.sqrt(count))));
}

/**
 * How many of a file's tiles go in each row: as many as in the file itself,
 * for a sheet that's being kept whole, or as many as fit otherwise.
 */
function naturalColumns(state, file) {
  const keepRows = file.source.kind === "sheet" && !state.settings.tiles.skipEmpty && !(state.settings.tiles.columns > 0);
  return keepRows ? file.prepared.cols : Infinity;
}
