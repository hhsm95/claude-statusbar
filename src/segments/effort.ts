import { DETAIL_LABELS } from "../constants.ts";
import { fixed, type Segment } from "./types.ts";

export const effortSegment: Segment = {
  id: "effort",
  render: ({ input, ansi }) =>
    input.effortLevel === undefined ? null : [fixed(input.effortLevel, ansi.dim)],
  detail: ({ input }) =>
    input.effortLevel === undefined
      ? null
      : [{ label: DETAIL_LABELS.effort, value: input.effortLevel }],
};
