import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { runCli, useTempClaudeDir } from "../cli-helper.ts";

const claude = useTempClaudeDir();
const uninstall = () => runCli(["uninstall"], { env: claude.env() });
const ours = { type: "command", command: "claude-statusbar", padding: 0 };

describe("uninstall", () => {
  test("restores the previous status line and drops it from statusbar.json", () => {
    const previous = { type: "command", command: "~/.claude/statusline.sh" };
    claude.write("settings.json", JSON.stringify({ model: "opus", statusLine: ours }));
    claude.write(
      "statusbar.json",
      JSON.stringify({ segments: { git: false }, previousStatusLine: previous }),
    );
    const result = uninstall();
    assert.equal(result.status, 0);
    assert.deepEqual(claude.readJson("settings.json"), { model: "opus", statusLine: previous });
    const config = claude.readJson("statusbar.json") as Record<string, unknown>;
    assert.equal("previousStatusLine" in config, false);
    assert.equal((config.segments as Record<string, boolean>).git, false);
  });

  test("deletes statusLine when there is nothing to restore", () => {
    claude.write("settings.json", JSON.stringify({ model: "opus", statusLine: ours }));
    assert.equal(uninstall().status, 0);
    assert.deepEqual(claude.readJson("settings.json"), { model: "opus" });
  });

  test("init then uninstall round-trips a custom script", () => {
    const previous = { type: "command", command: "custom.sh" };
    claude.write("settings.json", JSON.stringify({ statusLine: previous }));
    runCli(["init", "--yes"], { env: claude.env() });
    uninstall();
    assert.deepEqual(claude.readJson("settings.json"), { statusLine: previous });
  });

  test("not installed: reports nothing to do and does not write", () => {
    const original = `${JSON.stringify({ statusLine: { type: "command", command: "other" } })}`;
    claude.write("settings.json", original);
    const result = uninstall();
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Nothing to do/);
    assert.equal(claude.read("settings.json"), original);
  });

  test("missing settings file: nothing to do, nothing created", () => {
    const result = uninstall();
    assert.equal(result.status, 0);
    assert.ok(!existsSync(join(claude.dir(), "settings.json")));
  });

  test("invalid settings abort with exit 1 and the file is untouched", () => {
    claude.write("settings.json", "{,}");
    const result = uninstall();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /settings\.json/);
    assert.equal(claude.read("settings.json"), "{,}");
  });
});
