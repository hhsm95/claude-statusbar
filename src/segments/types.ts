import type { SegmentId } from "../config.ts";
import type { Ansi } from "../format/ansi.ts";
import type { StatusInput } from "../input.ts";

/** Runs `git -C <dir> <args>`; returns trimmed stdout, or null on any failure. */
export type GitRunner = (dir: string, args: readonly string[]) => string | null;

export interface RenderContext {
  input: StatusInput;
  now: Date;
  claudeDir: string;
  ansi: Ansi;
  runGit: GitRunner;
}

export type Paint = (text: string) => string;

/** A piece prints as `lead + paint(label + text)`. */
export interface Piece {
  kind: "fixed" | "name" | "bar";
  /** Unstyled text printed before the piece (usually a space). Dropped with a "bar" piece. */
  lead: string;
  /** Styled together with `text`, never truncated (e.g. "⎇ ", "⌂ "). */
  label: string;
  /** For "name", the truncatable part. */
  text: string;
  paint: Paint;
}

export interface Segment {
  id: SegmentId;
  /** Returns the pieces to print, or null when there is nothing to show. */
  render(ctx: RenderContext): readonly Piece[] | null;
}

/** A piece that is never shortened or dropped. */
export function fixed(text: string, paint: Paint, lead = "", label = ""): Piece {
  return { kind: "fixed", lead, label, text, paint };
}

/** A piece whose `text` can be truncated. */
export function name(text: string, paint: Paint, lead = "", label = ""): Piece {
  return { kind: "name", lead, label, text, paint };
}

/** A piece that is dropped (with its lead) when space runs out. */
export function bar(text: string, paint: Paint, lead = ""): Piece {
  return { kind: "bar", lead, label: "", text, paint };
}

/** Prints one piece at full length. */
export function printPiece(piece: Piece): string {
  return piece.lead + piece.paint(piece.label + piece.text);
}
