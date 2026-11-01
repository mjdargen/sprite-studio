/*
  Helpers for getting things out of the browser: downloading files and
  copying text.

  Downloads are made in the browser (a Blob plus a temporary link), so nothing
  is ever sent to a server.
*/

/** Save `blob` to the student's computer as `filename`. */
export function download(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the data
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

/** Save a canvas as a PNG file. */
export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => download(blob, filename), "image/png");
}

/** Save some text as a file. */
export function downloadText(text, filename, type = "text/plain") {
  download(new Blob([text], { type }), filename);
}

/**
 * Copy text to the clipboard. Returns true if it worked.
 * If the browser doesn't allow it, the text in `fallbackElement` is selected
 * instead, so the student can press Ctrl+C / Cmd+C.
 */
export async function copyText(text, fallbackElement) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallbackElement) {
      const range = document.createRange();
      range.selectNodeContents(fallbackElement);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return false;
  }
}
