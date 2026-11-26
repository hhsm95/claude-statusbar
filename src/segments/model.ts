import { DETAIL_LABELS } from "../constants.ts";
import { fixed, type Segment } from "./types.ts";

export const modelSegment: Segment = {
  id: "model",
  render: ({ input, ansi }) =>
    input.modelName === undefined ? null : [fixed(input.modelName, ansi.bold)],
  detail: ({ input }) =>
    input.modelName === undefined ? null : [{ label: DETAIL_LABELS.model, value: input.modelName }],
};
