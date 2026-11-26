import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { SNAPSHOT } from "./constants.ts";
import { parseStatusInput, type StatusInput, type WindowInput } from "./input.ts";
import { isJsonObject, writeJsonAtomic } from "./json-file.ts";

export function isSafeSessionId(value: unknown): value is string {
  return typeof value === "string" && SNAPSHOT.sessionIdPattern.test(value);
}

function snapshotsDir(claudeDir: string): string {
  return join(claudeDir, ...SNAPSHOT.dirParts);
}

export function snapshotPath(claudeDir: string, sessionId: string): string {
  return join(snapshotsDir(claudeDir), `${sessionId}${SNAPSHOT.fileSuffix}`);
}

function isPrunable(name: string): boolean {
  return (
    name.endsWith(SNAPSHOT.fileSuffix) ||
    (name.startsWith(".") && name.endsWith(SNAPSHOT.tempSuffix))
  );
}

function pruneStale(dir: string, now: Date): void {
  for (const name of readdirSync(dir)) {
    if (!isPrunable(name)) continue;
    try {
      const path = join(dir, name);
      if (now.getTime() - statSync(path).mtimeMs > SNAPSHOT.retentionMs) rmSync(path);
    } catch {
      // One bad entry must not stop the rest from being pruned.
    }
  }
}

/**
 * Stores the stdin JSON as-is for the `details` command. Throws on I/O failure; the caller
 * decides to ignore it. Prunes old snapshots only when this write created a new file.
 */
export function saveSnapshot(claudeDir: string, raw: string, now: Date): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isJsonObject(parsed) || !isSafeSessionId(parsed.session_id)) return;
  const path = snapshotPath(claudeDir, parsed.session_id);
  const isNew = !existsSync(path);
  writeJsonAtomic(path, parsed);
  if (isNew) pruneStale(snapshotsDir(claudeDir), now);
}

/** `true` when `a` is fresher: later reset first (none ranks last), then higher usage. */
function isFresher(a: WindowInput, b: WindowInput): boolean {
  const resetA = a.resetsAt ?? Number.NEGATIVE_INFINITY;
  const resetB = b.resetsAt ?? Number.NEGATIVE_INFINITY;
  if (resetA !== resetB) return resetA > resetB;
  return (a.usedPct ?? 0) > (b.usedPct ?? 0);
}

/**
 * The most up-to-date reading of one quota window among sessions. Usage only grows inside a
 * window, so file order says nothing: an idle session can be written last with an old value.
 */
export function freshestWindow(windows: readonly WindowInput[]): WindowInput | undefined {
  let best: WindowInput | undefined;
  for (const window of windows) {
    if (window.usedPct === undefined) continue;
    if (best === undefined || isFresher(window, best)) best = window;
  }
  return best;
}

export type SnapshotWindows = Pick<StatusInput, "fiveHour" | "sevenDay">;

/** The 5h / 7d windows of every stored snapshot; files that fail to read are skipped. */
export function readAllWindows(claudeDir: string): SnapshotWindows[] {
  const dir = snapshotsDir(claudeDir);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const windows: SnapshotWindows[] = [];
  for (const name of names) {
    if (!name.endsWith(SNAPSHOT.fileSuffix)) continue;
    try {
      const { fiveHour, sevenDay } = parseStatusInput(readFileSync(join(dir, name), "utf8"));
      windows.push({ fiveHour, sevenDay });
    } catch {
      // One bad snapshot must not hide the others.
    }
  }
  return windows;
}
