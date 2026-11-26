import { createAnsi } from "../src/format/ansi.ts";
import { parseStatusInput, type StatusInput } from "../src/input.ts";
import type { GitRunner, Piece, RenderContext } from "../src/segments/types.ts";

export const PLAIN = createAnsi(false);
export const COLORED = createAnsi(true);

export const NOW = new Date("2026-11-20T12:00:00Z");
export const NOW_SEC = NOW.getTime() / 1000;

export const noGit: GitRunner = () => null;

export function inputFrom(value: unknown): StatusInput {
  return parseStatusInput(JSON.stringify(value));
}

export function makeContext(
  value: unknown,
  overrides: Partial<Omit<RenderContext, "input">> = {},
): RenderContext {
  return {
    input: inputFrom(value),
    now: NOW,
    claudeDir: "/nonexistent-claude-dir",
    ansi: COLORED,
    runGit: noGit,
    ...overrides,
  };
}

export const fg = (code: number, text: string): string => `\x1b[38;5;${code}m${text}\x1b[0m`;

/** Full-length print of a segment's pieces (`lead + paint(label + text)`), null passes through. */
export function piecesText(pieces: readonly Piece[] | null): string | null {
  return pieces === null ? null : pieces.map((p) => p.lead + p.paint(p.label + p.text)).join("");
}
