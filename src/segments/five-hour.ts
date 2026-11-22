import { WINDOW_LABELS } from "../constants.ts";
import type { Segment } from "./types.ts";
import { renderWindow } from "./window.ts";

export const fiveHourSegment: Segment = {
  id: "fiveHour",
  render: (ctx) => renderWindow(WINDOW_LABELS.fiveHour, ctx.input.fiveHour, ctx),
};
