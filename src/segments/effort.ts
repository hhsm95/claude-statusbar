import type { Segment } from "./types.ts";

export const effortSegment: Segment = {
  id: "effort",
  render: ({ input, ansi }) =>
    input.effortLevel === undefined ? null : ansi.dim(input.effortLevel),
};
