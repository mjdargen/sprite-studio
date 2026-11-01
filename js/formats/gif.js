/*
  Loading animated GIFs.

  Browsers can show a GIF but don't give you its separate frames everywhere, so
  this file decodes GIFs itself. It's a complete GIF decoder in three parts:

    1. decodeGif()  reads the file's blocks (color tables, frame timing, frames)
    2. lzwDecode()  unpacks one frame's compressed pixels (GIFs use LZW compression)
    3. the frames are drawn onto a "screen" one after another, because a GIF
       frame often only stores the part of the picture that changed

  The file format is described at https://www.w3.org/Graphics/GIF/spec-gif89a.txt
  and, more readably, at https://giflib.sourceforge.net/whatsinagif/.
*/

import { canvasFromPixels } from "../util/canvas.js";

/**
 * Open a GIF file. Returns { frames: [canvas...], durations: [ms...] }.
 */
export async function loadGifFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const gif = decodeGif(bytes);
  if (!gif.frames.length) throw new Error("the GIF has no frames.");
  return {
    frames: gif.frames.map((f) => canvasFromPixels(f.pixels, gif.width, gif.height)),
    durations: gif.frames.map((f) => f.delay),
  };
}

/**
 * Decode a whole GIF.
 * Returns { width, height, frames: [{ pixels, delay }] } where pixels is the
 * full picture (RGBA) at that frame and delay is in milliseconds.
 */
export function decodeGif(bytes) {
  let pos = 0;
  const u8 = () => {
    if (pos >= bytes.length) throw new RangeError("end of file");
    return bytes[pos++];
  };
  const u16 = () => u8() | (u8() << 8); // GIF numbers are little-endian

  // A color table: `count` colors of 3 bytes (red, green, blue)
  const readColorTable = (count) => {
    const table = bytes.subarray(pos, pos + count * 3);
    pos += count * 3;
    return table;
  };

  // Data comes in "sub-blocks": a length byte, then that many bytes, until a 0 length
  const skipSubBlocks = () => {
    for (let size = u8(); size !== 0; size = u8()) pos += size;
  };
  const readSubBlocks = () => {
    const parts = [];
    let total = 0;
    for (let size = u8(); size !== 0; size = u8()) {
      parts.push(bytes.subarray(pos, pos + size));
      pos += size;
      total += size;
    }
    const data = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      data.set(part, offset);
      offset += part.length;
    }
    return data;
  };

  // ---- Header: "GIF87a" or "GIF89a", then the picture's size ----
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (!/^GIF8[79]a$/.test(signature)) throw new Error("this isn't a GIF file.");
  pos = 6;
  const width = u16();
  const height = u16();
  const flags = u8();
  u8(); // background color index (browsers show see-through instead, and so do we)
  u8(); // pixel aspect ratio (ignored)
  const globalTable = flags & 0x80 ? readColorTable(1 << ((flags & 0x07) + 1)) : null;

  // The picture so far. Each frame is drawn on top of it.
  const screen = new Uint8ClampedArray(width * height * 4);
  const frames = [];
  let control = null; // timing and transparency for the next frame

  try {
    for (;;) {
      const block = u8();

      if (block === 0x21) {
        // ---- Extension block ----
        const label = u8();
        if (label === 0xf9) {
          // Graphic control: how long to show the next frame, its see-through
          // color, and what to do with it before drawing the frame after it
          const size = u8();
          const packed = u8();
          const delay = u16();
          const transparentIndex = u8();
          pos += size - 4;
          skipSubBlocks();
          control = {
            disposal: (packed >> 2) & 0x07,
            transparent: packed & 0x01 ? transparentIndex : -1,
            delay: delay * 10, // stored in hundredths of a second
          };
        } else {
          skipSubBlocks(); // comments, looping settings, etc.
        }
      } else if (block === 0x2c) {
        // ---- A frame ----
        const left = u16();
        const top = u16();
        const w = u16();
        const h = u16();
        const packed = u8();
        const table = packed & 0x80 ? readColorTable(1 << ((packed & 0x07) + 1)) : globalTable;
        const interlaced = (packed & 0x40) !== 0;
        const minCodeSize = u8();
        const indices = lzwDecode(minCodeSize, readSubBlocks(), w * h);
        const c = control || { disposal: 0, transparent: -1, delay: 0 };

        // Disposal 3 means "put the picture back how it was after this frame"
        const saved = c.disposal === 3 ? screen.slice() : null;

        // Interlaced frames store their rows out of order: every 8th row from
        // row 0, then every 8th from row 4, every 4th from 2, every 2nd from 1
        const rowOrder = interlaced ? interlacedRows(h) : null;

        for (let i = 0; i < h; i++) {
          const y = top + (rowOrder ? rowOrder[i] : i);
          if (y >= height) continue;
          for (let x = 0; x < w; x++) {
            const index = indices[i * w + x];
            if (index === c.transparent || !table || index * 3 >= table.length) continue;
            const sx = left + x;
            if (sx >= width) continue;
            const o = (y * width + sx) * 4;
            screen[o] = table[index * 3];
            screen[o + 1] = table[index * 3 + 1];
            screen[o + 2] = table[index * 3 + 2];
            screen[o + 3] = 255;
          }
        }
        frames.push({ pixels: screen.slice(), delay: c.delay });

        // Get the picture ready for the next frame
        if (c.disposal === 2) {
          // "Restore to background": browsers clear the frame's area to see-through
          for (let y = top; y < Math.min(top + h, height); y++) {
            screen.fill(0, (y * width + left) * 4, (y * width + Math.min(left + w, width)) * 4);
          }
        } else if (saved) {
          screen.set(saved);
        }
        control = null;
      } else {
        break; // 0x3b is the end of the file; anything else, we stop too
      }
    }
  } catch (error) {
    // A cut-off file still has its first frames; only give up if there are none
    if (!(error instanceof RangeError) || !frames.length) throw error;
  }
  return { width, height, frames };
}

/** For an interlaced frame of height h: the real row of each stored row. */
function interlacedRows(h) {
  const rows = [];
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
    for (let y = start; y < h; y += step) rows.push(y);
  }
  return rows;
}

/**
 * Unpack LZW-compressed GIF pixels into a list of color indices.
 *
 * LZW builds a dictionary as it reads: codes below `clearCode` are single
 * colors, and each new code means "the previous code's colors plus one
 * more". Codes are packed into bytes with a growing number of bits (from
 * minCodeSize + 1 up to 12).
 *
 * The dictionary is stored as two lists: prefix[code] (the code it extends)
 * and suffix[code] (the color it adds). Reading a code's colors means
 * walking back through its prefixes, which gives them in reverse, so they go
 * on a stack first.
 */
export function lzwDecode(minCodeSize, data, pixelCount) {
  const out = new Uint8Array(pixelCount);
  const clearCode = 1 << minCodeSize; // "start the dictionary again"
  const endCode = clearCode + 1; // "no more pixels"
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  for (let i = 0; i < clearCode; i++) suffix[i] = i;

  let codeSize = minCodeSize + 1;
  let codeMask = (1 << codeSize) - 1;
  let nextCode = endCode + 1;
  let prevCode = -1;
  let firstColor = 0; // first color of the last code read
  let bits = 0; // bits waiting to be read
  let bitCount = 0;
  let pos = 0;
  let outPos = 0;

  while (outPos < pixelCount) {
    // Read the next code
    while (bitCount < codeSize) {
      if (pos >= data.length) return out;
      bits |= data[pos++] << bitCount;
      bitCount += 8;
    }
    let code = bits & codeMask;
    bits >>>= codeSize;
    bitCount -= codeSize;

    if (code === clearCode) {
      codeSize = minCodeSize + 1;
      codeMask = (1 << codeSize) - 1;
      nextCode = endCode + 1;
      prevCode = -1;
      continue;
    }
    if (code === endCode) break;

    if (prevCode === -1) {
      // The first code after a clear is always a single color
      if (code >= clearCode) return out; // broken file
      out[outPos++] = code;
      prevCode = firstColor = code;
      continue;
    }

    const thisCode = code;
    let sp = 0;
    if (code >= nextCode) {
      // A code that isn't in the dictionary yet: it must be the previous
      // code's colors plus their own first color
      stack[sp++] = firstColor;
      code = prevCode;
    }
    while (code > endCode) {
      stack[sp++] = suffix[code];
      code = prefix[code];
    }
    firstColor = code;
    stack[sp++] = code;

    // Add "previous code + this code's first color" to the dictionary
    if (nextCode < 4096) {
      prefix[nextCode] = prevCode;
      suffix[nextCode] = firstColor;
      nextCode++;
      if (nextCode > codeMask && codeSize < 12) {
        codeSize++;
        codeMask = (1 << codeSize) - 1;
      }
    }
    prevCode = thisCode;

    while (sp > 0 && outPos < pixelCount) out[outPos++] = stack[--sp];
  }
  return out;
}
