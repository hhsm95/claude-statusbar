import type { Segment } from "./types.ts";

export const modelSegment: Segment = {
  id: "model",
  render: ({ input, ansi }) => (input.modelName === undefined ? null : ansi.bold(input.modelName)),
};
