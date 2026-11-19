/*
  The app's state: one object that holds everything the student has done.

  Nothing else in the app keeps its own copy of these values. The UI changes
  this object and then calls requestRender(); js/main.js then rebuilds the
  result from it and redraws the page. So to find out where a value comes from
  or what changes it, search for its name (e.g. "settings.padding").

  The default settings are in DEFAULT_SETTINGS below. Change them there.
*/

/** What a fresh page starts with. The controls in index.html show these. */
export const DEFAULT_SETTINGS = {
  // Step 1: when several numbered images are added (walk1.png, walk2.png),
  // make them the frames of one animation instead of one animation each.
  groupNumbered: true,

  // Step 3: make a background color see-through.
  //   mode: "off" | "auto" (the color of each file's top-left pixel) | "pick"
  //   color: the color for "pick", as "#rrggbb"
  //   tolerance: 0-100; how different a color can be and still be removed
  background: { mode: "off", color: "#ff00ff", tolerance: 10 },

  // Step 3: pixels to cut off every frame or tile, before anything else.
  crop: { left: 0, right: 0, top: 0, bottom: 0 },

  // Step 3 (sprites): trim see-through space from around the art.
  //   "file": one box for everything from the same file (keeps the character still)
  //   "each": a box per animation
  //   "off":  no trimming
  trim: "file",

  // Step 3 (sprites): see-through pixels to add around each frame after trimming.
  padding: 0,

  // Step 3 (sprites): where to put frames that are smaller than the sheet's
  // frame size: "bottom" (centered, feet on the ground) or "center".
  align: "bottom",

  // Step 3: make everything bigger or smaller. smooth=false keeps pixel art
  // sharp (nearest-neighbor); smooth=true blends pixels (for drawn/photo art).
  scale: 1,
  smooth: false,

  // Step 3: change the colors of the whole sheet, after everything else.
  //   invert: swap every color for its opposite (black <-> white)
  //   gray: turn every color into a shade of gray (black and white)
  //   tint, tintAmount: blend every color toward `tint` ("#rrggbb"), 0-100%
  //   opacity: 0-100%; below 100 makes everything partly see-through
  filters: { invert: false, gray: false, tint: "#ff0000", tintAmount: 0, opacity: 100 },

  // Step 3 (tiles)
  tiles: {
    skipEmpty: false, // leave out tiles with no visible pixels
    columns: 0,       // tiles across the new sheet; 0 = work it out
  },

  // Step 4: the file name. "" means use the suggested name.
  name: "",
};

/** Settings for the previews only; they never change the downloaded files. */
export const DEFAULT_VIEW = {
  showLines: true,          // grid lines over the new sheet
  tileNumbers: false,       // tile numbers over the new tile sheet
  playerZoom: "fit",        // "fit" or a number of times bigger
  playerBackground: "checker", // "checker" or a CSS color
  showCenter: false,        // outline the frame and mark the Actor's center
  selectedTile: 0,          // the tile shown in the tile check
};

export const state = {
  /** "sprites" (a sprite sheet of animations) or "tiles" (a tile sheet for Tiled). */
  mode: "sprites",

  /**
   * The files the student added, in order. See js/core/sources.js for what a
   * source object holds.
   */
  sources: [],

  /** The id of the source shown in "Your file" and edited in step 2. */
  selectedSourceId: null,

  /** The id of the animation being edited (frames picked in "Your file"). */
  selectedAnimId: null,

  /** Sprite mode: animation ids in the order of the sheet's rows. */
  order: [],

  /** True while the built-in example is showing instead of the student's files. */
  isExample: false,

  /** True while "Pick from your file" is waiting for a click on the art. */
  picking: false,

  settings: structuredClone(DEFAULT_SETTINGS),
  view: structuredClone(DEFAULT_VIEW),

  /** The animation player's position. */
  player: { playing: true, frame: 0, animId: null },

  /**
   * What the last render built (js/core/sprite-sheet.js or tile-sheet.js),
   * or null if there's nothing to build or it failed.
   */
  result: null,

  /** Messages to show: { error } from building, and problems loading files. */
  messages: { buildError: null, loadErrors: [] },
};

/* ---------- Small helpers for reading the state ---------- */

/** The source shown in "Your file", or undefined. */
export function selectedSource() {
  return state.sources.find((s) => s.id === state.selectedSourceId);
}

/** Find the source and animation with this animation id. */
export function findAnimation(animId) {
  for (const source of state.sources) {
    const anim = source.anims.find((a) => a.id === animId);
    if (anim) return { source, anim };
  }
  return null;
}

/* ---------- Asking for a redraw ---------- */

// main.js registers the function that rebuilds and redraws the page. The UI
// files call requestRender() instead of importing main.js, which keeps the
// imports one-way (main.js -> ui/* -> state.js).
let renderHandler = () => {};

export function setRenderHandler(handler) {
  renderHandler = handler;
}

/**
 * Rebuild the result and redraw the page, soon.
 * Many changes in a row (like typing a number) only cause one redraw.
 * Pass { now: true } to redraw straight away.
 */
export function requestRender(options = {}) {
  renderHandler(options);
}
