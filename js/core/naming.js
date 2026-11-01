/*
  Choosing the names that end up in the student's game: the sheet's file
  name, and the animation names that become Python variables.

  The code we write looks like:   hero_run = Sprite("hero", ...)
                                  ^^^^ ^^^           ^^^^
                          sheet name + animation name   sheet name
*/

import { cleanName, commonPrefix } from "../util/names.js";

/**
 * The name we suggest for the sheet: the name all the files share
 * ("alien_beige_walk" + "alien_beige_jump" -> "alien_beige"), or the first
 * file's name.
 */
export function suggestedName(state) {
  const fallback = state.mode === "tiles" ? "tiles" : "sprite";
  const names = state.sources.map((s) => cleanName(s.name, fallback));
  if (!names.length) return fallback;
  const shared = commonPrefix(names);
  return shared.length >= 2 ? shared : names[0];
}

/** The sheet's name: what the student typed (cleaned up), or the suggestion. */
export function sheetName(state) {
  const typed = state.settings.name.trim();
  return typed ? cleanName(typed, state.mode === "tiles" ? "tiles" : "sprite") : suggestedName(state);
}

/**
 * Final animation names, in the same order as `names`:
 * - cleaned up so they work in Python ("Run Left" -> "run_left")
 * - without the sheet's name in front ("hero_run" -> "run" on sheet "hero"),
 *   so the variable is hero_run rather than hero_hero_run
 * - made unique by adding _2, _3...
 */
export function animationNames(names, sheet) {
  const used = new Set();
  return names.map((raw) => {
    let name = cleanName(raw, "animation");
    if (name.startsWith(sheet + "_") && name.length > sheet.length + 1) name = name.slice(sheet.length + 1);
    if (/^[0-9]/.test(name)) name = "animation_" + name;
    let unique = name;
    for (let n = 2; used.has(unique); n++) unique = `${name}_${n}`;
    used.add(unique);
    return unique;
  });
}
