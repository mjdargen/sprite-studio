/*
  Building the sprite sheet (sprites mode).

  Pygame Zero Plus's Sprite reads one animation per row, with every frame the
  same size:

      +------+------+------+------+
      | idle | idle | idle |      |   row 0: Sprite("hero", ..., row=0, frames=3)
      +------+------+------+------+
      | run  | run  | run  | run  |   row 1: Sprite("hero", ..., row=1, frames=4)
      +------+------+------+------+

  So buildSpriteSheet():
    1. puts the animations in the student's order (state.order)
    2. gets each animation's frames (background already removed, prepare.js)
    3. cleans them up: cut edges, trim, pad, resize, colors (clean-up.js)
    4. makes every cell as big as the biggest frame, and lines smaller frames
       up at the bottom or center
    5. draws everything onto one canvas

  It returns:
    {
      sheet,                    the finished canvas
      cellWidth, cellHeight,    the frame size for the code
      columns,                  the most frames in any row
      rows: [{ animId, sourceId, name, frames, fps, loop }],
      warnings: [text...]       problems worth telling the student about
    }
  or null if there's nothing to build yet.
*/

import { newCanvas, context } from "../util/canvas.js";
import { prepare, solidBackground } from "./prepare.js";
import { cropEdges, sharedBox, trimToBox, pad, scale, filterColors } from "./clean-up.js";
import { sheetName, animationNames } from "./naming.js";

/** Browsers and graphics cards struggle with images bigger than this. */
const BIG_SIZE = 4096;

export function buildSpriteSheet(state) {
  const { settings } = state;
  const warnings = [];
  syncOrder(state);

  // 1-2. The animations in sheet order, with their frames
  const animations = [];
  for (const id of state.order) {
    const found = findAnim(state, id);
    if (!found) continue;
    const { source, anim } = found;
    if (!anim.cells.length) {
      warnings.push(`"${anim.name}" has no frames yet, so it isn't in the sheet. Select it in step 2, then click frames in "Your file".`);
      continue;
    }
    const prepared = prepare(source, settings.background);
    const frames = cropEdges(anim.cells.map((i) => prepared.frame(i)), settings.crop);
    animations.push({ source, anim, frames });
  }
  if (!animations.length) return null;

  // A solid background that's still there is almost always a mistake, since
  // the game would draw it as a box around the character
  if (settings.background.mode === "off") {
    for (const source of new Set(animations.map((a) => a.source))) {
      const color = solidBackground(source.kind === "sheet" ? source.image : source.frames[0]);
      if (color) {
        warnings.push(`${source.name} has a solid background (${color}), which your game will draw as a box. ` +
          `To make it see-through, go to step 3 and choose "Make the top-left corner's color see-through".`);
      }
    }
  }

  // 3. Trim, then pad
  if (settings.trim === "file") {
    // One box for everything from the same file, so the art doesn't jump
    // around when the Actor changes animation
    for (const source of new Set(animations.map((a) => a.source))) {
      const group = animations.filter((a) => a.source === source);
      const box = sharedBox(group.flatMap((a) => a.frames));
      for (const a of group) a.frames = box ? trimToBox(a.frames, box, settings.padding) : pad(a.frames, settings.padding);
    }
  } else if (settings.trim === "each") {
    for (const a of animations) {
      const box = sharedBox(a.frames);
      a.frames = box ? trimToBox(a.frames, box, settings.padding) : pad(a.frames, settings.padding);
    }
  } else {
    for (const a of animations) a.frames = pad(a.frames, settings.padding);
  }

  // 3. Resize
  for (const a of animations) a.frames = scale(a.frames, settings.scale, settings.smooth);
  if (!settings.smooth && !Number.isInteger(settings.scale) && !Number.isInteger(1 / settings.scale)) {
    warnings.push("Pixel art can look uneven at this size. Whole sizes (2×, 3×) or halves and quarters work best.");
  }

  // 3. Colors
  for (const a of animations) a.frames = filterColors(a.frames, settings.filters);

  // 4. Every cell is the size of the biggest frame
  const allFrames = animations.flatMap((a) => a.frames);
  const cellWidth = Math.max(...allFrames.map((f) => f.width));
  const cellHeight = Math.max(...allFrames.map((f) => f.height));
  const columns = Math.max(...animations.map((a) => a.frames.length));
  if (allFrames.some((f) => f.width !== cellWidth || f.height !== cellHeight)) {
    const where = settings.align === "bottom" ? "at the bottom" : "in the middle";
    warnings.push(`Some frames are smaller than ${cellWidth}×${cellHeight}, so they're lined up ${where} of their space.`);
  }

  // 5. Draw the sheet
  const sheet = newCanvas(columns * cellWidth, animations.length * cellHeight);
  const ctx = context(sheet);
  animations.forEach((a, row) => {
    a.frames.forEach((frame, col) => {
      const x = col * cellWidth + Math.floor((cellWidth - frame.width) / 2);
      const spare = cellHeight - frame.height;
      const y = row * cellHeight + (settings.align === "bottom" ? spare : Math.floor(spare / 2));
      ctx.drawImage(frame, x, y);
    });
  });
  if (sheet.width > BIG_SIZE || sheet.height > BIG_SIZE) {
    warnings.push(`The sheet is ${sheet.width}×${sheet.height} pixels, which is very big. Try a smaller size or fewer animations.`);
  }

  const names = animationNames(animations.map((a) => a.anim.name), sheetName(state));
  return {
    sheet,
    cellWidth,
    cellHeight,
    columns,
    rows: animations.map((a, i) => ({
      animId: a.anim.id,
      sourceId: a.source.id,
      name: names[i],
      frames: a.frames,
      fps: a.anim.fps,
      loop: a.anim.loop,
    })),
    warnings,
  };
}

/**
 * Keep state.order (the sheet's row order) in step with the animations that
 * exist: drop ones that are gone, and add new ones next to the others from
 * the same file, so a file's animations stay together. (Animation ids start
 * with their file's id, e.g. "3:rows:r0".)
 */
export function syncOrder(state) {
  const exists = new Set(state.sources.flatMap((s) => s.anims.map((a) => a.id)));
  // Where each file's animations were before anything was dropped, so a file
  // whose animations were all replaced (its layout changed) keeps its place
  const firstPlace = new Map();
  state.order.forEach((id, i) => {
    const file = id.split(":")[0];
    if (!firstPlace.has(file)) firstPlace.set(file, i);
  });

  const order = state.order.filter((id) => exists.has(id));
  const listed = new Set(order);
  const fileOf = (id) => id.split(":")[0];
  for (const source of state.sources) {
    const file = String(source.id);
    for (const anim of source.anims) {
      if (listed.has(anim.id)) continue;
      let at = order.length;
      const lastSameFile = order.map(fileOf).lastIndexOf(file);
      if (lastSameFile >= 0) {
        at = lastSameFile + 1; // after this file's other animations
      } else if (firstPlace.has(file)) {
        // Where this file used to start: before the first animation of any
        // file that came after it in the old order
        const later = order.findIndex((id) => (firstPlace.get(fileOf(id)) ?? Infinity) > firstPlace.get(file));
        if (later >= 0) at = later;
      }
      order.splice(at, 0, anim.id);
      listed.add(anim.id);
    }
  }
  state.order = order;
}

function findAnim(state, id) {
  for (const source of state.sources) {
    const anim = source.anims.find((a) => a.id === id);
    if (anim) return { source, anim };
  }
  return null;
}
