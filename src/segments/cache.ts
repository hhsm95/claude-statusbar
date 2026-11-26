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
import { fixed, type Segment } from "./types.ts";

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
      return [fixed(text, (s) => ansi.color(COLORS.crit, s))];
    }
    if (remaining > (CACHE_WARN_SECONDS[request.ttlSec] ?? 0)) return null;
    const minutes = Math.floor(remaining / SECONDS_PER_MINUTE);
    const left = minutes < 1 ? STRINGS.underOneMinute : `${minutes}${STRINGS.minuteSuffix}`;
    const text = `${GLYPHS.cacheWarn} ${STRINGS.cache} ${left}`;
    return [fixed(text, (s) => ansi.color(COLORS.warn, s))];
  },
};
