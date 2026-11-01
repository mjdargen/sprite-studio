/*
  Reading and writing lists of frame numbers as text, like "0-3, 5, 7-5".

  Step 2 shows each animation's frames this way so the student can type them:
    "0-3"   frames 0, 1, 2, 3
    "7-5"   frames 7, 6, 5 (backwards)
    "0-2, 1" frames 0, 1, 2, 1 (a frame can be used again)
*/

/**
 * Turn text into a list of frame numbers.
 * Returns { cells } or { error } with a message for the student.
 * `count` is how many frames there are, so numbers must be below it.
 */
export function parseFrameList(text, count) {
  const cells = [];
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) return { error: `"${part}" isn't a frame number or a range like 0-3.` };
    const from = parseInt(match[1], 10);
    const to = match[2] === undefined ? from : parseInt(match[2], 10);
    const biggest = Math.max(from, to);
    if (biggest >= count) {
      return { error: `There's no frame ${biggest}. The frames go from 0 to ${count - 1}.` };
    }
    const step = to >= from ? 1 : -1;
    for (let i = from; i !== to + step; i += step) cells.push(i);
  }
  return { cells };
}

/** Turn a list of frame numbers into short text: [0, 1, 2, 3, 5] -> "0-3, 5". */
export function formatFrameList(cells) {
  const parts = [];
  let i = 0;
  while (i < cells.length) {
    // Extend a run while the numbers go up (or down) by one
    let j = i;
    const step = cells[i + 1] - cells[i];
    if (step === 1 || step === -1) {
      while (j + 1 < cells.length && cells[j + 1] - cells[j] === step) j++;
    }
    if (j - i >= 2) {
      parts.push(`${cells[i]}-${cells[j]}`);
      i = j + 1;
    } else {
      parts.push(String(cells[i]));
      i++;
    }
  }
  return parts.join(", ");
}
