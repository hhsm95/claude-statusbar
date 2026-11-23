import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FILES, GLYPHS, MS_PER_SECOND } from "../constants.ts";
import { formatStart } from "../format/time.ts";
import { isJsonObject } from "../json-file.ts";
import type { Segment } from "./types.ts";

const SESSION_FILE_SUFFIX = ".json";

interface SessionInfo {
  name: string;
  startedAtMs?: number;
}

function readSession(path: string, sessionId: string): SessionInfo | undefined {
  try {
    const data: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isJsonObject(data) || data.sessionId !== sessionId) return undefined;
    if (typeof data.name !== "string" || data.name === "") return undefined;
    const startedAtMs =
      typeof data.startedAt === "number" && Number.isFinite(data.startedAt)
        ? data.startedAt
        : undefined;
    return { name: data.name, startedAtMs };
  } catch {
    return undefined;
  }
}

function sessionLabel({ name, startedAtMs }: SessionInfo, now: Date): string {
  const label = `${GLYPHS.session} ${name}`;
  if (startedAtMs === undefined) return label;
  return `${label} ${GLYPHS.dot} ${formatStart(startedAtMs / MS_PER_SECOND, now)}`;
}

function listSessionFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((file) => file.endsWith(SESSION_FILE_SUFFIX))
      .sort();
  } catch {
    return [];
  }
}

/** Best-effort: `<claudeDir>/sessions/*.json` is undocumented, so any mismatch hides the segment. */
export const sessionSegment: Segment = {
  id: "session",
  render: ({ input, claudeDir, ansi, now }) => {
    if (input.sessionId === undefined) return null;
    const dir = join(claudeDir, FILES.sessionsDir);
    for (const file of listSessionFiles(dir)) {
      const session = readSession(join(dir, file), input.sessionId);
      if (session !== undefined) return ansi.dim(sessionLabel(session, now));
    }
    return null;
  },
};
