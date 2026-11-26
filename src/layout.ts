import { ENV, GLYPHS, WIDTH } from "./constants.ts";
import { type Paint, type Piece, printPiece } from "./segments/types.ts";

const POSITIVE_INTEGER = /^\d+$/;
const SEPARATOR = ` ${GLYPHS.separator} `;
const wideGlyphs: readonly string[] = WIDTH.wideGlyphs;

/** The terminal width from `COLUMNS`: a positive integer, or undefined when unknown or invalid. */
export function parseColumns(
  env: Readonly<Record<string, string | undefined>>,
): number | undefined {
  const raw = env[ENV.columns];
  if (raw === undefined || !POSITIVE_INTEGER.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** Visible columns of plain text: one per code point, two for the wide glyphs. */
export function width(text: string): number {
  let total = 0;
  for (const char of text) total += wideGlyphs.includes(char) ? 2 : 1;
  return total;
}

/** Cuts a name longer than `cap` code points to `cap - 1` code points plus an ellipsis. */
export function truncate(text: string, cap: number): string {
  const chars = Array.from(text);
  if (chars.length <= cap) return text;
  return chars.slice(0, Math.max(cap - 1, 0)).join("") + GLYPHS.ellipsis;
}

interface Shape {
  /** Largest name length; undefined means names keep their full length. */
  cap: number | undefined;
  keepBars: boolean;
}

function shapePieces(pieces: readonly Piece[], shape: Shape): Piece[] {
  const kept = shape.keepBars ? pieces : pieces.filter((piece) => piece.kind !== "bar");
  const { cap } = shape;
  if (cap === undefined) return [...kept];
  return kept.map((piece) =>
    piece.kind === "name" ? { ...piece, text: truncate(piece.text, cap) } : piece,
  );
}

function plainWidth(pieces: readonly Piece[]): number {
  let total = 0;
  for (const piece of pieces) total += width(piece.lead) + width(piece.label) + width(piece.text);
  return total;
}

function lineWidth(segments: readonly (readonly Piece[])[]): number {
  const separators = Math.max(segments.length - 1, 0) * width(SEPARATOR);
  return segments.reduce((sum, pieces) => sum + plainWidth(pieces), separators);
}

function longestName(segments: readonly (readonly Piece[])[]): number {
  let longest = 0;
  for (const pieces of segments) {
    for (const piece of pieces) {
      if (piece.kind === "name") longest = Math.max(longest, Array.from(piece.text).length);
    }
  }
  return longest;
}

function print(segments: readonly (readonly Piece[])[], paintSeparator: Paint): string {
  const separator = ` ${paintSeparator(GLYPHS.separator)} `;
  return segments.map((pieces) => pieces.map(printPiece).join("")).join(separator);
}

/** Fills lines in order; a segment wider than a whole line gets its own line and overflows. */
function wrap(segments: readonly (readonly Piece[])[], available: number): (readonly Piece[])[][] {
  const lines: (readonly Piece[])[][] = [];
  let current: (readonly Piece[])[] = [];
  for (const pieces of segments) {
    if (current.length > 0 && lineWidth([...current, pieces]) > available) {
      lines.push(current);
      current = [];
    }
    current.push(pieces);
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * Joins the segments' pieces into one line that fits `columns` (minus a safety margin) when it can:
 * names are cut first, then bars dropped, and past that the compact form wraps onto more lines.
 * Unknown width prints everything on one line. Width is measured on plain text; `paintSeparator`
 * styles the separator only when printing. Lines are joined with `\n` (no trailing newline).
 */
export function layoutLine(
  segments: readonly (readonly Piece[])[],
  columns: number | undefined,
  paintSeparator: Paint,
): string {
  const shaped = (shape: Shape): Piece[][] => segments.map((pieces) => shapePieces(pieces, shape));
  if (columns === undefined) return print(segments, paintSeparator);

  const available = columns - WIDTH.margin;
  const fits = (candidate: readonly (readonly Piece[])[]): boolean =>
    lineWidth(candidate) <= available;

  const full = shaped({ cap: undefined, keepBars: true });
  if (fits(full)) return print(full, paintSeparator);

  const longest = longestName(segments);
  for (const keepBars of [true, false]) {
    for (let cap = longest; cap >= WIDTH.minName; cap--) {
      const candidate = shaped({ cap, keepBars });
      if (fits(candidate)) return print(candidate, paintSeparator);
    }
  }
  const compact = shaped({ cap: WIDTH.minName, keepBars: false });
  return wrap(compact, available)
    .map((line) => print(line, paintSeparator))
    .join("\n");
}
