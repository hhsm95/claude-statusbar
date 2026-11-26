import { DETAIL_LABELS, WINDOW_LABELS } from "../constants.ts";
import type { Segment } from "./types.ts";
import { detailWindow, renderWindow } from "./window.ts";

export const sevenDaySegment: Segment = {
  id: "sevenDay",
  render: (ctx) => renderWindow(WINDOW_LABELS.sevenDay, ctx.input.sevenDay, ctx),
  detail: (ctx) => detailWindow(DETAIL_LABELS.sevenDay, ctx.input.sevenDay, ctx),
};
