import {
  CACHE_WARN_SECONDS,
  COLORS,
  DETAIL_LABELS,
  DETAIL_TEXT,
  GLYPHS,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  STRINGS,
} from "../constants.ts";
import { formatClock, formatDuration, ttlLabel } from "../format/time.ts";
import { humanTokens } from "../format/tokens.ts";
import { type LastRequest, readLastRequest } from "../transcript.ts";
import { type DetailRow, fixed, type RenderContext, type Segment } from "./types.ts";

interface CacheState {
  request: LastRequest;
  expiresSec: number;
  /** Seconds until the cache expires; zero or negative once expired. */
  remaining: number;
}

function readCache({ input, now }: RenderContext): CacheState | null {
  if (!input.transcriptPath) return null;
  const request = readLastRequest(input.transcriptPath);
  if (!request) return null;
  const expiresSec = request.startMs / MS_PER_SECOND + request.ttlSec;
  return { request, expiresSec, remaining: expiresSec - now.getTime() / MS_PER_SECOND };
}

function detail(ctx: RenderContext): readonly DetailRow[] | null {
  const state = readCache(ctx);
  if (state === null) return null;
  const { request, expiresSec, remaining } = state;
  const { ansi } = ctx;
  const clock = formatClock(expiresSec);
  const tokens = humanTokens(request.promptTokens);
  const label = DETAIL_LABELS.cache;
  if (remaining <= 0) {
    const text = `${DETAIL_TEXT.expired} ${clock} (${formatDuration(remaining)} ${DETAIL_TEXT.ago}) ${GLYPHS.dot} ${tokens} ${DETAIL_TEXT.tokensToRecache}`;
    return [{ label, value: ansi.color(COLORS.crit, text) }];
  }
  const text = `${DETAIL_TEXT.warm} ${GLYPHS.dot} ${DETAIL_TEXT.ttl} ${ttlLabel(request.ttlSec)} ${GLYPHS.dot} ${DETAIL_TEXT.expires} ${clock} (${DETAIL_TEXT.in} ${formatDuration(remaining)}) ${GLYPHS.dot} ${tokens} ${DETAIL_TEXT.promptTokens}`;
  const warning = remaining <= (CACHE_WARN_SECONDS[request.ttlSec] ?? 0);
  return [{ label, value: warning ? ansi.color(COLORS.warn, text) : text }];
}

export const cacheSegment: Segment = {
  id: "cache",
  detail,
  render: (ctx) => {
    const { ansi } = ctx;
    const state = readCache(ctx);
    if (state === null) return null;
    const { request, remaining } = state;
    if (remaining <= 0) {
      const text = `${GLYPHS.cacheExpired} ${STRINGS.cacheExpired} ${GLYPHS.dot} ${humanTokens(request.promptTokens)} ${STRINGS.tokens}`;
      return [fixed(text, (s) => ansi.color(COLORS.crit, s))];
    }
    if (remaining > (CACHE_WARN_SECONDS[request.ttlSec] ?? 0)) return null;
    const minutes = Math.floor(remaining / SECONDS_PER_MINUTE);
    const left = minutes < 1 ? STRINGS.underOneMinute : `${minutes}${STRINGS.minuteSuffix}`;
    const text = `${GLYPHS.cacheWarn} ${STRINGS.cache} ${left}`;
    return [fixed(text, (s) => ansi.color(COLORS.warn, s))];
  },
};
