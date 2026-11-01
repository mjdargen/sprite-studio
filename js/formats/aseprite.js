/*
  Loading Aseprite files (.aseprite / .ase), from https://www.aseprite.org.

  An Aseprite file is binary. It has a 128-byte header, then each frame in
  turn. A frame is a list of "chunks"; the ones we use are:

    0x2004 layer    a layer's name, visibility, opacity and place in groups
    0x2005 cel      one layer's picture in one frame (often zlib-compressed)
    0x2018 tags     the named animations ("idle" is frames 0-4, ...)
    0x2019 palette  the colors, for indexed-color sprites
    0x0004 palette  the older palette format, used if there's no 0x2019

  We draw each frame's visible layers from the bottom up to get the finished
  frame, and turn the tags into animations.

  The format is described at
  https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md

  Not supported (each is rare in sprites made for games): blend modes other
  than normal (they're drawn as normal), tilemap layers, and the slices and
  user data Aseprite can save.
*/

import { newCanvas, context, canvasFromPixels } from "../util/canvas.js";

/**
 * Open an Aseprite file.
 * Returns { frames: [canvas...], durations: [ms...], tags: [{ name, from, to, direction }] }.
 */
export async function loadAsepriteFile(file) {
  return decodeAseprite(new Uint8Array(await file.arrayBuffer()));
}

/** Decode the bytes of an Aseprite file (see loadAsepriteFile). */
export async function decodeAseprite(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Aseprite numbers are little-endian
  const u8 = (at) => view.getUint8(at);
  const u16 = (at) => view.getUint16(at, true);
  const i16 = (at) => view.getInt16(at, true);
  const u32 = (at) => view.getUint32(at, true);
  // A STRING is a 2-byte length then UTF-8 text
  const string = (at) => {
    const length = u16(at);
    return { text: new TextDecoder().decode(bytes.subarray(at + 2, at + 2 + length)), end: at + 2 + length };
  };

  // ---- Header (128 bytes) ----
  if (bytes.length < 128 || u16(4) !== 0xa5e0) throw new Error("this isn't an Aseprite file.");
  const frameCount = u16(6);
  const width = u16(8);
  const height = u16(10);
  const colorDepth = u16(12); // 32 = RGBA, 16 = grayscale, 8 = indexed (palette)
  const headerFlags = u32(14);
  const transparentIndex = u8(28); // indexed sprites: this color is see-through
  const layerOpacityIsValid = (headerFlags & 1) !== 0;

  const layers = [];
  const palette = [];
  let tags = [];
  const frames = []; // { duration, cels: [...] }

  // ---- Frames ----
  let pos = 128;
  for (let f = 0; f < frameCount; f++) {
    const frameStart = pos;
    const frameBytes = u32(pos);
    if (u16(pos + 4) !== 0xf1fa) throw new Error("the Aseprite file is damaged.");
    const oldChunkCount = u16(pos + 6);
    const duration = u16(pos + 8);
    const newChunkCount = u32(pos + 12);
    const chunkCount = newChunkCount || oldChunkCount;
    pos += 16;

    const cels = [];
    for (let c = 0; c < chunkCount; c++) {
      const chunkSize = u32(pos);
      const type = u16(pos + 4);
      const d = pos + 6; // where the chunk's data starts

      if (type === 0x2004) {
        // Layer
        const flags = u16(d);
        layers.push({
          visible: (flags & 1) !== 0,
          background: (flags & 8) !== 0,
          reference: (flags & 64) !== 0, // a reference image, not part of the art
          type: u16(d + 2), // 0 = normal, 1 = group, 2 = tilemap
          childLevel: u16(d + 4),
          opacity: layerOpacityIsValid ? u8(d + 12) / 255 : 1,
          name: string(d + 16).text,
        });
      } else if (type === 0x2005) {
        // Cel: one layer's picture in this frame
        const cel = {
          layer: u16(d),
          x: i16(d + 2),
          y: i16(d + 4),
          opacity: u8(d + 6) / 255,
          type: u16(d + 7), // 0 = raw, 1 = linked to another frame, 2 = compressed, 3 = tilemap
          zIndex: i16(d + 9),
        };
        const data = d + 16;
        const end = pos + chunkSize;
        if (cel.type === 0 || cel.type === 2) {
          cel.width = u16(data);
          cel.height = u16(data + 2);
          cel.bytes = bytes.subarray(data + 4, end);
        } else if (cel.type === 1) {
          cel.linkedFrame = u16(data);
        }
        cels.push(cel);
      } else if (type === 0x2018) {
        // Tags (animations)
        const count = u16(d);
        let p = d + 10;
        tags = [];
        for (let t = 0; t < count; t++) {
          const name = string(p + 17);
          tags.push({ from: u16(p), to: u16(p + 2), direction: u8(p + 4), name: name.text });
          p = name.end;
        }
      } else if (type === 0x2019) {
        // Palette
        const first = u32(d + 4);
        const last = u32(d + 8);
        let p = d + 20;
        for (let i = first; i <= last; i++) {
          const entryFlags = u16(p);
          palette[i] = [u8(p + 2), u8(p + 3), u8(p + 4), u8(p + 5)];
          p += 6;
          if (entryFlags & 1) p = string(p).end; // the color has a name
        }
      } else if (type === 0x0004 && !palette.length) {
        // Old palette format
        const packets = u16(d);
        let p = d + 2;
        let index = 0;
        for (let k = 0; k < packets; k++) {
          index += u8(p);
          const count = u8(p + 1) || 256;
          p += 2;
          for (let i = 0; i < count; i++, p += 3) palette[index++] = [u8(p), u8(p + 1), u8(p + 2), 255];
        }
      }
      pos += chunkSize;
    }
    frames.push({ duration, cels });
    pos = frameStart + frameBytes;
  }

  // ---- Which layers show: hidden groups hide everything in them ----
  const shownAtLevel = [];
  const opacityAtLevel = [];
  for (const layer of layers) {
    const parentShown = layer.childLevel === 0 || shownAtLevel[layer.childLevel - 1];
    const parentOpacity = layer.childLevel === 0 ? 1 : opacityAtLevel[layer.childLevel - 1];
    layer.shown = parentShown && layer.visible && !layer.reference;
    layer.finalOpacity = parentOpacity * layer.opacity;
    shownAtLevel[layer.childLevel] = layer.shown;
    opacityAtLevel[layer.childLevel] = layer.finalOpacity;
  }

  // ---- Draw each frame ----
  const pictures = new Map(); // cel -> canvas, so linked cels are only decoded once
  const celPicture = async (cel, layer) => {
    if (!pictures.has(cel)) {
      const raw = cel.type === 2 ? await inflate(cel.bytes) : cel.bytes;
      pictures.set(cel, canvasFromPixels(toRGBA(raw, cel.width, cel.height, layer), cel.width, cel.height));
    }
    return pictures.get(cel);
  };

  // Turn a cel's pixels into RGBA, whatever the sprite's color mode
  function toRGBA(raw, w, h, layer) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      if (colorDepth === 32) {
        out.set(raw.subarray(i * 4, i * 4 + 4), i * 4);
      } else if (colorDepth === 16) {
        const value = raw[i * 2];
        out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = value;
        out[i * 4 + 3] = raw[i * 2 + 1];
      } else {
        const index = raw[i];
        if (index === transparentIndex && !layer.background) continue;
        const color = palette[index] || [0, 0, 0, 0];
        out.set(color, i * 4);
      }
    }
    return out;
  }

  const finished = [];
  for (const frame of frames) {
    const canvas = newCanvas(width, height);
    const ctx = context(canvas);
    // Layers are drawn bottom first. A cel's z-index can move it up or down.
    const ordered = frame.cels
      .filter((cel) => layers[cel.layer] && layers[cel.layer].shown && layers[cel.layer].type === 0)
      .sort((a, b) => (a.layer + a.zIndex) - (b.layer + b.zIndex) || a.zIndex - b.zIndex);
    for (let cel of ordered) {
      const layer = layers[cel.layer];
      const opacity = cel.opacity;
      if (cel.type === 1) {
        // A linked cel reuses the picture from another frame on the same layer
        const linked = frames[cel.linkedFrame] && frames[cel.linkedFrame].cels.find((c) => c.layer === cel.layer);
        if (!linked || linked.type === 1) continue;
        cel = { ...linked, x: cel.x, y: cel.y, original: linked };
      }
      if (cel.type !== 0 && cel.type !== 2) continue; // tilemaps aren't supported
      const picture = await celPicture(cel.original || cel, layer);
      ctx.globalAlpha = opacity * layer.finalOpacity;
      ctx.drawImage(picture, cel.x, cel.y);
    }
    ctx.globalAlpha = 1;
    finished.push(canvas);
  }

  return {
    frames: finished,
    durations: frames.map((f) => f.duration),
    tags,
  };
}

/** Unpack zlib-compressed bytes, using the browser's built-in decompressor. */
async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
