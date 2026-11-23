import { isJsonObject } from "./json-file.ts";

export interface ContextInput {
  inputTokens?: number;
  outputTokens?: number;
  size?: number;
  usedPct?: number;
}

export interface WindowInput {
  usedPct?: number;
  resetsAt?: number;
}

export interface StatusInput {
  modelName?: string;
  effortLevel?: string;
  sessionId?: string;
  currentDir?: string;
  transcriptPath?: string;
  context: ContextInput;
  fiveHour: WindowInput;
  sevenDay: WindowInput;
}

function at(root: unknown, path: readonly string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (!isJsonObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function str(root: unknown, path: readonly string[]): string | undefined {
  const value = at(root, path);
  return typeof value === "string" && value !== "" ? value : undefined;
}

function num(root: unknown, path: readonly string[]): number | undefined {
  const value = at(root, path);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseWindow(root: unknown, key: string): WindowInput {
  return {
    usedPct: num(root, ["rate_limits", key, "used_percentage"]),
    resetsAt: num(root, ["rate_limits", key, "resets_at"]),
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Never throws: anything unreadable becomes a missing field. */
export function parseStatusInput(raw: string): StatusInput {
  const root = parseJson(raw);
  return {
    modelName: str(root, ["model", "display_name"]),
    effortLevel: str(root, ["effort", "level"]),
    sessionId: str(root, ["session_id"]),
    currentDir: str(root, ["workspace", "current_dir"]) ?? str(root, ["cwd"]),
    transcriptPath: str(root, ["transcript_path"]),
    context: {
      inputTokens: num(root, ["context_window", "total_input_tokens"]),
      outputTokens: num(root, ["context_window", "total_output_tokens"]),
      size: num(root, ["context_window", "context_window_size"]),
      usedPct: num(root, ["context_window", "used_percentage"]),
    },
    fiveHour: parseWindow(root, "five_hour"),
    sevenDay: parseWindow(root, "seven_day"),
  };
}
