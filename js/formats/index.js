/*
  Turning dropped files into "specs": a description of each piece of art,
  ready to become a source (see js/core/sources.js).

  There are two kinds of spec:

    { kind: "sheet",  name, image, note }
        One picture that still needs cutting into frames or tiles: a sprite
        sheet, a strip, or a single image. `image` is a canvas.

    { kind: "frames", name, frames, fps, tags, note }
        Art that's already in separate frames: a GIF, an Aseprite or Piskel
        file, a sheet with a .json file, or several numbered images.
        `frames` is a list of canvases (all the same size). `tags` is a list
        of named animations from the file, [{ name, cells, fps }] where cells
        are frame numbers, or null if the file has none.

  To support a new file type: write a loader in this folder that returns
  frames (or an image), then add a branch for its extension in loadFiles().
*/

import { newCanvas, context } from "../util/canvas.js";
import { stem, extension, splitTrailingNumber, commonPrefix, cleanName, naturalCompare } from "../util/names.js";
import { loadImageFile } from "./image.js";
import { loadGifFile } from "./gif.js";
import { loadPiskelFile } from "./piskel.js";
import { loadAsepriteFile } from "./aseprite.js";
import { isAtlas, atlasImageName, framesFromAtlas } from "./atlas.js";

/** File extensions the browser can open as pictures. */
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "avif"];

/** The frames per second to use when a file doesn't say. */
export const DEFAULT_FPS = 8;

/**
 * Load a list of files (from the file picker or a drop).
 *
 * options.mode          "sprites" or "tiles", which changes how loose images are grouped
 * options.groupNumbered join walk1.png, walk2.png... into one animation (sprites mode)
 *
 * Returns { specs, errors } where errors are messages for files that couldn't be used.
 */
export async function loadFiles(fileList, options) {
  const files = Array.from(fileList).sort((a, b) => naturalCompare(a.name, b.name));
  const specs = [];
  const errors = [];
  const stills = []; // plain images, grouped at the end: { name, image }

  // A .json file needs its image, so pair them up first
  const used = new Set();
  const jsonFiles = files.filter((f) => extension(f.name) === "json");
  for (const jsonFile of jsonFiles) {
    used.add(jsonFile);
    try {
      let data;
      try {
        data = JSON.parse(await jsonFile.text());
      } catch {
        throw new Error("it isn't a valid .json file.");
      }
      if (!isAtlas(data)) throw new Error("it doesn't describe a sprite sheet.");
      const wanted = atlasImageName(data);
      const imageFile = files.find((f) => !used.has(f) && IMAGE_EXTENSIONS.includes(extension(f.name)) &&
        (f.name === wanted || stem(f.name) === stem(jsonFile.name)));
      if (!imageFile) {
        throw new Error(`add its image (${wanted || stem(jsonFile.name) + ".png"}) at the same time as the .json file.`);
      }
      used.add(imageFile);
      const image = await loadImageFile(imageFile);
      const { frames, durations, tags } = framesFromAtlas(data, image);
      specs.push(framesSpec(stem(jsonFile.name), frames, durations, tags, `${frames.length} frames, from a .json sheet`));
    } catch (error) {
      errors.push(`${jsonFile.name}: ${error.message}`);
    }
  }

  // Everything else, by file type
  for (const file of files) {
    if (used.has(file)) continue;
    const ext = extension(file.name);
    const name = stem(file.name);
    try {
      if (ext === "gif") {
        const { frames, durations } = await loadGifFile(file);
        if (frames.length === 1) stills.push({ name, image: frames[0] });
        else specs.push(framesSpec(name, frames, durations, null, `GIF, ${frames.length} frames`));
      } else if (ext === "aseprite" || ext === "ase") {
        const { frames, durations, tags } = await loadAsepriteFile(file);
        const note = `Aseprite, ${frames.length} frames${tags.length ? `, ${tags.length} tags` : ""}`;
        specs.push(framesSpec(name, frames, durations, tags, note));
      } else if (ext === "piskel") {
        const { frames, fps } = await loadPiskelFile(file);
        specs.push({ kind: "frames", name, frames, fps, tags: null, note: `Piskel, ${frames.length} frames` });
      } else if (IMAGE_EXTENSIONS.includes(ext) || file.type.startsWith("image/")) {
        stills.push({ name, image: await loadImageFile(file) });
      } else {
        throw new Error("this kind of file isn't supported.");
      }
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }

  specs.push(...groupStills(stills, options));
  return { specs, errors };
}

/**
 * Make a "frames" spec, working out the speed from the file's frame times and
 * turning its tags into animations.
 */
function framesSpec(name, frames, durations, tags, note) {
  return {
    kind: "frames",
    name,
    frames,
    fps: fpsFromDurations(durations),
    tags: tags && tags.length
      ? tags.map((tag) => {
          const cells = tagCells(tag).filter((i) => i < frames.length);
          return { name: tag.name, cells, fps: fpsFromDurations(cells.map((i) => durations[i])) };
        })
      : null,
    note,
  };
}

/**
 * The frame numbers an Aseprite tag plays, in order.
 * direction: 0 forward, 1 reverse, 2 ping-pong, 3 ping-pong starting backwards.
 * Ping-pong doesn't repeat the end frames: 0 1 2 3 2 1.
 */
export function tagCells({ from, to, direction }) {
  const forward = [];
  for (let i = from; i <= to; i++) forward.push(i);
  const backward = forward.slice().reverse();
  if (direction === 1) return backward;
  if (direction === 2) return forward.concat(backward.slice(1, -1));
  if (direction === 3) return backward.concat(forward.slice(1, -1));
  return forward;
}

/**
 * Frames per second from a list of frame times in milliseconds. Uses the
 * middle value, so one long pause (common at the end of a GIF) doesn't slow
 * the whole animation down.
 */
export function fpsFromDurations(durations) {
  // Browsers play GIF delays of 0 or 10ms as 100ms, so we do too
  const times = (durations || []).map((ms) => (ms > 10 ? ms : 100)).sort((a, b) => a - b);
  if (!times.length) return DEFAULT_FPS;
  const middle = times[Math.floor(times.length / 2)];
  return Math.max(1, Math.min(60, Math.round(1000 / middle)));
}

/**
 * Decide what to do with plain images.
 *
 * Sprites mode, with groupNumbered on: images whose names only differ by a
 * number at the end (walk1, walk2...) become the frames of one animation.
 * Other images become sheets, to be cut up in step 2.
 *
 * Tiles mode: if every image is the same size, they're separate tiles and
 * become one "frames" spec (one tile each). Otherwise each is a sheet.
 */
function groupStills(stills, options) {
  if (!stills.length) return [];

  if (options.mode === "tiles") {
    const sameSize = stills.every((s) => s.image.width === stills[0].image.width && s.image.height === stills[0].image.height);
    if (stills.length > 1 && sameSize) {
      const name = commonPrefix(stills.map((s) => cleanName(s.name))) || "tiles";
      return [{ kind: "frames", name, frames: stills.map((s) => s.image), fps: DEFAULT_FPS, tags: null, note: `${stills.length} images, one tile each` }];
    }
    return stills.map((s) => sheetSpec(s));
  }

  if (!options.groupNumbered) return stills.map((s) => sheetSpec(s));

  // Group by name without the number: "walk2" -> "walk"
  const groups = new Map();
  for (const still of stills) {
    const { base, number } = splitTrailingNumber(still.name);
    const key = number === null ? still.name : base;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(still);
  }
  const specs = [];
  for (const [base, members] of groups) {
    if (members.length === 1) {
      specs.push(sheetSpec(members[0]));
    } else {
      const frames = padToSameSize(members.map((m) => m.image));
      specs.push({ kind: "frames", name: base, frames, fps: DEFAULT_FPS, tags: null, note: `${frames.length} numbered images` });
    }
  }
  return specs;
}

function sheetSpec({ name, image }) {
  return { kind: "sheet", name, image, note: `${image.width}×${image.height} image` };
}

/**
 * Make frames of different sizes the same size, by putting each one at the
 * bottom-center of a frame as big as the biggest.
 */
function padToSameSize(images) {
  const width = Math.max(...images.map((i) => i.width));
  const height = Math.max(...images.map((i) => i.height));
  return images.map((image) => {
    if (image.width === width && image.height === height) return image;
    const canvas = newCanvas(width, height);
    context(canvas).drawImage(image, Math.floor((width - image.width) / 2), height - image.height);
    return canvas;
  });
}
