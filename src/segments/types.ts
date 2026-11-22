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

export interface Segment {
  id: SegmentId;
  /** Returns the styled text, or null when there is nothing to show. */
  render(ctx: RenderContext): string | null;
}
