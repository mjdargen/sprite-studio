/*
  "Rows in your sheet" (sprites mode): the animations in the order they go
  down the sheet, with buttons to move them. The row number is what goes in
  the code (row=0, row=1...). Clicking a name selects that animation for
  editing in step 2.
*/

import { state, requestRender } from "../state.js";
import { $, h, rebuild } from "../util/dom.js";

export function drawOrderList() {
  const list = $("order-list");
  const result = state.result;
  if (state.mode !== "sprites" || !result) {
    rebuild(list);
    return;
  }

  const move = (from, to) => {
    // Move in state.order, which also holds animations with no frames (not in result.rows)
    const ids = result.rows.map((r) => r.animId);
    const a = state.order.indexOf(ids[from]);
    const b = state.order.indexOf(ids[to]);
    [state.order[a], state.order[b]] = [state.order[b], state.order[a]];
    requestRender({ now: true });
  };

  const items = result.rows.map((row, i) => {
    const select = () => {
      state.selectedSourceId = row.sourceId;
      state.selectedAnimId = row.animId;
      state.player.animId = row.animId;
      requestRender({ now: true });
    };
    return h("div", { class: "item" + (row.animId === state.selectedAnimId ? " selected" : "") },
      h("div", {},
        h("div", {
          class: "name pickable", role: "button", tabindex: "0", title: "Edit this animation",
          onclick: select,
          onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } },
        }, row.name),
        h("div", { class: "meta" },
          `row ${i} · ${row.frames.length} frame${row.frames.length === 1 ? "" : "s"} · ${row.fps} fps${row.loop ? "" : " · plays once"}`)),
      h("div", { class: "buttons" },
        h("button", { type: "button", class: "small", "aria-label": `Move ${row.name} up`, disabled: i === 0, onclick: () => move(i, i - 1) }, "↑"),
        h("button", { type: "button", class: "small", "aria-label": `Move ${row.name} down`, disabled: i === result.rows.length - 1, onclick: () => move(i, i + 1) }, "↓")));
  });
  rebuild(list, items);
}
