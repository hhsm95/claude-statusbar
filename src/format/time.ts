import { MONTHS, MS_PER_SECOND, SECONDS_PER_DAY } from "../constants.ts";

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
