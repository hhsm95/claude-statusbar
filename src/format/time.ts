import {
  CACHE_TTL_SECONDS,
  DETAIL_TEXT,
  DURATION_MAX_UNITS,
  DURATION_UNITS,
  MONTHS,
  MS_PER_SECOND,
  SECONDS_PER_DAY,
} from "../constants.ts";

const pad2 = (n: number): string => String(n).padStart(2, "0");

function formatLocal(epochSec: number, withDate: boolean): string {
  const at = new Date(epochSec * MS_PER_SECOND);
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
  return withDate ? `${pad2(at.getDate())} ${MONTHS[at.getMonth()]} ${time}` : time;
}

const nowSec = (now: Date): number => now.getTime() / MS_PER_SECOND;

/** Local-time reset label: `HH:MM` under 24h ahead, `DD Mon HH:MM` otherwise. */
export function formatReset(epochSec: number, now: Date): string {
  return formatLocal(epochSec, epochSec - nowSec(now) >= SECONDS_PER_DAY);
}

/** Local-time start label: `HH:MM` under 24h ago, `DD Mon HH:MM` otherwise. */
export function formatStart(epochSec: number, now: Date): string {
  return formatLocal(epochSec, nowSec(now) - epochSec >= SECONDS_PER_DAY);
}

/** Local-time `HH:MM`. */
export function formatClock(epochSec: number): string {
  return formatLocal(epochSec, false);
}

/** The two largest non-zero units of d/h/m/s (`2h 12m`), `0s` at zero; the sign is ignored. */
export function formatDuration(seconds: number): string {
  let rest = Math.floor(Math.abs(seconds));
  const parts: string[] = [];
  for (const { suffix, seconds: unit } of DURATION_UNITS) {
    const count = Math.floor(rest / unit);
    rest -= count * unit;
    if (count > 0) parts.push(`${count}${suffix}`);
    if (parts.length === DURATION_MAX_UNITS) break;
  }
  return parts.length > 0 ? parts.join(" ") : DETAIL_TEXT.zeroDuration;
}

/** `5m` / `1h` for the known cache TTLs, else a duration. */
export function ttlLabel(ttlSec: number): string {
  if (ttlSec === CACHE_TTL_SECONDS.fiveMinutes) return DETAIL_TEXT.ttlFiveMinutes;
  if (ttlSec === CACHE_TTL_SECONDS.oneHour) return DETAIL_TEXT.ttlOneHour;
  return formatDuration(ttlSec);
}
