#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { claudeDir, loadConfig } from "./config.ts";
import { CLI, MAX_STDIN_BYTES, STRINGS } from "./constants.ts";
import { createAnsi, isColorDisabled } from "./format/ansi.ts";
import { runGit } from "./git.ts";
import { parseStatusInput } from "./input.ts";
import { parseColumns } from "./layout.ts";
import { meetsMinimumNode } from "./node-version.ts";
import { render } from "./render.ts";
import { saveSnapshot } from "./snapshot.ts";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of process.stdin) {
      const buffer = Buffer.from(chunk as Uint8Array);
      size += buffer.length;
      if (size > MAX_STDIN_BYTES) break;
      chunks.push(buffer);
    }
  } catch {
    // A broken pipe still renders whatever arrived.
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Never throws: any failure degrades to the dim `no data` line. */
async function renderFromStdin(): Promise<string> {
  const ansi = createAnsi(!isColorDisabled(process.env));
  try {
    const dir = claudeDir(process.env);
    const raw = await readStdin();
    const input = parseStatusInput(raw);
    const now = new Date();
    const ctx = { input, now, claudeDir: dir, ansi, runGit };
    const line = render(loadConfig(dir), ctx, { columns: parseColumns(process.env) });
    try {
      saveSnapshot(dir, raw, now);
    } catch {
      // The snapshot is a side channel for `details`; it never affects the line.
    }
    return line;
  } catch {
    return `${ansi.dim(STRINGS.noData)}\n`;
  }
}

function packageVersion(): string {
  const path = new URL(`../${CLI.packageFile}`, import.meta.url);
  const pkg: unknown = JSON.parse(readFileSync(path, "utf8"));
  const version = (pkg as { version?: unknown }).version;
  return typeof version === "string" ? version : "unknown";
}

const io = {
  out: (text: string): void => void process.stdout.write(text),
  err: (text: string): void => void process.stderr.write(text),
};

async function main(args: readonly string[]): Promise<number> {
  const [first, ...rest] = args;
  if (first === undefined) {
    process.stdout.write(await renderFromStdin());
    return 0;
  }
  if ((CLI.helpFlags as readonly string[]).includes(first)) {
    io.out(`${CLI.usage}\n`);
    return 0;
  }
  if ((CLI.versionFlags as readonly string[]).includes(first)) {
    io.out(`${packageVersion()}\n`);
    return 0;
  }
  if (first === CLI.commands.init) {
    if (!meetsMinimumNode(process.version, CLI.initMinNode)) {
      io.err(`${CLI.nodeTooOld(process.version)}\n`);
      return 1;
    }
    const { runInit } = await import("./commands/init.ts");
    const options = { yes: rest.includes(CLI.yesFlag), interactive: process.stdin.isTTY === true };
    return runInit(process.env, options, io);
  }
  if (first === CLI.commands.uninstall) {
    const { runUninstall } = await import("./commands/uninstall.ts");
    return runUninstall(process.env, io);
  }
  if (first === CLI.commands.details) {
    const { runDetails } = await import("./commands/details.ts");
    return runDetails(process.env, io);
  }
  io.err(`${CLI.unknownCommand(first)}\n${CLI.usage}\n`);
  return 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    io.err(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
