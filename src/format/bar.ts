import { BAR_CELLS, GLYPHS, PERCENT } from "../constants.ts";

export function bar(pct: number, cells: number = BAR_CELLS): string {
  const raw = Number.isFinite(pct) ? Math.round((pct * cells) / PERCENT) : 0;
  const filled = Math.min(cells, Math.max(0, raw));
  return GLYPHS.barFilled.repeat(filled) + GLYPHS.barEmpty.repeat(cells - filled);
}
