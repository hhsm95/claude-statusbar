import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FILES, GLYPHS } from "../constants.ts";
import { isJsonObject } from "../json-file.ts";
import type { Segment } from "./types.ts";

const SESSION_FILE_SUFFIX = ".json";

function readSessionName(path: string, sessionId: string): string | undefined {
  try {
    const data: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isJsonObject(data) || data.sessionId !== sessionId) return undefined;
    return typeof data.name === "string" && data.name !== "" ? data.name : undefined;
  } catch {
    return undefined;
  }
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
  render: ({ input, claudeDir, ansi }) => {
    if (input.sessionId === undefined) return null;
    const dir = join(claudeDir, FILES.sessionsDir);
    for (const file of listSessionFiles(dir)) {
      const name = readSessionName(join(dir, file), input.sessionId);
      if (name !== undefined) return ansi.dim(`${GLYPHS.session} ${name}`);
    }
    return null;
  },
};
