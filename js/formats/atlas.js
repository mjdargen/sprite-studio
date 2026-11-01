/*
  Loading sprite sheets that come with a .json file describing them.

  Aseprite ("Export Sprite Sheet" with "JSON Data" ticked), TexturePacker,
  Free Texture Packer and many asset packs save an image plus a .json file
  that says where each frame is. Frames may be packed in any order and
  trimmed, so we rebuild every frame at its full size from the JSON.

  The JSON looks like this (the "frames" can be a list or an object):

    {
      "frames": {
        "hero 0.aseprite": {
          "frame": { "x": 0, "y": 0, "w": 20, "h": 30 },      where it is in the image
          "trimmed": true,
          "spriteSourceSize": { "x": 6, "y": 2, "w": 20, "h": 30 }, where it goes in the frame
          "sourceSize": { "w": 32, "h": 32 },                 the frame's full size
          "duration": 100                                      milliseconds (Aseprite only)
        }, ...
      },
      "meta": {
        "image": "hero.png",
        "frameTags": [ { "name": "idle", "from": 0, "to": 3, "direction": "forward" } ]
      }
    }
*/

import { newCanvas, context } from "../util/canvas.js";

/** True if parsed JSON looks like a sprite sheet description. */
export function isAtlas(data) {
  return Boolean(data && data.frames && typeof data.frames === "object");
}

/** The image file name the JSON says it goes with, if any. */
export function atlasImageName(data) {
  return data.meta && typeof data.meta.image === "string" ? data.meta.image.split(/[\\/]/).pop() : null;
}

/**
 * Cut the frames out of `image` (a canvas) using the parsed JSON.
 * Returns { frames: [canvas...], durations: [ms...], tags: [{ name, from, to, direction }] }.
 */
export function framesFromAtlas(data, image) {
  const entries = Array.isArray(data.frames) ? data.frames : Object.values(data.frames);
  if (!entries.length) throw new Error("the .json file doesn't list any frames.");

  const frames = entries.map((entry, i) => {
    const rect = entry.frame;
    if (!rect) throw new Error(`frame ${i} in the .json file has no position.`);
    if (entry.rotated) {
      throw new Error("some frames are rotated. Export the sheet again with rotation turned off.");
    }
    const full = entry.sourceSize || { w: rect.w, h: rect.h };
    const place = entry.spriteSourceSize || { x: 0, y: 0 };
    const canvas = newCanvas(full.w, full.h);
    context(canvas).drawImage(image, rect.x, rect.y, rect.w, rect.h, place.x, place.y, rect.w, rect.h);
    return canvas;
  });

  // Aseprite writes the direction as a word; convert it to Aseprite's number
  const directions = { forward: 0, reverse: 1, pingpong: 2, pingpong_reverse: 3 };
  const tags = ((data.meta && data.meta.frameTags) || []).map((tag) => ({
    name: tag.name,
    from: tag.from,
    to: tag.to,
    direction: directions[tag.direction] || 0,
  }));

  return { frames, durations: entries.map((e) => e.duration || 0), tags };
}
