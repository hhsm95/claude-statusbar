import { fixed, type Segment } from "./types.ts";

export const modelSegment: Segment = {
  id: "model",
  render: ({ input, ansi }) =>
    input.modelName === undefined ? null : [fixed(input.modelName, ansi.bold)],
};
