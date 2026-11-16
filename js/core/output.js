/*
  The text files and code we give the student:

    spriteCode()      Python for their game (shown on the page)
    spriteMarkdown()  the notes file, in the same layout as the .md files in
                      the course's sprites folder
    tilesetTsx()      a Tiled tileset file to go with the tile sheet
    tilesHowTo()      what to do with the tile sheet (shown on the page)

  Change these to change what students copy into their games.
*/

/** One Sprite(...) line for each row of the sheet. */
function spriteLines(result, sheet) {
  return result.rows.map((row, i) => {
    const loop = row.loop ? "" : ", loop=False";
    return `${sheet}_${row.name} = Sprite("${sheet}", frame_width=${result.cellWidth}, ` +
      `frame_height=${result.cellHeight}, row=${i}, frames=${row.frames.length}, fps=${row.fps}${loop})`;
  });
}

/** Python code that makes a Sprite for each animation and an Actor that plays the first. */
export function spriteCode(result, sheet) {
  return [
    `# Put ${sheet}.png in your game's sprites folder`,
    ...spriteLines(result, sheet),
    "",
    `${sheet} = Actor(${sheet}_${result.rows[0].name})`,
    "",
    "# To change animation, e.g. when a key is pressed:",
    `# ${sheet}.sprite = ${sheet}_${result.rows[result.rows.length > 1 ? 1 : 0].name}`,
  ].join("\n");
}

/** The notes file to keep next to the PNG. */
export function spriteMarkdown(result, sheet) {
  const speeds = new Set(result.rows.map((r) => r.fps));
  const speedNote = speeds.size === 1
    ? `# Note: fps is set to ${[...speeds][0]} below; adjust as needed`
    : "# Note: adjust each animation's fps as needed";
  return [
    `# ${sheet}.png`,
    "",
    `**Image Size:** ${result.sheet.width}x${result.sheet.height}`,
    "",
    `**Frame Size:** ${result.cellWidth}x${result.cellHeight}`,
    "",
    `**Number of Animations:** ${result.rows.length}`,
    "",
    "**Animations:**",
    ...result.rows.map((r, i) => `- ${r.name} - row ${i} - ${r.frames.length} frames`),
    "",
    "**Code Example:**",
    "```python",
    speedNote,
    ...spriteLines(result, sheet),
    "",
    "# Define the Actor",
    `${sheet} = Actor(${sheet}_${result.rows[0].name})`,
    "```",
    "",
  ].join("\n");
}

/**
 * A Tiled tileset (.tsx) for the tile sheet. Tiled can make one itself, but
 * this saves the student typing the tile size.
 */
export function tilesetTsx(result, name) {
  const { sheet, tileWidth, tileHeight, columns, count } = result;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<tileset version="1.10" tiledversion="1.11.0" name="${name}" tilewidth="${tileWidth}" ` +
      `tileheight="${tileHeight}" tilecount="${count}" columns="${columns}">`,
    ` <image source="${name}.png" width="${sheet.width}" height="${sheet.height}"/>`,
    "</tileset>",
    "",
  ].join("\n");
}

/** What to do with the tile sheet, shown where the code goes in sprites mode. */
export function tilesHowTo(result, name) {
  return [
    `# 1. Put ${name}.png and ${name}.tsx in your game's maps folder.`,
    `# 2. In Tiled, open your map and choose Map > Add External Tileset,`,
    `#    then pick ${name}.tsx.`,
    `#    (Or make a new tileset from ${name}.png with tiles ${result.tileWidth}×${result.tileHeight},`,
    `#    no margin and no spacing.)`,
    `# 3. Save the map in the maps folder too, then in your game:`,
    "",
    `level = load_tile_map("your_map_name")`,
  ].join("\n");
}
