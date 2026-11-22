import { MONTHS, SECONDS_PER_DAY } from "../constants.ts";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Local-time reset label: `HH:MM` under 24h ahead, `DD Mon HH:MM` otherwise. */
export function formatReset(epochSec: number, now: Date): string {
  const at = new Date(epochSec * 1000);
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
  const aheadSec = epochSec - now.getTime() / 1000;
  if (aheadSec < SECONDS_PER_DAY) return time;
  return `${pad2(at.getDate())} ${MONTHS[at.getMonth()]} ${time}`;
}
