import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "node:test";

const CLI_PATH = join(import.meta.dirname, "..", "src", "cli.ts");

export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function runCli(
  args: readonly string[],
  options: { input?: string; env?: Record<string, string | undefined> } = {},
): CliResult {
  const env: NodeJS.ProcessEnv = { ...process.env, ...options.env };
  for (const [key, value] of Object.entries(options.env ?? {})) {
    if (value === undefined) delete env[key];
  }
  const result = spawnSync(process.execPath, ["--import", "tsx", CLI_PATH, ...args], {
    input: options.input ?? "",
    encoding: "utf8",
    env,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A temp CLAUDE_CONFIG_DIR per test, with helpers to read and write its JSON files. */
export function useTempClaudeDir(): {
  dir: () => string;
  env: () => Record<string, string>;
  write: (file: string, content: string) => void;
  read: (file: string) => string;
  readJson: (file: string) => unknown;
} {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "statusbar-cli-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  return {
    dir: () => dir,
    env: () => ({ CLAUDE_CONFIG_DIR: dir }),
    write: (file, content) => writeFileSync(join(dir, file), content),
    read: (file) => readFileSync(join(dir, file), "utf8"),
    readJson: (file) => JSON.parse(readFileSync(join(dir, file), "utf8")),
  };
}
