import { readFileSync, statSync } from "node:fs";
import { claudeDir, loadConfig } from "../config.ts";
import { DETAIL_LABELS, DETAILS, ENV, STRINGS } from "../constants.ts";
import { type Ansi, createAnsi, isColorDisabled } from "../format/ansi.ts";
import { formatDuration } from "../format/time.ts";
import { runGit } from "../git.ts";
import { parseStatusInput } from "../input.ts";
import { isJsonObject } from "../json-file.ts";
import { SEGMENTS } from "../segments/registry.ts";
import type { DetailRow, RenderContext, Segment } from "../segments/types.ts";
import { isSafeSessionId, snapshotPath } from "../snapshot.ts";
import type { Io } from "./shared.ts";

/** Header, then `label value` rows with dim labels padded to the longest; `no data` when empty. */
export function formatDetails(rows: readonly DetailRow[], ageSec: number, ansi: Ansi): string {
  const header = `${DETAILS.header(formatDuration(ageSec))}\n`;
  if (rows.length === 0) return `${header}${ansi.dim(STRINGS.noData)}\n`;
  const width = Math.max(...rows.map((row) => row.label.length));
  const lines = rows.map(
    (row) => `${ansi.dim(row.label.padEnd(width))}${DETAILS.labelGap}${row.value}\n`,
  );
  return header + lines.join("");
}

function collectRows(
  segments: readonly Segment[],
  enabled: Readonly<Record<string, boolean>>,
  ctx: RenderContext,
): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const segment of segments) {
    if (!enabled[segment.id]) continue;
    try {
      rows.push(...(segment.detail?.(ctx) ?? []));
    } catch {
      // A failing segment contributes nothing, as in `render`.
    }
  }
  return rows;
}

function costRow(costUsd: number | undefined): DetailRow[] {
  if (costUsd === undefined) return [];
  const value = `${DETAILS.costPrefix}${costUsd.toFixed(DETAILS.costDecimals)}`;
  return [{ label: DETAIL_LABELS.cost, value }];
}

function readSnapshot(path: string): { raw: string; mtimeMs: number } | null {
  try {
    const raw = readFileSync(path, "utf8");
    if (!isJsonObject(JSON.parse(raw))) return null;
    return { raw, mtimeMs: statSync(path).mtimeMs };
  } catch {
    return null;
  }
}

export function runDetails(
  env: Readonly<Record<string, string | undefined>>,
  io: Io,
  now: Date = new Date(),
  segments: readonly Segment[] = SEGMENTS,
): number {
  const sessionId = env[ENV.sessionId];
  if (!isSafeSessionId(sessionId)) {
    io.err(`${DETAILS.noSession}\n`);
    return 1;
  }
  const dir = claudeDir(env);
  const snapshot = readSnapshot(snapshotPath(dir, sessionId));
  if (snapshot === null) {
    io.err(`${DETAILS.noSnapshot}\n`);
    return 1;
  }

  const ansi = createAnsi(!isColorDisabled(env));
  const input = parseStatusInput(snapshot.raw);
  const ctx: RenderContext = { input, now, claudeDir: dir, ansi, runGit };
  const rows = [...collectRows(segments, loadConfig(dir).segments, ctx), ...costRow(input.costUsd)];
  const ageSec = Math.max(0, Math.floor((now.getTime() - snapshot.mtimeMs) / 1000));
  io.out(formatDetails(rows, ageSec, ansi));
  return 0;
}
