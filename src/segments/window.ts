import { COLORS, GLYPHS, PERCENT, THRESHOLDS } from "../constants.ts";
import { bar } from "../format/bar.ts";
import { formatReset } from "../format/time.ts";
import type { WindowInput } from "../input.ts";
import { bar as barPiece, fixed, type Piece, type RenderContext } from "./types.ts";

function colorFor(pct: number): number {
  if (pct >= THRESHOLDS.windowCrit) return COLORS.crit;
  if (pct >= THRESHOLDS.windowWarn) return COLORS.warn;
  return COLORS.ok;
}

/** Shared by the 5h and 7d segments: `<label> <bar> <pct>% ↺<reset>`, as pieces. */
export function renderWindow(
  label: string,
  window: WindowInput,
  ctx: RenderContext,
): readonly Piece[] | null {
  if (window.usedPct === undefined) return null;
  const nowSec = ctx.now.getTime() / 1000;
  const expired = window.resetsAt !== undefined && window.resetsAt <= nowSec;
  // The bar uses the clamped raw value, not the rounded printed one (74.6 -> 7 cells, "75%").
  const raw = expired ? 0 : Math.min(PERCENT, Math.max(0, window.usedPct));
  const pct = Math.round(raw);
  const code = colorFor(pct);
  const { ansi } = ctx;
  const paint = (text: string): string => ansi.color(code, text);
  const pieces = [
    fixed(label, (text) => text),
    barPiece(bar(raw), paint, " "),
    fixed(`${pct}%`, paint, " "),
  ];
  if (window.resetsAt !== undefined && !expired) {
    pieces.push(fixed(`${GLYPHS.reset}${formatReset(window.resetsAt, ctx.now)}`, ansi.dim, " "));
  }
  return pieces;
}
