import { COLORS, PERCENT, STRINGS, THRESHOLDS } from "../constants.ts";
import { humanTokens } from "../format/tokens.ts";
import { fixed, type Segment } from "./types.ts";

function colorFor(pct: number): number {
  if (pct >= THRESHOLDS.contextCrit) return COLORS.crit;
  if (pct >= THRESHOLDS.contextWarn) return COLORS.warn;
  return COLORS.dim;
}

export const contextSegment: Segment = {
  id: "context",
  render: ({ input, ansi }) => {
    const { inputTokens, outputTokens, size, usedPct } = input.context;
    if (inputTokens !== undefined && size !== undefined && size > 0) {
      const used = inputTokens + (outputTokens ?? 0);
      const pct = Math.round((used * PERCENT) / size);
      const paint = (text: string): string => ansi.color(colorFor(pct), text);
      return [fixed(`${humanTokens(used)}/${humanTokens(size)}`, paint)];
    }
    if (usedPct !== undefined) {
      return [fixed(`${STRINGS.contextPrefix} ${Math.round(usedPct)}%`, ansi.dim)];
    }
    return null;
  },
};
