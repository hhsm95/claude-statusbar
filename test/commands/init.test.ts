import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { type Prompts, runInit } from "../../src/commands/init.ts";
import { SEGMENT_IDS } from "../../src/constants.ts";
import { runCli, useTempClaudeDir } from "../cli-helper.ts";

const claude = useTempClaudeDir();
const init = (...flags: string[]) => runCli(["init", ...flags], { env: claude.env() });
const allEnabled = Object.fromEntries(SEGMENT_IDS.map((id) => [id, true]));
const DEFAULT_LINE = {
  type: "command",
  command: "claude-statusbar",
  padding: 0,
  refreshInterval: 30,
};

describe("init --yes", () => {
  test("fresh machine: creates the dir, settings with only statusLine, all segments on", () => {
    const result = init("--yes");
    assert.equal(result.status, 0);
    assert.deepEqual(claude.readJson("settings.json"), { statusLine: DEFAULT_LINE });
    assert.deepEqual(claude.readJson("statusbar.json"), { segments: allEnabled });
    assert.match(result.stdout, /settings\.json/);
    assert.match(result.stdout, /statusbar\.json/);
  });

  test("preserves every other settings key and their order", () => {
    claude.write("settings.json", JSON.stringify({ model: "opus", hooks: { a: [1] }, z: true }));
    init("--yes");
    const settings = claude.readJson("settings.json") as Record<string, unknown>;
    assert.deepEqual(Object.keys(settings), ["model", "hooks", "z", "statusLine"]);
    assert.deepEqual(settings.hooks, { a: [1] });
  });

  test("replacing a custom script stores it as previousStatusLine", () => {
    const previous = { type: "command", command: "~/.claude/statusline.sh" };
    claude.write("settings.json", JSON.stringify({ statusLine: previous }));
    init("--yes");
    assert.deepEqual(claude.readJson("settings.json"), { statusLine: DEFAULT_LINE });
    assert.deepEqual(claude.readJson("statusbar.json"), {
      segments: allEnabled,
      previousStatusLine: previous,
    });
  });

  test("re-running keeps custom fields and the stored previousStatusLine", () => {
    const previous = { type: "command", command: "old.sh" };
    claude.write(
      "settings.json",
      JSON.stringify({
        statusLine: { type: "command", command: "claude-statusbar", refreshInterval: 10 },
      }),
    );
    claude.write(
      "statusbar.json",
      JSON.stringify({ segments: { ...allEnabled, git: false }, previousStatusLine: previous }),
    );
    init("--yes");
    const line = (claude.readJson("settings.json") as { statusLine: Record<string, unknown> })
      .statusLine;
    assert.deepEqual(line, { type: "command", command: "claude-statusbar", refreshInterval: 10 });
    assert.deepEqual(claude.readJson("statusbar.json"), {
      segments: { ...allEnabled, git: false },
      previousStatusLine: previous,
    });
  });

  test("non-TTY stdin skips prompts even without --yes", () => {
    const result = init();
    assert.equal(result.status, 0);
    assert.deepEqual(claude.readJson("settings.json"), { statusLine: DEFAULT_LINE });
    assert.deepEqual(claude.readJson("statusbar.json"), { segments: allEnabled });
  });

  test("corrupt settings abort with exit 1 and the file is untouched", () => {
    claude.write("settings.json", "{,}");
    const result = init("--yes");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /settings\.json/);
    assert.match(result.stderr, /not valid JSON/);
    assert.doesNotMatch(result.stderr, /invalid-json/);
    assert.equal(claude.read("settings.json"), "{,}");
    assert.ok(!existsSync(join(claude.dir(), "statusbar.json")));
  });

  test("a settings file that is not an object aborts too", () => {
    claude.write("settings.json", "[1]");
    assert.equal(init("--yes").status, 1);
    assert.equal(claude.read("settings.json"), "[1]");
  });
});

describe("init previous status line", () => {
  test("a non-object statusLine is stored as-is and restored by uninstall", () => {
    claude.write("settings.json", JSON.stringify({ statusLine: "legacy.sh" }));
    assert.equal(init("--yes").status, 0);
    assert.deepEqual(claude.readJson("statusbar.json"), {
      segments: allEnabled,
      previousStatusLine: "legacy.sh",
    });
    assert.equal(runCli(["uninstall"], { env: claude.env() }).status, 0);
    assert.deepEqual(claude.readJson("settings.json"), { statusLine: "legacy.sh" });
  });
});

describe("init write order", () => {
  test("if the config cannot be written, settings.json is unchanged", () => {
    const original = JSON.stringify({ statusLine: { type: "command", command: "old.sh" } });
    claude.write("settings.json", original);
    mkdirSync(join(claude.dir(), "statusbar.json"));
    const result = init("--yes");
    assert.equal(result.status, 1);
    assert.equal(claude.read("settings.json"), original);
  });

  test("if settings.json cannot be written, previousStatusLine is already saved", {
    skip: process.platform === "win32" || process.getuid?.() === 0,
  }, () => {
    const elsewhere = mkdtempSync(join(tmpdir(), "statusbar-ro-"));
    try {
      const target = join(elsewhere, "settings.json");
      writeFileSync(target, JSON.stringify({ statusLine: { type: "command", command: "old.sh" } }));
      symlinkSync(target, join(claude.dir(), "settings.json"));
      chmodSync(elsewhere, 0o500);
      const result = init("--yes");
      assert.equal(result.status, 1);
      assert.deepEqual(
        (claude.readJson("statusbar.json") as { previousStatusLine: unknown }).previousStatusLine,
        { type: "command", command: "old.sh" },
      );
    } finally {
      chmodSync(elsewhere, 0o700);
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });
});

describe("init interactive prompts", () => {
  const run = async (prompts: Prompts): Promise<{ status: number; out: string }> => {
    const lines: string[] = [];
    const io = { out: (t: string) => void lines.push(t), err: (t: string) => void lines.push(t) };
    const status = await runInit(claude.env(), { yes: false, interactive: true }, io, prompts);
    return { status, out: lines.join("") };
  };
  const unused = (): never => {
    throw new Error("prompt not expected");
  };
  const custom = JSON.stringify({ statusLine: { type: "command", command: "old.sh" } });

  test("declining the replacement leaves both files byte-for-byte unchanged", async () => {
    claude.write("settings.json", custom);
    claude.write("statusbar.json", '{"segments":{"git":false}}');
    let message = "";
    const result = await run({
      confirm: async (m) => {
        message = m;
        return false;
      },
      checkbox: unused,
    });
    assert.equal(result.status, 0);
    assert.match(message, /old\.sh/);
    assert.equal(claude.read("settings.json"), custom);
    assert.equal(claude.read("statusbar.json"), '{"segments":{"git":false}}');
  });

  test("confirming replaces the line and stores the previous one", async () => {
    claude.write("settings.json", custom);
    const result = await run({ confirm: async () => true, checkbox: async () => SEGMENT_IDS });
    assert.equal(result.status, 0);
    assert.deepEqual(claude.readJson("settings.json"), { statusLine: DEFAULT_LINE });
    assert.deepEqual(
      (claude.readJson("statusbar.json") as { previousStatusLine: unknown }).previousStatusLine,
      { type: "command", command: "old.sh" },
    );
  });

  test("a non-string command is shown as JSON in the confirm prompt", async () => {
    claude.write("settings.json", JSON.stringify({ statusLine: 42 }));
    let message = "";
    await run({
      confirm: async (m) => {
        message = m;
        return false;
      },
      checkbox: unused,
    });
    assert.match(message, /\(42\)/);
  });

  test("the checkbox selection is written to statusbar.json", async () => {
    const result = await run({ confirm: unused, checkbox: async () => ["model", "git"] });
    assert.equal(result.status, 0);
    const expected = Object.fromEntries(
      SEGMENT_IDS.map((id) => [id, id === "model" || id === "git"]),
    );
    assert.deepEqual(claude.readJson("statusbar.json"), { segments: expected });
  });
});
