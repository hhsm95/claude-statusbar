import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
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

  test("COLUMNS from the environment shortens a long branch name", () => {
    const repo = join(claude.dir(), "repo");
    const git = (...args: string[]): void => {
      execFileSync("git", args, { cwd: claude.dir(), stdio: "ignore" });
    };
    git("init", "-q", "-b", "feature-branch-with-a-long-name", repo);
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-q",
        "--allow-empty",
        "-m",
        "c",
      ],
      { cwd: repo, stdio: "ignore" },
    );
    const input = JSON.stringify({
      model: { display_name: "Opus 5.5" },
      workspace: { current_dir: repo },
    });
    const env = { ...claude.env(), NO_COLOR: "1" };

    const narrow = runCli([], { input, env: { ...env, COLUMNS: "24" } });
    assert.equal(narrow.stdout, "Opus 5.5 │ ⎇ feature-…\n");

    for (const columns of [undefined, "abc", "200"]) {
      const whole = runCli([], { input, env: { ...env, COLUMNS: columns } });
      assert.equal(whole.stdout, "Opus 5.5 │ ⎇ feature-branch-with-a-long-name\n");
    }
  });

  test("empty NO_COLOR keeps colors", () => {
    const result = runCli([], { input: FULL_INPUT, env: { ...claude.env(), NO_COLOR: "" } });
    assert.ok(result.stdout.includes(ESC));
  });

  test("saves the stdin JSON as a session snapshot", () => {
    const input = JSON.stringify({ session_id: "abc-123", model: { display_name: "Opus 5.5" } });
    const result = runCli([], { input, env: claude.env() });
    assert.equal(result.status, 0);
    assert.deepEqual(claude.readJson("statusbar/snapshots/abc-123.json"), JSON.parse(input));
  });

  test("an unwritable snapshot dir leaves the line and exit code unchanged", () => {
    const input = JSON.stringify({ session_id: "abc-123", model: { display_name: "Opus 5.5" } });
    const expected = runCli([], { input, env: { ...claude.env(), NO_COLOR: "1" } });
    // A file where the directory should be makes the snapshot write fail.
    rmSync(join(claude.dir(), "statusbar"), { recursive: true, force: true });
    claude.write("statusbar", "not a directory");
    const result = runCli([], { input, env: { ...claude.env(), NO_COLOR: "1" } });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, expected.stdout);
    assert.match(result.stdout, /Opus 5\.5/);
    assert.equal(result.stderr, "");
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
