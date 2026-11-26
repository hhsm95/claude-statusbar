import { fixed, type Segment } from "./types.ts";

export const effortSegment: Segment = {
  id: "effort",
  render: ({ input, ansi }) =>
    input.effortLevel === undefined ? null : [fixed(input.effortLevel, ansi.dim)],
};
