/*
  Layouts: the ready-made ways of turning a source's frames into animations.

  A source's `layout` picks one. Every redraw, applyLayout() works the
  animations out again from the current grid, so changing the frame size in
  step 2 updates them straight away. Names, speeds and "plays once" the
  student typed are kept, matched by animation id.

  "own" is different: the animations are whatever the student picked by
  clicking frames or typing frame numbers, and are never worked out again.
  Editing an animation's frames switches the source to "own".

  To add a layout: add it to SHEET_LAYOUTS or FRAMES_LAYOUTS (the text is
  what the student sees), then add a case for it in generate().
*/

/** Layouts for a sheet that's cut up by a grid. */
export const SHEET_LAYOUTS = [
  ["rows", "Each row is an animation"],
  ["columns", "Each column is an animation"],
  ["across", "All the frames, reading across each row, as one animation"],
  ["down", "All the frames, reading down each column, as one animation"],
  ["own", "Frames I pick"],
];

/** Layouts for art that's already in frames (GIF, Aseprite, Piskel...). */
export const FRAMES_LAYOUTS = [
  ["tags", "The animations saved in the file"],
  ["all", "All the frames as one animation"],
  ["own", "Frames I pick"],
];

/** The layouts a source can use, as [value, text] pairs. */
export function layoutChoices(source) {
  if (source.kind === "sheet") return SHEET_LAYOUTS;
  return source.tags ? FRAMES_LAYOUTS : FRAMES_LAYOUTS.filter(([value]) => value !== "tags");
}

/**
 * Work out a source's animations from its layout (see the top of this file).
 * `prepared` is the source's prepared frames (js/core/prepare.js).
 */
export function applyLayout(source, prepared) {
  if (source.layout === "own") {
    // Frame numbers can point past the end if the grid got smaller
    for (const anim of source.anims) anim.cells = anim.cells.filter((i) => i < prepared.count);
    return;
  }

  const previous = new Map(source.anims.map((anim) => [anim.id, anim]));
  source.anims = generate(source, prepared).map((made) => {
    const id = `${source.id}:${source.layout}:${made.key}`;
    const old = previous.get(id);
    return {
      id,
      name: old ? old.name : made.name,
      cells: made.cells,
      fps: old ? old.fps : made.fps || source.fps,
      loop: old ? old.loop : true,
    };
  });
}

/**
 * The animations a layout makes: [{ key, name, cells, fps? }].
 * `key` must stay the same for "the same" animation when the grid changes
 * (e.g. the row number), so the student's names stick to it.
 */
function generate(source, prepared) {
  const { cols, rows, count } = prepared;
  const tidy = (cells) => (source.skipEmpty ? dropEmptyEnd(cells, prepared) : cells);
  const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

  switch (source.layout) {
    case "rows": {
      const made = [];
      for (let r = 0; r < rows; r++) {
        const cells = tidy(range(cols, (c) => r * cols + c));
        if (cells.length) made.push({ key: `r${r}`, name: rows === 1 ? source.name : `row_${r}`, cells });
      }
      return made;
    }
    case "columns": {
      const made = [];
      for (let c = 0; c < cols; c++) {
        const cells = tidy(range(rows, (r) => r * cols + c));
        if (cells.length) made.push({ key: `c${c}`, name: cols === 1 ? source.name : `column_${c}`, cells });
      }
      return made;
    }
    case "across":
      return [{ key: "all", name: source.name, cells: tidy(range(count, (i) => i)) }];
    case "down":
      return [{ key: "all", name: source.name, cells: tidy(range(count, (i) => (i % rows) * cols + Math.floor(i / rows))) }];
    case "tags":
      if (source.tags) return source.tags.map((tag, i) => ({ key: `t${i}`, name: tag.name, cells: tag.cells, fps: tag.fps }));
      return [{ key: "all", name: source.name, cells: range(count, (i) => i) }];
    case "all":
    default:
      return [{ key: "all", name: source.name, cells: range(count, (i) => i) }];
  }
}

/** The cells without any empty frames at the end (an unfinished row of a sheet). */
function dropEmptyEnd(cells, prepared) {
  const kept = cells.slice();
  while (kept.length && prepared.isEmpty(kept[kept.length - 1])) kept.pop();
  return kept;
}
