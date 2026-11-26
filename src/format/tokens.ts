import { HUNDRED_THOUSAND, MILLION_THRESHOLD, TEN_THOUSAND, THOUSAND } from "../constants.ts";

export function humanTokens(n: number): string {
  if (n >= MILLION_THRESHOLD) {
    const millions = Math.round(n / HUNDRED_THOUSAND) / 10;
    return `${millions}M`;
  }
  if (n >= TEN_THOUSAND) return `${Math.round(n / THOUSAND)}K`;
  if (n >= THOUSAND) return `${(n / THOUSAND).toFixed(1)}K`;
  return `${Math.trunc(n)}`;
}

/** Whole number with `,` thousands separators, whatever the locale. */
export function fullNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
