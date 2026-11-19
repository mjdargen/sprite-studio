# Maintaining Sprite Studio

How the code is organized, how data moves through it, and where to go to
change things. Every file also starts with a comment saying what it does.

## The big picture

Sprite Studio is a static site: HTML, CSS and JavaScript modules, with no
libraries, no build step and no server code. Everything happens in the
browser.

It works in a loop:

```
 student changes something
          │
          ▼
 the state changes ............ js/state.js (one object holds everything)
          │
          ▼
 requestRender()
          │
          ▼
 render() in js/main.js
   1. each file's animations are worked out ... js/core/layouts.js
   2. the sheet is built ....................... js/core/sprite-sheet.js or tile-sheet.js
   3. every panel is redrawn from the state .... js/ui/*.js
```

Everything is rebuilt from the state on every change, so nothing on the page
can be out of date. The slow steps (removing a background, cutting up a
sheet) are cached in `js/core/prepare.js`, so this stays fast.

## Files

```
index.html            the page's markup only
css/theme.css         every color and font, light and dark
css/layout.css        layout and the look of controls
favicon.svg           the browser tab icon
serve.py              local web server for working on the site
tests/                tests for js/core and js/formats (open tests/index.html)
examples/             slime.png and terrain.png, shown before files are added

js/main.js            starts the app and runs the render loop
js/state.js           the state object, default settings, requestRender()
js/example.js         loads the examples, and how to cut and name them

js/formats/           reading files (each returns frames or an image)
  index.js            loadFiles(): picks a reader per file, pairs .json with
                      its image, groups numbered images
  image.js            PNG, JPG, WebP, BMP (the browser decodes them)
  gif.js              a full GIF decoder (frames, timing, transparency)
  aseprite.js         a .aseprite decoder (layers, tags, palettes)
  piskel.js           .piskel files
  atlas.js            sheets that come with a .json file

js/core/              the work, with no page code in it
  sources.js          a loaded file ("source") and what it holds
  grid.js             cutting a sheet into a grid, and guessing the grid
  uneven.js           cutting a sheet whose gaps aren't even ("Gaps aren't even")
  prepare.js          background removal and cutting, with caching
  layouts.js          ready-made ways to make animations (each row, ...)
  frame-list.js       reading and writing "0-3, 5" frame lists
  clean-up.js         edge cropping, trimming, padding, resizing, colors
  naming.js           the sheet's name and the animation names
  sprite-sheet.js     builds the sprite sheet
  tile-sheet.js       builds the tile sheet
  output.js           the Python code, the .md notes and the .tsx file

js/ui/                the page: one file per panel
  controls.js         links data-setting controls to the state
  files-panel.js      step 1: adding files, the file list (and its order in tiles mode)
  grid-panel.js       step 2: frame size and gaps
  anim-panel.js       step 2: each file's animations
  source-view.js      "Your file" preview, clicking frames, picking colors
  sheet-view.js       the finished sheet preview
  order-list.js       "Rows in your sheet" (reordering)
  player.js           the animation player
  tile-check.js       the tile check (one tile repeated)
  save-panel.js       step 4: name, downloads, the code box
  messages.js         errors and warnings

js/util/              small helpers used everywhere
  canvas.js           making, copying and reading canvases
  dom.js              h() to build elements, rebuild() to replace them
  names.js            cleaning names, file name parts
  files.js            downloads and copying text
  view.js             zooming art to fit a preview, drawing outlines
```

Imports only go one way: `main.js` uses `ui/`, which uses `core/`,
`formats/` and `util/`. Nothing in `core/` or `formats/` touches the page or
the state, which is why they can be tested on their own. The UI asks for a
redraw with `requestRender()` from `state.js` rather than importing
`main.js`.

## The main pieces of data

**A source** (`js/core/sources.js`) is one added file:

```js
{
  id, name, note,
  kind: "sheet" | "frames",
  image, grid: { width, height, margin, spacing },   // "sheet": cut up by a grid
  frames, tags,                                      // "frames": already separate
  fps, layout, skipEmpty,
  anims: [{ id, name, cells, fps, loop }],
  cache,                                             // used by prepare.js
}
```

An animation's `cells` are frame numbers: grid cells of a sheet (counted
across, then down, from 0) or positions in `frames`.

**The prepared source** (`js/core/prepare.js`) hides the difference between
the two kinds: `frame(i)` gives frame `i` with its background removed, and
`isEmpty(i)` says whether anything in it can be seen.

**The result** (`state.result`) is what the last render built: the sheet
canvas plus everything needed to draw the previews and write the code. Its
shape is described at the top of `sprite-sheet.js` and `tile-sheet.js`.

## How do I…

**Change a default setting?** Edit `DEFAULT_SETTINGS` in `js/state.js`.

**Change the code students copy?** Edit `js/core/output.js`. The `.md` notes
file is in the same place, and matches the `.md` files in the course's
`sprites` folder.

**Change wording on the page?** Fixed text is in `index.html`. Text that
depends on the file is in the `js/ui/` file for that panel; search for a few
words of it.

**Change colors or fonts?** Edit `css/theme.css`. The canvases read
`--accent` and `--mark` from there too.

**Add a setting?**
1. Add its default to `DEFAULT_SETTINGS` (or `DEFAULT_VIEW` for preview-only
   settings) in `js/state.js`.
2. Add a control in `index.html` with `data-setting="settings.yourName"`.
   It's linked up automatically (see `js/ui/controls.js`).
3. Read `state.settings.yourName` where it matters, usually in
   `js/core/sprite-sheet.js` or `tile-sheet.js`.

**Add a clean-up step?** Write it in `js/core/clean-up.js` (a function that
takes a list of canvases and returns new ones), then call it from
`buildSpriteSheet()` and/or `buildTileSheet()` in the right order.

**Read a new kind of file?**
1. Add a reader in `js/formats/` that returns a canvas (an image to cut up)
   or a list of canvases (frames).
2. In `loadFiles()` in `js/formats/index.js`, add a branch for its extension
   that pushes a spec (described at the top of that file).
3. Add the extension to the file input's `accept` list in `index.html`, and
   to the list in `README.md`.

**Add a way of making animations from a sheet?** Add it to `SHEET_LAYOUTS`
in `js/core/layouts.js` and give it a `case` in `generate()`.

**Change the examples?** Replace `examples/slime.png` or
`examples/terrain.png`, then update its grid and animation names and speeds
in `EXAMPLES` in `js/example.js`. The examples start with the default
settings, so the slime's background shows until the student removes it.

## Testing

Run `python serve.py` and open http://localhost:8000/tests/ to run the
automated tests. Add a test near the code you changed (see the top of
`tests/tests.js`).

Then try the page by hand. A good set of files, all from the course
repository:

- `sprites/fox.aseprite`: 7 tagged animations
- `sprites/fox.png`: a 14 × 7 sheet of 24 × 16 frames with unfinished rows
- `images/alien_beige_*.png`: numbered single images of different sizes
- `utils/input_piskels/*.piskel`
- any `.gif`
- `maps/platformer_new_kenney.png` in tile mode: 64 × 64 tiles with 1-pixel gaps

Check that typing in step 2 doesn't lose your place, that clicking frames in
"Your file" adds and removes them, that both downloads work, and that the
page fits a phone screen without scrolling sideways.

The GIF and Aseprite decoders were checked pixel by pixel against the
browser's own GIF decoder and Aseprite's own exports. If you change them,
compare again.

## Publishing

The site is published by GitHub Pages from the root of the main branch
(Settings > Pages > Deploy from a branch > main, / (root)). Pushing to main
updates it within a minute or two. `.nojekyll` tells GitHub to publish the
files as they are.

## Known limits

- Aseprite blend modes other than normal are drawn as normal, and tilemap
  layers are skipped.
- Sheets with a `.json` file can't have rotated frames.
- Guessing the frame size works for most sheets, but art that fills only part
  of each frame can fool it (for example, it guesses 32 × 16 for a 32 × 32
  sheet whose art is all in the bottom half). Students can always type the
  right size.
- In tile mode, several images of the same size up to 128 × 128 are treated
  as separate tiles, and bigger ones as tile sets to stack
  (`LARGEST_SINGLE_TILE` in `js/formats/index.js`). Two tiny tile sets of the
  same size would be read as single tiles.
- "Gaps aren't even" needs see-through gaps, and works best when each tile
  is filled edge to edge. Art that doesn't fill its tiles (an item on a
  see-through background) is centered in the nearest whole number of tiles,
  which is a guess.
- Very large tile sets (thousands of tiles) are slower, since every tile is
  handled separately.
