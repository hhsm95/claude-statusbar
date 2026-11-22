import { readFileSync } from "node:fs";
import { settingsPath } from "./config.ts";
import { UTF8_BOM } from "./constants.ts";
import { isJsonObject, type JsonObject, writeJsonAtomic } from "./json-file.ts";

export type SettingsResult =
  | { ok: true; settings: JsonObject }
  | { ok: false; reason: "invalid-json" | "not-an-object" | "unreadable" };

/** A missing file is an empty settings object; anything else that is not a JSON object fails. */
export function readSettings(dir: string): SettingsResult {
  let raw: string;
  try {
    raw = readFileSync(settingsPath(dir), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" ? { ok: true, settings: {} } : { ok: false, reason: "unreadable" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.startsWith(UTF8_BOM) ? raw.slice(UTF8_BOM.length) : raw);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  return isJsonObject(parsed)
    ? { ok: true, settings: parsed }
    : { ok: false, reason: "not-an-object" };
}

export function writeSettings(dir: string, settings: JsonObject): void {
  writeJsonAtomic(settingsPath(dir), settings);
}
