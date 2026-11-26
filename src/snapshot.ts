import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { SNAPSHOT } from "./constants.ts";
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
