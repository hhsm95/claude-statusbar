import { COLORS, DETAIL_TEXT, GLYPHS, MS_PER_SECOND, PERCENT, THRESHOLDS } from "../constants.ts";
import { bar } from "../format/bar.ts";
import { formatDuration, formatReset } from "../format/time.ts";
import type { WindowInput } from "../input.ts";
import { bar as barPiece, type DetailRow, fixed, type Piece, type RenderContext } from "./types.ts";

function colorFor(pct: number): number {
  if (pct >= THRESHOLDS.windowCrit) return COLORS.crit;
  if (pct >= THRESHOLDS.windowWarn) return COLORS.warn;
  return COLORS.ok;
}

interface WindowState {
  raw: number;
  pct: number;
  expired: boolean;
  nowSec: number;
}

function windowState(window: WindowInput, ctx: RenderContext): WindowState | null {
  if (window.usedPct === undefined) return null;
  const nowSec = ctx.now.getTime() / MS_PER_SECOND;
  const expired = window.resetsAt !== undefined && window.resetsAt <= nowSec;
  // The bar uses the clamped raw value, not the rounded printed one (74.6 -> 7 cells, "75%").
  const raw = expired ? 0 : Math.min(PERCENT, Math.max(0, window.usedPct));
  return { raw, pct: Math.round(raw), expired, nowSec };
}

/** Shared by the 5h and 7d segments: `<label> <bar> <pct>% ↺<reset>`, as pieces. */
export function renderWindow(
  label: string,
  window: WindowInput,
  ctx: RenderContext,
): readonly Piece[] | null {
  const state = windowState(window, ctx);
  if (state === null) return null;
  const { raw, pct, expired } = state;
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

/** Detail row of the 5h and 7d segments: `<pct>% · resets <reset> (in <duration>)`. */
export function detailWindow(
  label: string,
  window: WindowInput,
  ctx: RenderContext,
): readonly DetailRow[] | null {
  const state = windowState(window, ctx);
  if (state === null) return null;
  const { ansi } = ctx;
  const pct = ansi.color(colorFor(state.pct), `${state.pct}%`);
  const { resetsAt } = window;
  let value = pct;
  if (state.expired) {
    value += ` ${GLYPHS.dot} ${DETAIL_TEXT.resetPassed}`;
  } else if (resetsAt !== undefined) {
    const reset = formatReset(resetsAt, ctx.now);
    const left = formatDuration(resetsAt - state.nowSec);
    value += ` ${GLYPHS.dot} ${DETAIL_TEXT.resets} ${reset} (${DETAIL_TEXT.in} ${left})`;
  }
  return [{ label, value }];
}
