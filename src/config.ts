import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ENV, FILES, SEGMENT_IDS } from "./constants.ts";
import { isJsonObject, writeJsonAtomic } from "./json-file.ts";

export type SegmentId = (typeof SEGMENT_IDS)[number];

export interface Config {
  segments: Record<SegmentId, boolean>;
  /** Whatever `statusLine` held before init replaced it; restored as-is by uninstall. */
  previousStatusLine?: unknown;
}

export function claudeDir(env: Readonly<Record<string, string | undefined>>): string {
  const custom = env[ENV.configDir];
  return custom !== undefined && custom !== "" ? custom : join(homedir(), FILES.claudeDirName);
}

export const configPath = (dir: string): string => join(dir, FILES.config);
export const settingsPath = (dir: string): string => join(dir, FILES.settings);

export function defaultConfig(): Config {
  const segments = {} as Record<SegmentId, boolean>;
  for (const id of SEGMENT_IDS) segments[id] = true;
  return { segments };
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

/** Tolerant: any problem with the file falls back to the defaults for the affected part. */
export function loadConfig(dir: string): Config {
  const config = defaultConfig();
  const root = readJson(configPath(dir));
  if (!isJsonObject(root)) return config;
  if (isJsonObject(root.segments)) {
    for (const id of SEGMENT_IDS) {
      const toggle = root.segments[id];
      if (typeof toggle === "boolean") config.segments[id] = toggle;
    }
  }
  if (root.previousStatusLine !== undefined) config.previousStatusLine = root.previousStatusLine;
  return config;
}

export function writeConfig(dir: string, config: Config): void {
  writeJsonAtomic(configPath(dir), config);
}
