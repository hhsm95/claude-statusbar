import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { CACHE_TTL_SECONDS } from "../src/constants.ts";
import { readLastRequest } from "../src/transcript.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statusbar-transcript-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const T0 = "2026-11-20T10:00:00.000Z";
const T1 = "2026-11-20T10:00:20.000Z";
const T2 = "2026-11-20T10:01:30.000Z";
const T3 = "2026-11-20T10:01:31.000Z";
const ms = (iso: string): number => new Date(iso).getTime();

type Entry = Record<string, unknown>;

const user = (timestamp: string): Entry => ({ type: "user", timestamp });

const assistant = (
  timestamp: string,
  usage: Entry | undefined,
  extra: Entry = {},
  messageId = "msg_1",
): Entry => ({
  type: "assistant",
  timestamp,
  message: { id: messageId, ...(usage ? { usage } : {}) },
  ...extra,
});

const usage1h = {
  input_tokens: 4,
  cache_read_input_tokens: 95896,
  cache_creation_input_tokens: 316,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 316 },
};

const write = (lines: readonly string[]): string => {
  const path = join(dir, "t.jsonl");
  writeFileSync(path, `${lines.join("\n")}\n`);
  return path;
};
const writeEntries = (entries: readonly Entry[]): string =>
  write(entries.map((e) => JSON.stringify(e)));

describe("readLastRequest", () => {
  test("request split over several entries starts at the entry before the first one", () => {
    const path = writeEntries([
      user(T0),
      assistant(T1, undefined),
      assistant(T2, usage1h),
      { type: "system", timestamp: T3 },
      { type: "attachment", timestamp: T3 },
    ]);
    const result = readLastRequest(path);
    assert.equal(result?.startMs, ms(T0));
    assert.equal(result?.promptTokens, 4 + 95896 + 316);
    assert.equal(result?.ttlSec, CACHE_TTL_SECONDS.oneHour);
  });

  test("falls back to the first assistant timestamp when nothing precedes it", () => {
    const path = writeEntries([assistant(T1, usage1h)]);
    assert.equal(readLastRequest(path)?.startMs, ms(T1));
  });

  test("skips entries without a timestamp when looking back", () => {
    const path = writeEntries([user(T0), { type: "summary" }, assistant(T1, usage1h)]);
    assert.equal(readLastRequest(path)?.startMs, ms(T0));
  });

  test("ignores sidechain requests", () => {
    const path = writeEntries([
      user(T0),
      assistant(T1, usage1h, {}, "msg_main"),
      user(T2),
      assistant(T3, { input_tokens: 999 }, { isSidechain: true }, "msg_side"),
    ]);
    const result = readLastRequest(path);
    assert.equal(result?.startMs, ms(T0));
    assert.equal(result?.promptTokens, 4 + 95896 + 316);
  });

  test("detects the 5 minute TTL", () => {
    const path = writeEntries([
      user(T0),
      assistant(T1, {
        input_tokens: 1,
        cache_creation: { ephemeral_5m_input_tokens: 120, ephemeral_1h_input_tokens: 0 },
      }),
    ]);
    assert.equal(readLastRequest(path)?.ttlSec, CACHE_TTL_SECONDS.fiveMinutes);
  });

  test("the 5 minute TTL wins when a request wrote both", () => {
    const path = writeEntries([
      user(T0),
      assistant(T1, {
        input_tokens: 1,
        cache_creation: { ephemeral_5m_input_tokens: 120, ephemeral_1h_input_tokens: 300 },
      }),
    ]);
    assert.equal(readLastRequest(path)?.ttlSec, CACHE_TTL_SECONDS.fiveMinutes);
  });

  test("a pure cache read takes the TTL from an earlier request", () => {
    const pureRead = { input_tokens: 2, cache_read_input_tokens: 500 };
    const path = writeEntries([
      user(T0),
      assistant(
        T1,
        {
          cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 0 },
        },
        {},
        "msg_a",
      ),
      user(T2),
      assistant(T3, pureRead, {}, "msg_b"),
    ]);
    assert.equal(readLastRequest(path)?.ttlSec, CACHE_TTL_SECONDS.fiveMinutes);
  });

  test("defaults to 1 hour when no request decides", () => {
    const path = writeEntries([user(T0), assistant(T1, { input_tokens: 2 })]);
    assert.equal(readLastRequest(path)?.ttlSec, CACHE_TTL_SECONDS.oneHour);
  });

  test("a line cut by the tail is ignored without needing the retry", () => {
    const filler = JSON.stringify({ type: "user", timestamp: T0, text: "x".repeat(200) });
    const request = `${JSON.stringify(user(T2))}\n${JSON.stringify(assistant(T3, usage1h))}\n`;
    const path = write([filler, request.trimEnd()]);
    const tail = Buffer.byteLength(request) + 50;
    assert.equal(readLastRequest(path, tail, tail)?.startMs, ms(T2));
  });

  test("a tail starting exactly at a line boundary keeps that line", () => {
    const filler = JSON.stringify({ type: "user", timestamp: T0, text: "x".repeat(200) });
    const request = `${JSON.stringify(user(T2))}\n${JSON.stringify(assistant(T3, usage1h))}\n`;
    const path = write([filler, request.trimEnd()]);
    const tail = Buffer.byteLength(request);
    assert.equal(readLastRequest(path, tail, tail)?.startMs, ms(T2));
  });

  test("synthetic API error entries are not requests", () => {
    const zero = { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    const path = writeEntries([
      user(T0),
      assistant(T1, usage1h),
      user(T2),
      assistant(T3, zero, { isApiErrorMessage: true }, "msg_err"),
    ]);
    const result = readLastRequest(path);
    assert.equal(result?.startMs, ms(T0));
    assert.equal(result?.promptTokens, 4 + 95896 + 316);
    const synthetic = writeEntries([
      user(T0),
      assistant(T1, usage1h),
      user(T2),
      { type: "assistant", timestamp: T3, message: { id: "s", model: "<synthetic>", usage: zero } },
    ]);
    assert.equal(readLastRequest(synthetic)?.startMs, ms(T0));
  });

  test("skips invalid JSON lines", () => {
    const path = write([
      JSON.stringify(user(T0)),
      "{not json",
      "[1,2]",
      JSON.stringify(assistant(T1, usage1h)),
    ]);
    assert.equal(readLastRequest(path)?.startMs, ms(T0));
  });

  test("retries with the larger tail when the small one has no request", () => {
    const filler = { type: "user", timestamp: T3, text: "x".repeat(2000) };
    const path = writeEntries([user(T0), assistant(T1, usage1h), filler]);
    assert.equal(readLastRequest(path, 500, 100000)?.startMs, ms(T0));
    assert.equal(readLastRequest(path, 500, 600), undefined);
  });

  test("returns undefined for a missing file or no request", () => {
    assert.equal(readLastRequest(join(dir, "missing.jsonl")), undefined);
    assert.equal(readLastRequest(writeEntries([user(T0)])), undefined);
  });
});
