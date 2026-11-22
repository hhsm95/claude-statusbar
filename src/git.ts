import { execFileSync } from "node:child_process";
import { GIT_TIMEOUT_MS } from "./constants.ts";

/** Runs `git -C <dir> <args>`; returns trimmed stdout, or null on any failure or timeout. */
export function runGit(dir: string, args: readonly string[]): string | null {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      timeout: GIT_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}
