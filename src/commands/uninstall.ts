import { claudeDir, loadConfig, writeConfig } from "../config.ts";
import { MESSAGES, SETTINGS_KEYS } from "../constants.ts";
import { writeSettings } from "../settings.ts";
import { type Io, loadSettings, pointsToStatusbar, statusLineOf } from "./shared.ts";

export function runUninstall(env: Readonly<Record<string, string | undefined>>, io: Io): number {
  const dir = claudeDir(env);
  const loaded = loadSettings(dir);
  if (!loaded.ok) {
    io.err(`${loaded.message}\n`);
    return 1;
  }
  const { settings } = loaded;
  if (!pointsToStatusbar(statusLineOf(settings))) {
    io.out(`${MESSAGES.uninstallNothing}\n`);
    return 0;
  }

  const config = loadConfig(dir);
  if (config.previousStatusLine === undefined) {
    delete settings[SETTINGS_KEYS.statusLine];
    writeSettings(dir, settings);
    io.out(`${MESSAGES.uninstallRemoved}\n`);
    return 0;
  }

  settings[SETTINGS_KEYS.statusLine] = config.previousStatusLine;
  writeSettings(dir, settings);
  delete config.previousStatusLine;
  writeConfig(dir, config);
  io.out(`${MESSAGES.uninstallRestored}\n`);
  return 0;
}
