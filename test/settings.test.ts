import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { settingsPath } from "../src/config.ts";
import { readSettings, writeSettings } from "../src/settings.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statusbar-settings-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("readSettings", () => {
  test("missing file is an empty object", () => {
    assert.deepEqual(readSettings(dir), { ok: true, settings: {} });
  });

  test("reads an object", () => {
    writeFileSync(settingsPath(dir), '{"theme":"dark"}');
    assert.deepEqual(readSettings(dir), { ok: true, settings: { theme: "dark" } });
  });

  test("invalid JSON fails", () => {
    writeFileSync(settingsPath(dir), "{oops");
    assert.deepEqual(readSettings(dir), { ok: false, reason: "invalid-json" });
  });

  test("a leading UTF-8 BOM is stripped before parsing", () => {
    writeFileSync(settingsPath(dir), '\uFEFF{"theme":"dark"}');
    assert.deepEqual(readSettings(dir), { ok: true, settings: { theme: "dark" } });
  });

  test("non-object roots fail", () => {
    for (const raw of ["[]", "null", "3", '"x"']) {
      writeFileSync(settingsPath(dir), raw);
      assert.deepEqual(readSettings(dir), { ok: false, reason: "not-an-object" }, raw);
    }
  });

  test("unreadable path fails", () => {
    mkdirSync(settingsPath(dir));
    assert.deepEqual(readSettings(dir), { ok: false, reason: "unreadable" });
  });
});

describe("writeSettings", () => {
  test("preserves other keys and their order, adds statusLine, no temp files", () => {
    writeFileSync(settingsPath(dir), '{"b":1,"a":{"x":[1,2]},"c":"z"}');
    const read = readSettings(dir);
    assert.ok(read.ok);
    writeSettings(dir, { ...read.settings, statusLine: { type: "command", command: "s" } });
    const text = readFileSync(settingsPath(dir), "utf8");
    assert.deepEqual(Object.keys(JSON.parse(text)), ["b", "a", "c", "statusLine"]);
    assert.deepEqual(JSON.parse(text).a, { x: [1, 2] });
    assert.ok(text.includes('\n  "b": 1,'));
    assert.ok(text.endsWith("}\n"));
    assert.deepEqual(readdirSync(dir), ["settings.json"]);
  });

  test("replaces statusLine in place without moving it", () => {
    writeFileSync(settingsPath(dir), '{"statusLine":{"command":"old"},"z":1}');
    const read = readSettings(dir);
    assert.ok(read.ok);
    read.settings.statusLine = { command: "new" };
    writeSettings(dir, read.settings);
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(settingsPath(dir), "utf8"))), [
      "statusLine",
      "z",
    ]);
  });
});
