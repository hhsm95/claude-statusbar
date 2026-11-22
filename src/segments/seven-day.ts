import { WINDOW_LABELS } from "../constants.ts";
import type { Segment } from "./types.ts";
import { renderWindow } from "./window.ts";

export const sevenDaySegment: Segment = {
  id: "sevenDay",
  render: (ctx) => renderWindow(WINDOW_LABELS.sevenDay, ctx.input.sevenDay, ctx),
};
