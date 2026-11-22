import { settingsPath } from "../config.ts";
import { MESSAGES, SETTINGS_KEYS, STATUS_LINE_DEFAULTS } from "../constants.ts";
import { isJsonObject, type JsonObject } from "../json-file.ts";
import { readSettings } from "../settings.ts";

export interface Io {
  out(text: string): void;
  err(text: string): void;
}

export type LoadedSettings = { ok: true; settings: JsonObject } | { ok: false; message: string };

/** Reads settings.json; an invalid or unreadable file becomes a message naming it. */
export function loadSettings(dir: string): LoadedSettings {
  const result = readSettings(dir);
  if (result.ok) return result;
  return {
    ok: false,
    message: MESSAGES.settingsInvalid(settingsPath(dir), MESSAGES.settingsReasons[result.reason]),
  };
}

export function statusLineOf(settings: JsonObject): unknown {
  return settings[SETTINGS_KEYS.statusLine];
}

export function pointsToStatusbar(statusLine: unknown): statusLine is JsonObject {
  return (
    isJsonObject(statusLine) && statusLine[SETTINGS_KEYS.command] === STATUS_LINE_DEFAULTS.command
  );
}
