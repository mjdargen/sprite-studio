/*
  Messages for the student: files that couldn't be loaded (under step 1) and
  problems or warnings about the finished sheet (under the sheet preview).
*/

import { state } from "../state.js";
import { $, h, rebuild } from "../util/dom.js";

export function drawMessages() {
  const loadErrors = state.messages.loadErrors;
  rebuild($("file-messages"), loadErrors.length
    ? h("p", { class: "message error" }, "Couldn't use:\n" + loadErrors.join("\n"))
    : null);

  const warnings = state.result ? state.result.warnings : [];
  rebuild($("result-messages"),
    state.messages.buildError ? h("p", { class: "message error" }, state.messages.buildError) : null,
    warnings.map((text) => h("p", { class: "message warning" }, text)));
}
