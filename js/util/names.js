/*
  Helpers for file and animation names.

  Pygame Zero Plus loads images by name (Sprite("hero") loads sprites/hero.png),
  and the code we write makes Python variables from names. So names must be
  lowercase letters, numbers and underscores, and must not start with a number.
  cleanName() makes any name follow those rules, the same way
  utils/lowercase_filenames.py does in the course repository.
*/

/**
 * Make a name safe for Pygame Zero Plus and Python.
 *   "PlayerIdle" -> "player_idle", "HUDIcon" -> "hud_icon",
 *   "tiles (1)" -> "tiles_1", "2player" -> "sprite_2player" (with fallback "sprite")
 * Returns `fallback` if nothing usable is left.
 */
export function cleanName(text, fallback = "sprite") {
  let name = String(text)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // playerIdle -> player_Idle
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2") // HUDIcon -> HUD_Icon
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // spaces, dashes, brackets -> _
    .replace(/^_+|_+$/g, "");
  if (!name) return fallback;
  if (/^[0-9]/.test(name)) name = `${fallback}_${name}`;
  return name;
}

/** "hero_run.png" -> "hero_run" */
export function stem(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

/** "png" for "Hero.PNG" */
export function extension(filename) {
  const match = /\.([^.]+)$/.exec(filename);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Split a number off the end of a name.
 *   "walk_02" -> { base: "walk", number: 2 }
 *   "walk"    -> { base: "walk", number: null }
 */
export function splitTrailingNumber(name) {
  const match = /^(.*?)[\s_-]*(\d+)$/.exec(name);
  if (!match || !match[1]) return { base: name, number: null };
  return { base: match[1], number: parseInt(match[2], 10) };
}

/**
 * The words that all the names start with, e.g.
 *   ["alien_beige_walk", "alien_beige_jump"] -> "alien_beige"
 * Names are split into words at underscores. Returns "" if nothing is shared.
 */
export function commonPrefix(names) {
  if (!names.length) return "";
  const split = names.map((n) => n.split("_"));
  const shared = [];
  for (let i = 0; i < split[0].length; i++) {
    const word = split[0][i];
    if (!split.every((words) => words[i] === word)) break;
    shared.push(word);
  }
  return shared.join("_");
}

/** Sort names the way people expect: "walk2" before "walk10". */
export function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
