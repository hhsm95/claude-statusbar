import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { CACHE_TTL_SECONDS, COLORS, MS_PER_SECOND } from "../../src/constants.ts";
import { cacheSegment } from "../../src/segments/cache.ts";
import { contextSegment } from "../../src/segments/context.ts";
import { effortSegment } from "../../src/segments/effort.ts";
import { fiveHourSegment } from "../../src/segments/five-hour.ts";
import { modelSegment } from "../../src/segments/model.ts";
import { SEGMENTS } from "../../src/segments/registry.ts";
import { sessionSegment } from "../../src/segments/session.ts";
import { sevenDaySegment } from "../../src/segments/seven-day.ts";
import { COLORED, fg, makeContext, NOW, NOW_SEC, PLAIN } from "../helpers.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statusbar-detail-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const plain = { ansi: PLAIN };

describe("every segment has detail rows", () => {
  test("each built-in segment implements detail", () => {
    for (const segment of SEGMENTS) {
      assert.equal(typeof segment.detail, "function", segment.id);
    }
  });
});

describe("model, effort and session rows", () => {
  test("model and effort", () => {
    assert.deepEqual(
      modelSegment.detail?.(makeContext({ model: { display_name: "Opus 5.5" } }, plain)),
      [{ label: "Model", value: "Opus 5.5" }],
    );
    assert.deepEqual(effortSegment.detail?.(makeContext({ effort: { level: "high" } }, plain)), [
      { label: "Effort", value: "high" },
    ]);
  });

  test("null without data", () => {
    assert.equal(modelSegment.detail?.(makeContext({}, plain)), null);
    assert.equal(effortSegment.detail?.(makeContext({}, plain)), null);
    assert.equal(sessionSegment.detail?.(makeContext({}, plain)), null);
  });

  const putSession = (content: unknown): void => {
    mkdirSync(join(dir, "sessions"), { recursive: true });
    writeFileSync(join(dir, "sessions", "a.json"), JSON.stringify(content));
  };
  const sessionCtx = () => makeContext({ session_id: "abc" }, { claudeDir: dir, ...plain });

  test("session with its start time", () => {
    putSession({ sessionId: "abc", name: "api-worker", startedAt: NOW.getTime() - 3 * 3600_000 });
    assert.deepEqual(sessionSegment.detail?.(sessionCtx()), [
      { label: "Session", value: "api-worker · started 09:00" },
    ]);
  });

  test("session start from an earlier day includes the date", () => {
    putSession({ sessionId: "abc", name: "w", startedAt: Date.parse("2026-11-17T09:15:00Z") });
    assert.deepEqual(sessionSegment.detail?.(sessionCtx()), [
      { label: "Session", value: "w · started 17 Nov 09:15" },
    ]);
  });

  test("session without a start time shows only the name", () => {
    putSession({ sessionId: "abc", name: "api-worker" });
    assert.deepEqual(sessionSegment.detail?.(sessionCtx()), [
      { label: "Session", value: "api-worker" },
    ]);
  });

  test("session without a name has no row", () => {
    putSession({ sessionId: "abc" });
    assert.equal(sessionSegment.detail?.(sessionCtx()), null);
  });
});

describe("window rows", () => {
  const limits = (key: string, window: Record<string, unknown>) =>
    makeContext({ rate_limits: { [key]: window } }, plain);

  test("reset in the future", () => {
    const resetsAt = NOW_SEC + 2 * 3600 + 12 * 60;
    assert.deepEqual(
      fiveHourSegment.detail?.(limits("five_hour", { used_percentage: 37, resets_at: resetsAt })),
      [{ label: "5h limit", value: "37% · resets 14:12 (in 2h 12m)" }],
    );
  });

  test("the 7d window uses the date form beyond a day", () => {
    const resetsAt = NOW_SEC + 5 * 86400 + 6 * 3600;
    assert.deepEqual(
      sevenDaySegment.detail?.(limits("seven_day", { used_percentage: 12, resets_at: resetsAt })),
      [{ label: "7d limit", value: "12% · resets 25 Nov 18:00 (in 5d 6h)" }],
    );
  });

  test("reset already passed", () => {
    assert.deepEqual(
      fiveHourSegment.detail?.(
        limits("five_hour", { used_percentage: 80, resets_at: NOW_SEC - 10 }),
      ),
      [{ label: "5h limit", value: "0% · reset passed" }],
    );
  });

  test("no reset time shows only the percentage", () => {
    assert.deepEqual(fiveHourSegment.detail?.(limits("five_hour", { used_percentage: 41.6 })), [
      { label: "5h limit", value: "42%" },
    ]);
  });

  test("null without a percentage", () => {
    assert.equal(fiveHourSegment.detail?.(limits("five_hour", {})), null);
  });

  test("the percentage keeps the line's threshold color", () => {
    const ctx = makeContext({ rate_limits: { five_hour: { used_percentage: 95 } } });
    const rows = fiveHourSegment.detail?.(ctx);
    assert.equal(rows?.[0]?.value, fg(COLORS.crit, "95%"));
  });
});

describe("context row", () => {
  const ctxWith = (window: Record<string, unknown>) =>
    makeContext({ context_window: window }, plain);

  test("full counts with input and output", () => {
    assert.deepEqual(
      contextSegment.detail?.(
        ctxWith({
          total_input_tokens: 150000,
          total_output_tokens: 13000,
          context_window_size: 200000,
        }),
      ),
      [{ label: "Context", value: "163,000 / 200,000 tokens (82%) · in 150,000 · out 13,000" }],
    );
  });

  test("output is omitted when unknown", () => {
    assert.deepEqual(
      contextSegment.detail?.(ctxWith({ total_input_tokens: 1234, context_window_size: 10000 })),
      [{ label: "Context", value: "1,234 / 10,000 tokens (12%) · in 1,234" }],
    );
  });

  test("only a percentage", () => {
    assert.deepEqual(contextSegment.detail?.(ctxWith({ used_percentage: 41.6 })), [
      { label: "Context", value: "42%" },
    ]);
  });

  test("null without data", () => {
    assert.equal(contextSegment.detail?.(ctxWith({})), null);
  });
});

describe("cache row", () => {
  const ctxWith = (ttl: number, remainingSec: number, ansi = PLAIN) => {
    const startMs = NOW.getTime() + (remainingSec - ttl) * MS_PER_SECOND;
    const creation =
      ttl === CACHE_TTL_SECONDS.fiveMinutes
        ? { ephemeral_5m_input_tokens: 1, ephemeral_1h_input_tokens: 0 }
        : { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1 };
    const lines = [
      { type: "user", timestamp: new Date(startMs).toISOString() },
      {
        type: "assistant",
        timestamp: new Date(startMs + MS_PER_SECOND).toISOString(),
        message: {
          id: "msg_1",
          usage: {
            input_tokens: 4,
            cache_read_input_tokens: 95896,
            cache_creation_input_tokens: 316,
            cache_creation: creation,
          },
        },
      },
    ];
    const path = join(dir, "t.jsonl");
    writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n"));
    return makeContext({ transcript_path: path }, { ansi });
  };

  test("warm and far from expiry is still shown", () => {
    assert.deepEqual(cacheSegment.detail?.(ctxWith(CACHE_TTL_SECONDS.oneHour, 48 * 60)), [
      { label: "Cache", value: "warm · TTL 1h · expires 12:48 (in 48m) · 96K prompt tokens" },
    ]);
  });

  test("expired", () => {
    assert.deepEqual(cacheSegment.detail?.(ctxWith(CACHE_TTL_SECONDS.fiveMinutes, -125)), [
      { label: "Cache", value: "expired 11:57 (2m 5s ago) · 96K tokens to re-cache" },
    ]);
  });

  test("warm inside the warning window is painted with the warn color", () => {
    const rows = cacheSegment.detail?.(ctxWith(CACHE_TTL_SECONDS.fiveMinutes, 30, COLORED));
    assert.ok(rows?.[0]?.value.startsWith(`\x1b[38;5;${COLORS.warn}m`));
  });

  test("warm far from expiry is not painted", () => {
    const rows = cacheSegment.detail?.(ctxWith(CACHE_TTL_SECONDS.oneHour, 48 * 60, COLORED));
    assert.equal(rows?.[0]?.value.includes("\x1b["), false);
  });

  test("expired is painted red", () => {
    const rows = cacheSegment.detail?.(ctxWith(CACHE_TTL_SECONDS.fiveMinutes, -125, COLORED));
    assert.ok(rows?.[0]?.value.startsWith(`\x1b[38;5;${COLORS.crit}m`));
  });

  test("null without a transcript", () => {
    assert.equal(cacheSegment.detail?.(makeContext({}, plain)), null);
    assert.equal(
      cacheSegment.detail?.(makeContext({ transcript_path: join(dir, "missing.jsonl") }, plain)),
      null,
    );
  });
});
