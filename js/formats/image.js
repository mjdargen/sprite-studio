/*
  Loading ordinary images: PNG, JPG, WebP, BMP (and anything else the
  browser can open as a picture).

  The browser does the decoding. We copy the result into a canvas so the rest
  of the app can read and cut its pixels.
*/

import { newCanvas, context } from "../util/canvas.js";

/** Open an image file and return it as a canvas. */
export async function loadImageFile(file) {
  let bitmap;
  try {
    // premultiplyAlpha/colorSpaceConversion "none" keep the exact colors in
    // the file, so a background color can be matched exactly
    bitmap = await createImageBitmap(file, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  } catch {
    throw new Error("your browser couldn't open it as an image.");
  }
  const canvas = newCanvas(bitmap.width, bitmap.height);
  context(canvas).drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/**
 * Open an image from a data: URL (Piskel files store their frames this way)
 * and return it as an <img> element.
 */
export function imageFromDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("an image inside the file couldn't be read."));
    img.src = url;
  });
}
