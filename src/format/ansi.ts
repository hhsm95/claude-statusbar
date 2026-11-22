import { ANSI, COLORS, ENV } from "../constants.ts";

export interface Ansi {
  color(code: number, text: string): string;
  bold(text: string): string;
  dim(text: string): string;
}

export function isColorDisabled(env: Readonly<Record<string, string | undefined>>): boolean {
  const value = env[ENV.noColor];
  return value !== undefined && value !== "";
}

export function createAnsi(enabled: boolean): Ansi {
  if (!enabled) {
    const plain = (text: string): string => text;
    return { color: (_code, text) => text, bold: plain, dim: plain };
  }
  const color = (code: number, text: string): string => `\x1b[38;5;${code}m${text}${ANSI.reset}`;
  return {
    color,
    bold: (text) => `${ANSI.bold}${text}${ANSI.reset}`,
    dim: (text) => color(COLORS.dim, text),
  };
}
