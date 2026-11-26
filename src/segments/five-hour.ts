import { DETAIL_LABELS, WINDOW_LABELS } from "../constants.ts";
import type { Segment } from "./types.ts";
import { detailWindow, renderWindow } from "./window.ts";

export const fiveHourSegment: Segment = {
  id: "fiveHour",
  render: (ctx) => renderWindow(WINDOW_LABELS.fiveHour, ctx.input.fiveHour, ctx),
  detail: (ctx) => detailWindow(DETAIL_LABELS.fiveHour, ctx.input.fiveHour, ctx),
};
