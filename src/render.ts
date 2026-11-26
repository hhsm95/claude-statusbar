import type { Config } from "./config.ts";
import { STRINGS } from "./constants.ts";
import { layoutLine } from "./layout.ts";
import { SEGMENTS } from "./segments/registry.ts";
import type { Piece, RenderContext, Segment } from "./segments/types.ts";

export interface RenderOptions {
  /** Terminal width; undefined means unknown and the line is never shortened. */
  columns?: number | undefined;
  segments?: readonly Segment[];
}

function renderSegment(segment: Segment, ctx: RenderContext): readonly Piece[] | null {
  try {
    const pieces = segment.render(ctx);
    if (pieces === null) return null;
    // Checked on plain text: painting an empty string still yields ANSI codes.
    const hasText = pieces.some((piece) => piece.lead + piece.label + piece.text !== "");
    return hasText ? pieces : null;
  } catch {
    return null;
  }
}

/**
 * Lays out the enabled, non-empty segments to fit `columns`. Disabled segments are never rendered.
 * Never throws.
 */
export function render(
  config: Config,
  ctx: RenderContext,
  { columns, segments = SEGMENTS }: RenderOptions = {},
): string {
  const rendered: (readonly Piece[])[] = [];
  for (const segment of segments) {
    if (!config.segments[segment.id]) continue;
    const pieces = renderSegment(segment, ctx);
    if (pieces !== null) rendered.push(pieces);
  }
  if (rendered.length === 0) return `${ctx.ansi.dim(STRINGS.noData)}\n`;
  return `${layoutLine(rendered, columns, ctx.ansi.dim)}\n`;
}
