import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { isSafeSessionId, saveSnapshot, snapshotPath } from "../src/snapshot.ts";

const NOW = new Date("2026-06-15T12:00:00Z");
const DAY_SEC = 86_400;

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statusbar-snapshot-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function snapshotsDir(): string {
  return join(dir, "statusbar", "snapshots");
}

function ageFile(path: string, days: number): void {
  const when = NOW.getTime() / 1000 - days * DAY_SEC;
  utimesSync(path, when, when);
}

function plantFile(name: string, days: number): string {
  mkdirSync(snapshotsDir(), { recursive: true });
  const path = join(snapshotsDir(), name);
  writeFileSync(path, "{}");
  ageFile(path, days);
  return path;
}

describe("isSafeSessionId", () => {
  test("accepts letters, digits, dash and underscore up to 128 chars", () => {
    assert.equal(isSafeSessionId("abc-123_X"), true);
    assert.equal(isSafeSessionId("a".repeat(128)), true);
  });

  test("rejects empty, too long, traversal and non-strings", () => {
    assert.equal(isSafeSessionId(""), false);
    assert.equal(isSafeSessionId("a".repeat(129)), false);
    assert.equal(isSafeSessionId("../../settings"), false);
    assert.equal(isSafeSessionId("a/b"), false);
    assert.equal(isSafeSessionId(undefined), false);
    assert.equal(isSafeSessionId(42), false);
  });
});

describe("saveSnapshot", () => {
  test("writes the stdin object at snapshots/<session_id>.json", () => {
    const raw = '{"session_id":"abc-123","model":{"display_name":"Opus 5.5"}}';
    saveSnapshot(dir, raw, NOW);
    const saved = JSON.parse(readFileSync(snapshotPath(dir, "abc-123"), "utf8"));
    assert.deepEqual(saved, JSON.parse(raw));
  });

  test("an unsafe session id writes nothing", () => {
    saveSnapshot(dir, '{"session_id":"../../settings"}', NOW);
    assert.equal(existsSync(join(dir, "statusbar")), false);
    assert.equal(existsSync(join(dir, "..", "..", "settings.json")), false);
  });

  test("a missing session id writes nothing", () => {
    saveSnapshot(dir, '{"model":{}}', NOW);
    assert.equal(existsSync(join(dir, "statusbar")), false);
  });

  test("non-object JSON and invalid JSON write nothing", () => {
    saveSnapshot(dir, '["abc"]', NOW);
    saveSnapshot(dir, '"abc"', NOW);
    saveSnapshot(dir, "not json", NOW);
    assert.equal(existsSync(join(dir, "statusbar")), false);
  });

  test("a repeat render replaces the previous snapshot", () => {
    saveSnapshot(dir, '{"session_id":"s1","n":1}', NOW);
    saveSnapshot(dir, '{"session_id":"s1","n":2}', NOW);
    const saved = JSON.parse(readFileSync(snapshotPath(dir, "s1"), "utf8"));
    assert.equal(saved.n, 2);
  });
});

describe("snapshot pruning", () => {
  test("a new session deletes snapshots older than 7 days and keeps recent ones", () => {
    const old = plantFile("old.json", 8);
    const recent = plantFile("recent.json", 1);
    saveSnapshot(dir, '{"session_id":"fresh"}', NOW);
    assert.equal(existsSync(old), false);
    assert.equal(existsSync(recent), true);
    assert.equal(existsSync(snapshotPath(dir, "fresh")), true);
  });

  test("the retention boundary is 7 days", () => {
    const inside = plantFile("inside.json", 6.9);
    const outside = plantFile("outside.json", 7.1);
    saveSnapshot(dir, '{"session_id":"fresh"}', NOW);
    assert.equal(existsSync(inside), true);
    assert.equal(existsSync(outside), false);
  });

  test("stale temp files are pruned too, fresh ones and other files are kept", () => {
    const staleTemp = plantFile(".s.1.1.tmp", 8);
    const freshTemp = plantFile(".s.2.2.tmp", 1);
    const other = plantFile("notes.txt", 30);
    const notOurTemp = plantFile("user.tmp", 30);
    saveSnapshot(dir, '{"session_id":"fresh"}', NOW);
    assert.equal(existsSync(staleTemp), false);
    assert.equal(existsSync(freshTemp), true);
    assert.equal(existsSync(other), true);
    assert.equal(existsSync(notOurTemp), true);
  });

  test("a repeat render of an existing session does not prune", () => {
    saveSnapshot(dir, '{"session_id":"s1"}', NOW);
    const old = plantFile("old.json", 8);
    saveSnapshot(dir, '{"session_id":"s1"}', NOW);
    assert.equal(existsSync(old), true);
    assert.deepEqual(readdirSync(snapshotsDir()).sort(), ["old.json", "s1.json"]);
  });

  test("an old entry that cannot be removed does not stop the rest", () => {
    const stuck = join(snapshotsDir(), "a-stuck.json");
    mkdirSync(stuck, { recursive: true });
    ageFile(stuck, 30);
    const old = plantFile("z-old.json", 30);
    assert.doesNotThrow(() => saveSnapshot(dir, '{"session_id":"fresh"}', NOW));
    assert.equal(existsSync(stuck), true);
    assert.equal(existsSync(old), false);
  });
});
