/*
  Helpers for showing art on the page at a readable size.

  Pixel art is tiny, so the previews zoom it in by a whole number (2x, 3x...)
  to keep every pixel square and sharp. Art too big for its box is shrunk
  instead. The on-page canvas is drawn at the zoomed size, and the outlines
  and numbers are drawn on top of it in screen pixels.
*/

/**
 * How much to zoom a w x h image to fit in a maxW x maxH box: the biggest
 * whole number (up to `most`), or a fraction below 1 if it's too big.
 */
export function fitZoom(w, h, maxW, maxH, most = 12) {
  const fit = Math.min(maxW / w, maxH / h);
  return fit >= 1 ? Math.max(1, Math.min(most, Math.floor(fit))) : fit;
}

/** "3x" or "50%" for showing a zoom to the student. */
export function zoomLabel(zoom) {
  return zoom >= 1 ? `${zoom}×` : `${Math.round(zoom * 100)}%`;
}

/**
 * The space available for art inside a preview box (a .stage element).
 * The height is capped so a preview never fills the whole screen.
 */
export function stageSize(stage, maxHeight = 480) {
  const style = getComputedStyle(stage);
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2;
  return {
    width: Math.max(80, stage.clientWidth - padding),
    height: Math.max(140, Math.min(window.innerHeight * 0.45, maxHeight)),
  };
}

/**
 * Draw `image` onto the on-page `canvas`, `zoom` times bigger, and return the
 * canvas's 2D context so outlines can be drawn on top.
 * `background` is "checker" for the see-through checkerboard, or a CSS color.
 */
export function drawZoomed(canvas, image, zoom, background = "checker") {
  canvas.width = Math.max(1, Math.round(image.width * zoom));
  canvas.height = Math.max(1, Math.round(image.height * zoom));

  // Size the checkerboard so each square is a whole number of art pixels
  const square = Math.max(8, Math.round(8 * Math.max(1, zoom)));
  canvas.style.backgroundSize = `${square * 2}px ${square * 2}px`;
  canvas.style.backgroundPosition = `0 0, ${square}px ${square}px`;
  canvas.classList.toggle("solid", background !== "checker");

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (background !== "checker") {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Sharp pixels when zooming in; smooth when shrinking, so detail isn't lost
  ctx.imageSmoothingEnabled = zoom < 1;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return ctx;
}

/** Clear an on-page canvas when there's nothing to show. */
export function clearView(canvas) {
  canvas.width = 1;
  canvas.height = 1;
}

/** Read a color from css/theme.css, e.g. themeColor("--accent"). */
export function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Where a mouse click landed, in the art's own pixels (not screen pixels).
 * Returns { x, y }, which may be outside the image if the click was on its edge.
 */
export function artPoint(event, canvas, zoom) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.floor(((event.clientX - rect.left) * scaleX) / zoom),
    y: Math.floor(((event.clientY - rect.top) * scaleY) / zoom),
  };
}

/** Outline a rectangle given in art pixels, so the line sits just inside it. */
export function outline(ctx, zoom, x, y, w, h) {
  const inset = ctx.lineWidth / 2;
  ctx.strokeRect(x * zoom + inset, y * zoom + inset, w * zoom - ctx.lineWidth, h * zoom - ctx.lineWidth);
}

/** Write a small label with a background in the top-left corner of a cell. */
export function label(ctx, text, x, y, color, textColor) {
  ctx.font = "bold 11px system-ui, sans-serif";
  const width = ctx.measureText(text).width + 6;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 14);
  ctx.fillStyle = textColor;
  ctx.textBaseline = "top";
  ctx.fillText(text, x + 3, y + 2);
}
