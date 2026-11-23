import {
  CACHE_WARN_SECONDS,
  COLORS,
  GLYPHS,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  STRINGS,
} from "../constants.ts";
import { humanTokens } from "../format/tokens.ts";
import { readLastRequest } from "../transcript.ts";
import type { Segment } from "./types.ts";

export const cacheSegment: Segment = {
  id: "cache",
  render: ({ input, now, ansi }) => {
    if (!input.transcriptPath) return null;
    const request = readLastRequest(input.transcriptPath);
    if (!request) return null;

    const remaining =
      request.startMs / MS_PER_SECOND + request.ttlSec - now.getTime() / MS_PER_SECOND;
    if (remaining <= 0) {
      const text = `${GLYPHS.cacheExpired} ${STRINGS.cacheExpired} ${GLYPHS.dot} ${humanTokens(request.promptTokens)} ${STRINGS.tokens}`;
      return ansi.color(COLORS.crit, text);
    }
    if (remaining > (CACHE_WARN_SECONDS[request.ttlSec] ?? 0)) return null;
    const minutes = Math.floor(remaining / SECONDS_PER_MINUTE);
    const left = minutes < 1 ? STRINGS.underOneMinute : `${minutes}${STRINGS.minuteSuffix}`;
    return ansi.color(COLORS.warn, `${GLYPHS.cacheWarn} ${STRINGS.cache} ${left}`);
  },
};
