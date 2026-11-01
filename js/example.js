/*
  The examples shown before the student adds anything. They're ordinary PNG
  files in the examples/ folder, so students can download them and try every
  step themselves, and you can change an example by replacing its PNG (then
  update the settings below to match).

  examples/slime.png is a slime with two animations (idle, then hop). It has
  a pink background to remove, gaps between the frames and an unfinished
  first row, so the background, gap and "leave out empty frames" settings all
  have something to do.

  examples/terrain.png is a small tile set with a 1-pixel gap between tiles,
  the way many downloaded tile sets come.
*/

import { loadImageFile } from "./formats/image.js";

/** Each example: its file, how to cut it, and names and speeds for its rows. */
export const EXAMPLES = {
  sprites: {
    file: "slime.png",
    name: "slime",
    grid: { width: 32, height: 32, margin: 4, spacing: 4 },
    animations: [
      { key: "r0", name: "idle", fps: 6 },
      { key: "r1", name: "hop", fps: 10 },
    ],
  },
  tiles: {
    file: "terrain.png",
    name: "terrain",
    grid: { width: 16, height: 16, margin: 0, spacing: 1 },
    animations: [],
  },
};

/** Where an example file is, worked out from this file so it works on any web address. */
export function exampleUrl(mode) {
  return new URL(`../examples/${EXAMPLES[mode].file}`, import.meta.url).href;
}

/**
 * Load the example for "sprites" or "tiles" as a spec (see js/formats/index.js).
 * Returns null if the file couldn't be loaded.
 */
export async function loadExampleSpec(mode) {
  const example = EXAMPLES[mode];
  try {
    const response = await fetch(exampleUrl(mode));
    if (!response.ok) return null;
    const image = await loadImageFile(await response.blob());
    return {
      kind: "sheet",
      name: example.name,
      image,
      grid: { ...example.grid },
      note: `${image.width}×${image.height} image (example)`,
    };
  } catch {
    return null;
  }
}
