/*
  Step 2, first half: how to cut the selected file into frames or tiles.

  For a sheet: the frame size (or how many frames across and down, which
  works the size out), the gap around the edge and between frames, and a
  "Guess again" button. A line underneath says how the grid fits, and warns
  when pixels are left over, which usually means the size is a bit wrong.

  For art that's already in frames, there's nothing to cut, so it just says so.

  "Gaps aren't even" (grid.uneven) is for sheets where no one gap size fits:
  the tiles are found by the see-through space around them instead (see
  js/core/uneven.js), so only the tile size is needed.

  In tiles mode every sheet shares one grid (see shareGrid in sources.js), so
  a change here changes every file.
*/

import { state, selectedSource, requestRender } from "../state.js";
import { $, h, rebuild } from "../util/dom.js";
import { gridSize, leftover, sizeFromCount, guessGrid } from "../core/grid.js";
import { defaultLayout, shareGrid } from "../core/sources.js";
import { prepare } from "../core/prepare.js";
import { guessTileSize } from "../core/uneven.js";

export function drawGridPanel() {
  const panel = $("grid-panel");
  const source = selectedSource();
  const thing = state.mode === "tiles" ? "tile" : "frame";

  if (!source) {
    rebuild(panel, h("p", { class: "hint" }, "Add a file in step 1, then choose how to cut it up here."));
    return;
  }
  if (source.kind === "frames") {
    const { width, height } = source.frames[0];
    const text = state.mode === "tiles"
      ? `${source.name} is ${source.frames.length} separate images of ${width}×${height}, one tile each.`
      : `${source.name} already has ${source.frames.length} separate frames of ${width}×${height}, so there's nothing to cut.`;
    rebuild(panel, h("p", { class: "hint" }, text));
    return;
  }

  const grid = source.grid;
  const image = source.image;
  const { cols, rows } = gridSize(image, grid);

  // A number box that updates the grid. `apply` turns the number into grid changes.
  const numberBox = (id, text, value, min, apply) =>
    h("div", { class: "field" },
      h("label", { for: id }, text),
      h("input", {
        type: "number", id, min, value,
        oninput: (event) => {
          const number = parseInt(event.target.value, 10);
          if (!Number.isFinite(number) || number < min) return; // still typing
          Object.assign(grid, apply(number));
          if (state.mode === "tiles") shareGrid(state.sources, grid);
          requestRender();
        },
      }));

  const across = numberBox("grid-across", `${cap(thing)}s across`, cols, 1,
    (n) => ({ width: sizeFromCount(image.width, n, grid.margin, grid.spacing) }));
  const down = numberBox("grid-down", `${cap(thing)}s down`, rows, 1,
    (n) => ({ height: sizeFromCount(image.height, n, grid.margin, grid.spacing) }));
  const width = numberBox("grid-width", `${cap(thing)} width`, grid.width, 1, (n) => ({ width: n }));
  const height = numberBox("grid-height", `${cap(thing)} height`, grid.height, 1, (n) => ({ height: n }));
  const margin = numberBox("grid-margin", "Gap around the edge", grid.margin, 0, (n) => ({ margin: n }));
  const spacing = numberBox("grid-spacing", `Gap between ${thing}s`, grid.spacing, 0, (n) => ({ spacing: n }));

  // For uneven gaps: guess the tile size from the sizes of the blocks of art
  const blockSize = () => guessTileSize(prepare(source, state.settings.background).picture) || {};
  const uneven = h("label", { class: "choice" },
    h("input", {
      type: "checkbox", checked: Boolean(grid.uneven),
      onchange: (event) => {
        grid.uneven = event.target.checked;
        if (grid.uneven) Object.assign(grid, blockSize());
        if (state.mode === "tiles") shareGrid(state.sources, grid);
        requestRender({ now: true });
      },
    }),
    `Gaps aren't even (find each ${thing} by the see-through space around it)`);

  const guess = h("button", {
    type: "button", class: "small",
    onclick: () => {
      if (grid.uneven) Object.assign(grid, blockSize());
      else source.grid = guessGrid(image, state.mode);
      source.layout = defaultLayout(source);
      if (state.mode === "tiles") shareGrid(state.sources, source.grid);
      requestRender({ now: true });
    },
  }, "Guess again");

  const sheets = state.sources.filter((s) => s.kind === "sheet").length;
  const shared = state.mode === "tiles" && sheets > 1
    ? h("p", { class: "hint" }, `These numbers are used for all ${sheets} files. Each file starts a new row in the tile sheet, in the order they're listed in step 1 (use the arrows there to change it).`)
    : null;

  if (grid.uneven) {
    const prepared = prepare(source, state.settings.background);
    rebuild(panel,
      shared,
      uneven,
      h("div", { class: "row" }, width, height),
      h("div", { class: "toolbar spread" },
        h("span", { class: "stats" }, `found ${prepared.found} ${thing}${prepared.found === 1 ? "" : "s"}, ${prepared.cols} across × ${prepared.rows} down`),
        guess),
      h("p", { class: "hint" },
        `Each block of art is cut into ${thing}s of this size, and the gaps are left out. ` +
        "If the gaps are a solid color, make that color see-through in step 3 first."),
      prepared.found ? null : h("p", { class: "message error" }, "No art was found. The gaps need to be see-through (step 3 can do that)."));
    return;
  }

  rebuild(panel,
    shared,
    uneven,
    h("div", { class: "row" }, width, height),
    h("div", { class: "row" }, across, down),
    h("div", { class: "row" }, margin, spacing),
    h("div", { class: "toolbar spread" }, h("span", { class: "stats" }, fitSummary(source, cols, rows, thing)), guess),
    fitWarning(source, cols, rows, thing));
}

/** "6 across × 2 down = 12 frames" */
function fitSummary(source, cols, rows, thing) {
  return `${cols} across × ${rows} down = ${cols * rows} ${thing}${cols * rows === 1 ? "" : "s"}`;
}

/** A warning if the grid doesn't fit the image well, or null. */
function fitWarning(source, cols, rows, thing) {
  if (!cols || !rows) {
    return h("p", { class: "message error" },
      `A ${source.grid.width}×${source.grid.height} ${thing} doesn't fit in this ${source.image.width}×${source.image.height} image. Make it smaller.`);
  }
  const extra = leftover(source.image, source.grid);
  const parts = [];
  if (extra.right) parts.push(`${extra.right} pixels on the right`);
  if (extra.bottom) parts.push(`${extra.bottom} pixels at the bottom`);
  if (!parts.length) return null;
  return h("p", { class: "message warning" },
    `${cap(parts.join(" and "))} aren't in any ${thing}. If that's not a border, check the ${thing} size or the gaps.`);
}

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
