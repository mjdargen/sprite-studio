# Sprite Studio

**Use it here: https://mjdargen.github.io/sprite-studio/**

Sprite Studio turns game art from anywhere into sprite sheets and tile sheets
that work in [Pygame Zero Plus](https://github.com/mjdargen/pgzero). It runs
in your browser, and your files never leave your computer.

It has two modes:

- **Sprite sheet**: animations for an Actor. Add a sheet, a GIF, an Aseprite
  file or a folder of frames; get back one PNG with an animation on each row,
  plus the `Sprite(...)` code to paste into your game.
- **Tile sheet**: tiles for a [Tiled](https://www.mapeditor.org) map. Add a
  tile set (with or without gaps between tiles) or a folder of separate
  tiles; get back a tightly packed PNG and a `.tsx` tileset file. Add several
  tile sets cut the same way (ground, buildings, items...) and they're
  stacked into one sheet, each starting on a new row.

## What it can read

| Art | What happens |
|---|---|
| Sprite sheets and strips (PNG, JPG, WebP, BMP) | Cut into frames. The frame size is guessed, and you can change it, the gaps around the edge and between frames, and which frames make up each animation. |
| Single images | Each is a frame. Numbered images such as `walk1.png`, `walk2.png` become one animation. |
| Animated GIFs | Every frame, at the GIF's speed. |
| Aseprite files (`.aseprite`, `.ase`) | Every frame, with each tag as a named animation at its own speed. |
| Piskel files (`.piskel`) | Every frame, at the file's speed. |
| Sheets with a `.json` file | Sheets exported by Aseprite, TexturePacker and similar tools. Add the image and the `.json` file together. Tags become animations. |

## What it can fix

- **Backgrounds**: make a solid background color see-through, either the
  color in the top-left corner or one you click on.
- **Spacing**: remove gaps around and between frames or tiles, and cut extra
  pixels off the edges of every frame. For sheets whose gaps aren't the same
  everywhere (often there's no gap inside a bigger thing made of several
  tiles), "Gaps aren't even" finds each tile by the see-through space around
  it instead.
- **Empty space**: trim see-through space from around a character, keeping
  every animation lined up so the character doesn't jump when it changes
  animation.
- **Size**: make art 2×, 3× or 4× bigger, or shrink art that was exported
  enlarged, keeping pixel art sharp.
- **Colors**: invert the whole sheet's colors, turn it black and white, tint
  it a color, or make it partly see-through.
- **Order and names**: put the animations in any order, rename them, set each
  one's speed, and mark ones that play once.

The previews show exactly what you'll get: the animation plays from the
finished sheet at its real speed, and the tile check repeats a tile so you
can see whether its edges join up.

## Using what you make

**A sprite sheet**: put the PNG in your game's `sprites` folder and paste the
code from the page, which looks like this:

```python
hero_idle = Sprite("hero", frame_width=24, frame_height=16, row=0, frames=5, fps=8)
hero_run = Sprite("hero", frame_width=24, frame_height=16, row=1, frames=8, fps=12)

hero = Actor(hero_idle)
```

The "Download notes" button saves a `.md` file describing the sheet, to keep
next to it.

**A tile sheet**: put the PNG and the `.tsx` file in your game's `maps`
folder. In Tiled, choose **Map > Add External Tileset** and pick the `.tsx`
file.

## Running it yourself

Sprite Studio is plain HTML, CSS and JavaScript with nothing to install or
build. Browsers only load its JavaScript from a web server, so to run a copy
on your computer:

```bash
python serve.py
```

then open http://localhost:8000. Any web server works, and so does GitHub
Pages: publish the repository's main branch from its root folder.

Tests for the core logic are at http://localhost:8000/tests/.

See [MAINTAINING.md](MAINTAINING.md) for how the code is organized.
