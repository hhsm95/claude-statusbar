import type { Config } from "./config.ts";
import { GLYPHS, STRINGS } from "./constants.ts";
import { SEGMENTS } from "./segments/registry.ts";
import type { RenderContext, Segment } from "./segments/types.ts";

function renderSegment(segment: Segment, ctx: RenderContext): string | null {
  try {
    const text = segment.render(ctx);
    return text === null || text === "" ? null : text;
  } catch {
    return null;
  }
}

/** Joins the enabled, non-empty segments. Disabled segments are never rendered. Never throws. */
export function render(
  config: Config,
  ctx: RenderContext,
  segments: readonly Segment[] = SEGMENTS,
): string {
  const parts: string[] = [];
  for (const segment of segments) {
    if (!config.segments[segment.id]) continue;
    const text = renderSegment(segment, ctx);
    if (text !== null) parts.push(text);
  }
  if (parts.length === 0) return `${ctx.ansi.dim(STRINGS.noData)}\n`;
  return `${parts.join(` ${ctx.ansi.dim(GLYPHS.separator)} `)}\n`;
}
