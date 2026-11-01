/*
  Sources: the files the student has added, after loading.

  A source is made from a spec (see js/formats/index.js) and looks like this:

    {
      id: 3,                     unique number
      name: "hero",              from the file name
      note: "GIF, 6 frames",     shown in the file list
      kind: "sheet" | "frames",

      // kind "sheet": one image, cut up by a grid (see js/core/grid.js)
      image: canvas,
      grid: { width, height, margin, spacing },

      // kind "frames": already-separate frames
      frames: [canvas, ...],
      tags: [{ name, cells, fps }] or null,   named animations from the file

      fps: 8,                    speed the file asked for (or the default)
      layout: "rows",            how animations are made from it (js/core/layouts.js)
      skipEmpty: true,           leave empty frames off the end of rows/columns
      anims: [ { id, name, cells, fps, loop }, ... ]   its animations

      cache: {}                  pictures worked out from it (js/core/prepare.js)
    }

  An animation's `cells` are frame numbers: grid cells for a sheet, or
  positions in `frames`. They can repeat (0 1 2 1) and be in any order.
*/

import { guessGrid, gridSize } from "./grid.js";

let lastSourceId = 0;
let lastAnimId = 0;

/** Turn a loaded spec into a source. `mode` is "sprites" or "tiles". */
export function createSource(spec, mode) {
  const source = {
    id: ++lastSourceId,
    name: spec.name,
    note: spec.note,
    kind: spec.kind,
    fps: spec.fps || 8,
    skipEmpty: true,
    anims: [],
    cache: {},
  };
  if (spec.kind === "sheet") {
    source.image = spec.image;
    source.grid = spec.grid || guessGrid(spec.image, mode);
  } else {
    source.frames = spec.frames;
    source.tags = spec.tags || null;
  }
  source.layout = defaultLayout(source);
  return source;
}

/**
 * The layout a new source starts with:
 * the file's own animations if it has any, each row of a sheet (or each
 * column, if it's one column down), or all the frames as one animation.
 */
export function defaultLayout(source) {
  if (source.kind === "frames") return source.tags ? "tags" : "all";
  const { cols, rows } = gridSize(source.image, source.grid);
  return cols === 1 && rows > 1 ? "columns" : "rows";
}

/** A new, unique animation id for an animation the student adds themselves. */
export function newAnimId(source) {
  return `${source.id}:own:${++lastAnimId}`;
}

/** The size of one frame of a source, before any clean-up. */
export function frameSize(source) {
  if (source.kind === "sheet") return { width: source.grid.width, height: source.grid.height };
  return { width: source.frames[0].width, height: source.frames[0].height };
}
