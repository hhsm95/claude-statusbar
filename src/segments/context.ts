import {
  COLORS,
  DETAIL_LABELS,
  DETAIL_TEXT,
  GLYPHS,
  PERCENT,
  STRINGS,
  THRESHOLDS,
} from "../constants.ts";
import { fullNumber, humanTokens } from "../format/tokens.ts";
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
  detail: ({ input, ansi }) => {
    const { inputTokens, outputTokens, size, usedPct } = input.context;
    if (inputTokens !== undefined && size !== undefined && size > 0) {
      const used = inputTokens + (outputTokens ?? 0);
      const pct = Math.round((used * PERCENT) / size);
      const counts = `${fullNumber(used)} / ${fullNumber(size)} ${DETAIL_TEXT.tokens}`;
      const parts = [
        `${counts} (${pct}%)`,
        `${DETAIL_TEXT.in} ${fullNumber(inputTokens)}`,
        ...(outputTokens === undefined ? [] : [`${DETAIL_TEXT.out} ${fullNumber(outputTokens)}`]),
      ];
      const value = ansi.color(colorFor(pct), parts.join(` ${GLYPHS.dot} `));
      return [{ label: DETAIL_LABELS.context, value }];
    }
    if (usedPct !== undefined) {
      return [{ label: DETAIL_LABELS.context, value: ansi.dim(`${Math.round(usedPct)}%`) }];
    }
    return null;
  },
};
