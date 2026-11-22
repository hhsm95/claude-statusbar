import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { runCli, useTempClaudeDir } from "./cli-helper.ts";

const claude = useTempClaudeDir();
const ESC = "\x1b[";

const FULL_INPUT = JSON.stringify({
  model: { display_name: "Opus 5.5" },
  effort: { level: "high" },
  workspace: { current_dir: "/nonexistent-dir" },
  rate_limits: { five_hour: { used_percentage: 74 } },
  context_window: { total_input_tokens: 150000, context_window_size: 200000 },
});

describe("cli render", () => {
  test("renders segments from stdin and exits 0 with a trailing newline", () => {
    const result = runCli([], { input: FULL_INPUT, env: claude.env() });
    assert.equal(result.status, 0);
    assert.ok(result.stdout.endsWith("\n"));
    assert.match(result.stdout, /Opus 5\.5/);
    assert.match(result.stdout, /5h /);
    assert.match(result.stdout, /150K\/200K/);
    assert.equal(result.stderr, "");
  });

  test("invalid JSON prints a dim 'no data' and exits 0", () => {
    const result = runCli([], { input: "not json", env: claude.env() });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${ESC}38;5;244mno data${ESC}0m\n`);
  });

  test("stdin over the size limit is cut off without crashing", () => {
    const huge = `{"model":{"display_name":"Opus"},"pad":"${"x".repeat(1_500_000)}"}`;
    const result = runCli([], { input: huge, env: claude.env() });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /no data\S*\n$/);
  });

  test("empty stdin prints 'no data' and exits 0", () => {
    const result = runCli([], { input: "", env: claude.env() });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /no data\S*\n$/);
  });

  test("honors statusbar.json: disabled segments disappear", () => {
    claude.write("statusbar.json", JSON.stringify({ segments: { model: false } }));
    const result = runCli([], { input: FULL_INPUT, env: claude.env() });
    assert.doesNotMatch(result.stdout, /Opus/);
    assert.match(result.stdout, /high/);
  });

  test("NO_COLOR removes every escape sequence", () => {
    const result = runCli([], { input: FULL_INPUT, env: { ...claude.env(), NO_COLOR: "1" } });
    assert.equal(result.status, 0);
    assert.ok(!result.stdout.includes(ESC));
    assert.match(result.stdout, /Opus 5\.5 │ high/);
  });

  test("empty NO_COLOR keeps colors", () => {
    const result = runCli([], { input: FULL_INPUT, env: { ...claude.env(), NO_COLOR: "" } });
    assert.ok(result.stdout.includes(ESC));
  });
});

describe("cli help, version and unknown commands", () => {
  test("--help and -h print usage for render and every command", () => {
    for (const flag of ["--help", "-h"]) {
      const result = runCli([flag]);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /init/);
      assert.match(result.stdout, /uninstall/);
      assert.match(result.stdout, /stdin/);
    }
  });

  test("--version and -v print the package version", () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"));
    for (const flag of ["--version", "-v"]) {
      const result = runCli([flag]);
      assert.equal(result.status, 0);
      assert.equal(result.stdout.trim(), pkg.version);
    }
  });

  test("unknown command prints usage to stderr and exits 1", () => {
    const result = runCli(["foo"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown command: foo/);
    assert.match(result.stderr, /Usage:/);
    assert.equal(result.stdout, "");
  });
});
