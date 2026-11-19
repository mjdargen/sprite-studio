/*
  Tests for the parts of Sprite Studio that don't need the page: names,
  frame lists, grid maths and guessing, layouts, clean-up, building sheets,
  and the GIF decoder.

  Each test is test("what it checks", () => { ...checks... }). Add one by
  copying a test near the code you changed. The checks:
    same(actual, expected)  fails unless they're equal (lists and objects too)
    ok(value)               fails unless value is true
*/

import { cleanName, splitTrailingNumber, commonPrefix } from "../js/util/names.js";
import { newCanvas, context, visibleBox } from "../js/util/canvas.js";
import { parseFrameList, formatFrameList } from "../js/core/frame-list.js";
import { gridSize, cellRect, leftover, sizeFromCount, guessGrid } from "../js/core/grid.js";
import { createSource } from "../js/core/sources.js";
import { prepare, removeBackground } from "../js/core/prepare.js";
import { applyLayout } from "../js/core/layouts.js";
import { filterColors } from "../js/core/clean-up.js";
import { unevenGrid } from "../js/core/uneven.js";
import { animationNames } from "../js/core/naming.js";
import { buildSpriteSheet } from "../js/core/sprite-sheet.js";
import { buildTileSheet } from "../js/core/tile-sheet.js";
import { spriteCode } from "../js/core/output.js";
import { tagCells, fpsFromDurations } from "../js/formats/index.js";
import { decodeGif } from "../js/formats/gif.js";
import { DEFAULT_SETTINGS } from "../js/state.js";

/* ---------- A tiny test runner ---------- */

const results = [];
function test(name, body) {
  try {
    body();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, message: error.message });
  }
}
function same(actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`expected ${e}\n     got ${a}`);
}
function ok(value, message = "expected true") {
  if (!value) throw new Error(message);
}

/* ---------- Helpers ---------- */

/** A canvas with filled rectangles: rects = [[x, y, w, h, color], ...]. */
function picture(width, height, rects = [], background = null) {
  const canvas = newCanvas(width, height);
  const ctx = context(canvas);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  for (const [x, y, w, h, color] of rects) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  return canvas;
}

/** A fresh state for building sheets. */
function testState(mode, sources) {
  return {
    mode,
    sources,
    order: [],
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

function layOut(state) {
  for (const s of state.sources) applyLayout(s, prepare(s, state.settings.background));
}

/* ---------- Names ---------- */

test("cleanName follows the lowercase_filenames.py rules", () => {
  same(cleanName("PlayerIdle"), "player_idle");
  same(cleanName("HUDIcon"), "hud_icon");
  same(cleanName("tiles (1)"), "tiles_1");
  same(cleanName("2player"), "sprite_2player");
  same(cleanName("!!!", "animation"), "animation");
});

test("splitTrailingNumber finds numbered images", () => {
  same(splitTrailingNumber("walk_02"), { base: "walk", number: 2 });
  same(splitTrailingNumber("alien_beige_climb1"), { base: "alien_beige_climb", number: 1 });
  same(splitTrailingNumber("walk"), { base: "walk", number: null });
  same(splitTrailingNumber("2"), { base: "2", number: null });
});

test("commonPrefix works on whole words", () => {
  same(commonPrefix(["alien_beige_walk", "alien_beige_jump"]), "alien_beige");
  same(commonPrefix(["hero_run", "heroine_run"]), "");
});

test("animationNames drops the sheet name and makes names unique", () => {
  same(animationNames(["hero_run", "Run", "idle", "3"], "hero"), ["run", "run_2", "idle", "animation_3"]);
});

/* ---------- Frame lists ---------- */

test("parseFrameList reads ranges, backwards ranges and repeats", () => {
  same(parseFrameList("0-3, 5", 10).cells, [0, 1, 2, 3, 5]);
  same(parseFrameList("3-1", 10).cells, [3, 2, 1]);
  same(parseFrameList("0 1 2 1", 10).cells, [0, 1, 2, 1]);
  same(parseFrameList("", 10).cells, []);
});

test("parseFrameList explains mistakes", () => {
  ok(parseFrameList("0-12", 10).error.includes("no frame 12"));
  ok(parseFrameList("a", 10).error.includes("isn't a frame number"));
});

test("formatFrameList writes short ranges", () => {
  same(formatFrameList([0, 1, 2, 3, 5]), "0-3, 5");
  same(formatFrameList([4, 3, 2, 1]), "4-1");
  same(formatFrameList([0, 1, 0]), "0, 1, 0");
});

/* ---------- Grids ---------- */

test("gridSize matches Tiled's margin and spacing rules", () => {
  const image = { width: 1169, height: 1169 };
  same(gridSize(image, { width: 64, height: 64, margin: 0, spacing: 1 }), { cols: 18, rows: 18 });
  same(gridSize({ width: 220, height: 76 }, { width: 32, height: 32, margin: 4, spacing: 4 }), { cols: 6, rows: 2 });
});

test("cellRect counts across, then down", () => {
  same(cellRect({ width: 32, height: 32, margin: 4, spacing: 4 }, 6, 7), { x: 40, y: 40, w: 32, h: 32 });
});

test("leftover finds pixels that aren't in any frame", () => {
  same(leftover({ width: 100, height: 64 }, { width: 32, height: 32, margin: 0, spacing: 0 }), { right: 4, bottom: 0 });
});

test("sizeFromCount works out a frame size", () => {
  same(sizeFromCount(220, 6, 4, 4), 32);
});

test("guessGrid finds a strip of square frames", () => {
  const strip = picture(128, 32, [[0, 0, 128, 32, "#c33"]]);
  same(guessGrid(strip, "sprites"), { width: 32, height: 32, margin: 0, spacing: 0 });
});

test("guessGrid finds frames with space around the art", () => {
  // 3 x 2 frames of 24 x 16, each with a 10 x 10 blob in the middle
  const rects = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) rects.push([c * 24 + 7, r * 16 + 3, 10, 10, "#3a3"]);
  same(guessGrid(picture(72, 32, rects), "sprites"), { width: 24, height: 16, margin: 0, spacing: 0 });
});

test("guessGrid keeps a single picture whole", () => {
  same(guessGrid(picture(66, 92, [[10, 10, 40, 70, "#999"]]), "sprites"), { width: 66, height: 92, margin: 0, spacing: 0 });
});

test("guessGrid finds tiles with a gap between them", () => {
  same(guessGrid(picture(16 * 4 + 3, 16 * 2 + 1, [[0, 0, 67, 33, "#555"]]), "tiles"), { width: 16, height: 16, margin: 0, spacing: 1 });
});

/* ---------- Background and layouts ---------- */

test("unevenGrid finds tiles when bigger things have no gaps inside them", () => {
  // A margin of 1 and gaps of 1, except inside a 16 x 8 block (two tiles with no gap)
  const rects = [[1, 1, 8, 8, "#f00"], [10, 1, 16, 8, "#0f0"], [27, 1, 8, 8, "#00f"], [1, 10, 8, 8, "#ff0"], [28, 10, 8, 8, "#0ff"]];
  const found = unevenGrid(picture(37, 19, rects), 8, 8);
  same([found.cols, found.rows, found.found, found.overlaps], [4, 2, 6, 0]);
  same(found.cells.map((c) => c && c.x), [1, 10, 18, 27, 1, null, null, 28]);
});

test("removeBackground makes the chosen color see-through", () => {
  const image = picture(4, 1, [[2, 0, 2, 1, "#00ff00"]], "#ff00ff");
  const cleaned = removeBackground(image, { mode: "auto", color: "#000000", tolerance: 0 }, image);
  same(visibleBox(cleaned), { left: 2, top: 0, right: 4, bottom: 1 });
});

test("the rows layout leaves out empty frames at the end of a row", () => {
  // 3 x 2 grid of 8 x 8; row 0 has 2 frames, row 1 has 3
  const rects = [[0, 0, 8, 8, "#f00"], [8, 0, 8, 8, "#f00"], [0, 8, 8, 8, "#00f"], [8, 8, 8, 8, "#00f"], [16, 8, 8, 8, "#00f"]];
  const source = createSource({ kind: "sheet", name: "hero", image: picture(24, 16, rects), grid: { width: 8, height: 8, margin: 0, spacing: 0 } }, "sprites");
  applyLayout(source, prepare(source, DEFAULT_SETTINGS.background));
  same(source.anims.map((a) => a.cells), [[0, 1], [3, 4, 5]]);
});

test("the down layout reads each column in turn", () => {
  const source = createSource({ kind: "sheet", name: "x", image: picture(16, 16, [[0, 0, 16, 16, "#f00"]]), grid: { width: 8, height: 8, margin: 0, spacing: 0 } }, "sprites");
  source.layout = "down";
  applyLayout(source, prepare(source, DEFAULT_SETTINGS.background));
  same(source.anims[0].cells, [0, 2, 1, 3]);
});

test("names typed by the student survive the grid changing", () => {
  const source = createSource({ kind: "sheet", name: "x", image: picture(32, 16, [[0, 0, 32, 16, "#f00"]]), grid: { width: 8, height: 8, margin: 0, spacing: 0 } }, "sprites");
  applyLayout(source, prepare(source, DEFAULT_SETTINGS.background));
  source.anims[0].name = "walk";
  source.grid.width = 16;
  applyLayout(source, prepare(source, DEFAULT_SETTINGS.background));
  same([source.anims[0].name, source.anims[0].cells], ["walk", [0, 1]]);
});

test("Aseprite tag directions become frame lists", () => {
  same(tagCells({ from: 2, to: 5, direction: 0 }), [2, 3, 4, 5]);
  same(tagCells({ from: 2, to: 5, direction: 1 }), [5, 4, 3, 2]);
  same(tagCells({ from: 0, to: 3, direction: 2 }), [0, 1, 2, 3, 2, 1]);
});

test("fpsFromDurations uses the middle frame time", () => {
  same(fpsFromDurations([100, 100, 100, 1000]), 10);
  same(fpsFromDurations([0, 0]), 10); // GIF delays of 0 play at 10 fps
  same(fpsFromDurations([]), 8);
});

/* ---------- Building sheets ---------- */

test("a sprite sheet trims every animation from a file by the same amount", () => {
  // Two rows of 16 x 16 frames: a small blob, then a wider one further right
  const rects = [[4, 8, 4, 8, "#f00"], [20, 8, 4, 8, "#f00"], [4, 24, 10, 8, "#00f"], [20, 24, 10, 8, "#00f"]];
  const source = createSource({ kind: "sheet", name: "hero", image: picture(32, 32, rects), grid: { width: 16, height: 16, margin: 0, spacing: 0 } }, "sprites");
  const state = testState("sprites", [source]);
  layOut(state);
  const result = buildSpriteSheet(state);
  same([result.cellWidth, result.cellHeight, result.sheet.width, result.sheet.height], [10, 8, 20, 16]);
  same(result.rows.map((r) => r.frames.length), [2, 2]);
});

test("a file keeps its place in the sheet when its layout changes", () => {
  const sheet = () => picture(16, 16, [[0, 0, 16, 16, "#f00"]]);
  const grid = () => ({ width: 8, height: 8, margin: 0, spacing: 0 });
  const a = createSource({ kind: "sheet", name: "a", image: sheet(), grid: grid() }, "sprites");
  const b = createSource({ kind: "sheet", name: "b", image: sheet(), grid: grid() }, "sprites");
  const state = testState("sprites", [a, b]);
  layOut(state);
  buildSpriteSheet(state);
  a.layout = "columns";
  layOut(state);
  const result = buildSpriteSheet(state);
  same(result.rows.map((r) => r.sourceId), [a.id, a.id, b.id, b.id]);
});

test("the code uses the sheet's name and each row", () => {
  const source = createSource({ kind: "sheet", name: "hero", image: picture(32, 16, [[0, 0, 32, 16, "#f00"]]), grid: { width: 16, height: 16, margin: 0, spacing: 0 } }, "sprites");
  const state = testState("sprites", [source]);
  layOut(state);
  source.anims[0].loop = false;
  const code = spriteCode(buildSpriteSheet(state), "hero");
  ok(code.includes('hero_hero = Sprite("hero", frame_width=16, frame_height=16, row=0, frames=2, fps=8, loop=False)'), code);
});

test("filterColors inverts, and makes grays, tints and see-through pixels", () => {
  const frame = picture(2, 1, [[0, 0, 1, 1, "#ff0000"]]); // one red pixel, one empty
  const pixels = (filters) => Array.from(context(filterColors([frame], { invert: false, gray: false, tint: "#0000ff", tintAmount: 0, opacity: 100, ...filters })[0]).getImageData(0, 0, 2, 1).data);
  same(pixels({ invert: true }), [0, 255, 255, 255, 0, 0, 0, 0]);
  same(pixels({ gray: true }), [76, 76, 76, 255, 0, 0, 0, 0]);
  same(pixels({ tintAmount: 50 }), [128, 0, 128, 255, 0, 0, 0, 0]);
  same(pixels({ opacity: 0 })[3], 0);
});

test("a tile sheet removes the gaps and keeps the tiles in order", () => {
  const rects = [[0, 0, 8, 8, "#f00"], [9, 0, 8, 8, "#0f0"], [0, 9, 8, 8, "#00f"]];
  const source = createSource({ kind: "sheet", name: "t", image: picture(17, 17, rects), grid: { width: 8, height: 8, margin: 0, spacing: 1 } }, "tiles");
  const state = testState("tiles", [source]);
  layOut(state);
  const result = buildTileSheet(state);
  same([result.sheet.width, result.sheet.height, result.columns, result.count], [16, 16, 2, 4]);
  const pixel = (x, y) => Array.from(context(result.sheet).getImageData(x, y, 1, 1).data);
  same([pixel(12, 4), pixel(4, 12)], [[0, 255, 0, 255], [0, 0, 255, 255]]);
});

test("a tile sheet stacks several tile sets, each starting a new row", () => {
  const grid = () => ({ width: 8, height: 8, margin: 0, spacing: 0 });
  const ground = createSource({ kind: "sheet", name: "ground", image: picture(24, 16, [[0, 0, 24, 16, "#0f0"]]), grid: grid() }, "tiles");
  const items = createSource({ kind: "sheet", name: "items", image: picture(16, 8, [[0, 0, 16, 8, "#f00"]]), grid: grid() }, "tiles");
  const state = testState("tiles", [ground, items]);
  layOut(state);
  const result = buildTileSheet(state);
  same([result.sheet.width, result.sheet.height, result.columns, result.count], [24, 24, 3, 8]);
  same(result.tiles.map((t) => t && t.sourceId), [ground.id, ground.id, ground.id, ground.id, ground.id, ground.id, items.id, items.id]);
});

test("a tile sheet can leave out empty tiles", () => {
  const source = createSource({ kind: "sheet", name: "t", image: picture(16, 16, [[0, 0, 8, 8, "#f00"]]), grid: { width: 8, height: 8, margin: 0, spacing: 0 } }, "tiles");
  const state = testState("tiles", [source]);
  state.settings.tiles.skipEmpty = true;
  layOut(state);
  same(buildTileSheet(state).count, 1);
});

/* ---------- GIF decoder ---------- */

test("decodeGif reads frames, colors and timing", () => {
  // 4 x 2 pixels, 2 frames. Frame 1: red, green, blue, white over black.
  // Frame 2: the rows swapped. Made with Pillow.
  const base64 = "R0lGODlhBAACAIIAAP///wD/AP8AAAAA/wAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAABAACAAAICwAFBBgAgIBBAgEBACH5BAEZAAUALAAAAAAEAAIAgv///wD/AP8AAAAA/wAAAAAAAAAAAAAAAAgLAAkIJCAgwAAAAQEAOw==";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const gif = decodeGif(bytes);
  same([gif.width, gif.height, gif.frames.length], [4, 2, 2]);
  same(gif.frames.map((f) => f.delay), [100, 250]);
  const rgb = (frame, x, y) => Array.from(gif.frames[frame].pixels.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 3));
  same([rgb(0, 0, 0), rgb(0, 1, 0), rgb(0, 2, 0), rgb(0, 3, 0), rgb(0, 0, 1)],
    [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255], [0, 0, 0]]);
  same([rgb(1, 0, 0), rgb(1, 0, 1)], [[0, 0, 0], [255, 0, 0]]);
});

/* ---------- Show the results ---------- */

const list = document.getElementById("results");
for (const r of results) {
  const item = document.createElement("li");
  item.className = r.passed ? "pass" : "fail";
  item.textContent = `${r.passed ? "✓" : "✗"} ${r.name}`;
  if (!r.passed) {
    const detail = document.createElement("pre");
    detail.textContent = r.message;
    item.append(detail);
  }
  list.append(item);
}
const failed = results.filter((r) => !r.passed).length;
const summary = document.getElementById("summary");
summary.textContent = failed ? `${failed} of ${results.length} tests failed` : `All ${results.length} tests passed`;
summary.className = failed ? "fail" : "pass";
