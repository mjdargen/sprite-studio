/*
  Step 4 (name and downloads) and the code box under the finished sheet.
*/

import { state } from "../state.js";
import { $ } from "../util/dom.js";
import { downloadCanvas, downloadText, copyText } from "../util/files.js";
import { sheetName, suggestedName } from "../core/naming.js";
import { spriteCode, spriteMarkdown, tilesetTsx, tilesHowTo } from "../core/output.js";

export function setUpSavePanel() {
  $("download-png").addEventListener("click", () => {
    if (state.result) downloadCanvas(state.result.sheet, `${sheetName(state)}.png`);
  });
  $("download-md").addEventListener("click", () => {
    const name = sheetName(state);
    if (state.result) downloadText(spriteMarkdown(state.result, name), `${name}.md`, "text/markdown");
  });
  $("download-tsx").addEventListener("click", () => {
    const name = sheetName(state);
    if (state.result) downloadText(tilesetTsx(state.result, name), `${name}.tsx`, "application/xml");
  });

  const copy = $("copy-code");
  copy.addEventListener("click", async () => {
    const copied = await copyText($("code").textContent, $("code"));
    copy.textContent = copied ? "Copied" : "Selected: press Ctrl+C";
    setTimeout(() => { copy.textContent = "Copy"; }, 2000);
  });
}

export function drawSavePanel() {
  const result = state.result;
  const name = sheetName(state);
  const nameBox = $("sheet-name");
  nameBox.placeholder = suggestedName(state);

  // Explain when the name was changed to work in a game
  const typed = state.settings.name.trim();
  $("name-hint").textContent = typed && typed !== name
    ? `It will be saved as ${name}, so Pygame Zero Plus can load it.`
    : `Saved as ${name}.png.`;

  for (const id of ["download-png", "download-md", "download-tsx"]) $(id).disabled = !result;

  if (state.mode === "sprites") {
    $("code-title").textContent = "Code for your game";
    $("code").textContent = result ? spriteCode(result, name) : "# Your code will appear here";
  } else {
    $("code-title").textContent = "Using it in Tiled";
    $("code").textContent = result ? tilesHowTo(result, name) : "# Instructions will appear here";
  }
}
