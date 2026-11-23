import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
  claudeDir,
  configPath,
  defaultConfig,
  loadConfig,
  settingsPath,
  writeConfig,
} from "../src/config.ts";
import { SEGMENT_IDS } from "../src/constants.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statusbar-config-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const write = (content: string): void => writeFileSync(configPath(dir), content);

describe("claudeDir", () => {
  test("uses CLAUDE_CONFIG_DIR when set", () => {
    assert.equal(claudeDir({ CLAUDE_CONFIG_DIR: "/tmp/cc" }), "/tmp/cc");
    assert.equal(configPath("/tmp/cc"), join("/tmp/cc", "statusbar.json"));
    assert.equal(settingsPath("/tmp/cc"), join("/tmp/cc", "settings.json"));
  });

  test("falls back to <home>/.claude when unset or empty", () => {
    assert.equal(claudeDir({}), join(homedir(), ".claude"));
    assert.equal(claudeDir({ CLAUDE_CONFIG_DIR: "" }), join(homedir(), ".claude"));
  });
});

describe("loadConfig", () => {
  test("defaults enable every segment", () => {
    const config = defaultConfig();
    for (const id of SEGMENT_IDS) assert.equal(config.segments[id], true);
  });

  test("missing file gives defaults", () => {
    assert.deepEqual(loadConfig(dir), defaultConfig());
  });

  test("corrupt JSON and non-object roots give defaults", () => {
    for (const raw of ["{oops", "[]", "null", "5", '"x"']) {
      write(raw);
      assert.deepEqual(loadConfig(dir), defaultConfig(), raw);
    }
  });

  test("git disabled leaves the rest enabled", () => {
    write('{"segments":{"git":false}}');
    const config = loadConfig(dir);
    assert.equal(config.segments.git, false);
    assert.equal(config.segments.model, true);
  });

  test("cache segment can be toggled and defaults to enabled", () => {
    assert.equal(loadConfig(dir).segments.cache, true);
    write('{"segments":{"cache":false}}');
    assert.equal(loadConfig(dir).segments.cache, false);
  });

  test("unknown ids are ignored and non-boolean toggles count as missing", () => {
    write('{"segments":{"weather":true,"model":false,"effort":"no","context":0}}');
    const config = loadConfig(dir);
    assert.equal(config.segments.model, false);
    assert.equal(config.segments.effort, true);
    assert.equal(config.segments.context, true);
    assert.equal("weather" in config.segments, false);
  });

  test("segments of the wrong type fall back to defaults", () => {
    write('{"segments":[1,2]}');
    assert.deepEqual(loadConfig(dir), defaultConfig());
  });

  test("keeps previousStatusLine of any type", () => {
    write('{"previousStatusLine":{"type":"command","command":"x"}}');
    assert.deepEqual(loadConfig(dir).previousStatusLine, { type: "command", command: "x" });
    write('{"previousStatusLine":"nope"}');
    assert.equal(loadConfig(dir).previousStatusLine, "nope");
    write("{}");
    assert.equal(loadConfig(dir).previousStatusLine, undefined);
  });
});

describe("writeConfig", () => {
  test("round-trips and leaves no temp files", () => {
    const config = defaultConfig();
    config.segments.git = false;
    config.previousStatusLine = { type: "command", command: "old.sh" };
    writeConfig(dir, config);
    assert.deepEqual(loadConfig(dir), config);
    assert.ok(readFileSync(configPath(dir), "utf8").endsWith("}\n"));
    assert.deepEqual(readdirSync(dir), ["statusbar.json"]);
  });

  test("creates the directory when missing", () => {
    const nested = join(dir, "a", "b");
    writeConfig(nested, defaultConfig());
    assert.deepEqual(loadConfig(nested), defaultConfig());
  });
});
