import {
  type Config,
  claudeDir,
  configPath,
  loadConfig,
  type SegmentId,
  settingsPath,
  writeConfig,
} from "../config.ts";
import { MESSAGES, SEGMENT_IDS, SETTINGS_KEYS, STATUS_LINE_DEFAULTS } from "../constants.ts";
import type { JsonObject } from "../json-file.ts";
import { writeSettings } from "../settings.ts";
import { type Io, loadSettings, pointsToStatusbar, statusLineOf } from "./shared.ts";

export interface InitOptions {
  yes: boolean;
  /** Whether stdin is a TTY; prompts only run when it is and `yes` is false. */
  interactive: boolean;
}

export interface SegmentChoice {
  id: SegmentId;
  checked: boolean;
}

export interface Prompts {
  confirm(message: string): Promise<boolean>;
  checkbox(message: string, choices: readonly SegmentChoice[]): Promise<readonly SegmentId[]>;
}

/** `@inquirer/prompts` is loaded here and nowhere else, so rendering never pays for it. */
export const inquirerPrompts: Prompts = {
  async confirm(message) {
    const { confirm } = await import("@inquirer/prompts");
    return confirm({ message, default: true });
  },
  async checkbox(message, choices) {
    const { checkbox } = await import("@inquirer/prompts");
    return checkbox<SegmentId>({
      message,
      choices: choices.map(({ id, checked }) => ({ name: id, value: id, checked })),
    });
  },
};

async function askSegments(prompts: Prompts, config: Config): Promise<Record<SegmentId, boolean>> {
  const choices = SEGMENT_IDS.map((id) => ({ id, checked: config.segments[id] }));
  const chosen = await prompts.checkbox(MESSAGES.initPromptSegments, choices);
  const segments = {} as Record<SegmentId, boolean>;
  for (const id of SEGMENT_IDS) segments[id] = chosen.includes(id);
  return segments;
}

/** The command when there is one, else the raw JSON, so the user sees what is being replaced. */
function describeStatusLine(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    const command = (value as JsonObject)[SETTINGS_KEYS.command];
    if (typeof command === "string") return command;
  }
  return JSON.stringify(value);
}

function buildStatusLine(existing: unknown): JsonObject {
  const base: JsonObject = pointsToStatusbar(existing) ? existing : { ...STATUS_LINE_DEFAULTS };
  return {
    ...base,
    [SETTINGS_KEYS.type]: STATUS_LINE_DEFAULTS.type,
    [SETTINGS_KEYS.command]: STATUS_LINE_DEFAULTS.command,
  };
}

export async function runInit(
  env: Readonly<Record<string, string | undefined>>,
  options: InitOptions,
  io: Io,
  prompts: Prompts = inquirerPrompts,
): Promise<number> {
  const dir = claudeDir(env);
  const loaded = loadSettings(dir);
  if (!loaded.ok) {
    io.err(`${loaded.message}\n`);
    return 1;
  }
  const { settings } = loaded;
  const config = loadConfig(dir);
  const existing = statusLineOf(settings);
  const replacing = existing !== undefined && !pointsToStatusbar(existing);
  const prompt = options.interactive && !options.yes;

  if (replacing && prompt) {
    const accepted = await prompts.confirm(
      MESSAGES.initConfirmReplace(describeStatusLine(existing)),
    );
    if (!accepted) {
      io.out(`${MESSAGES.initDeclined}\n`);
      return 0;
    }
  }
  if (prompt) config.segments = await askSegments(prompts, config);
  if (replacing) config.previousStatusLine = existing;

  settings[SETTINGS_KEYS.statusLine] = buildStatusLine(existing);
  // The config goes first: if settings.json then fails, the previous line is already saved.
  writeConfig(dir, config);
  writeSettings(dir, settings);
  io.out(`${MESSAGES.initWrote(settingsPath(dir))}\n${MESSAGES.initWrote(configPath(dir))}\n`);
  return 0;
}
