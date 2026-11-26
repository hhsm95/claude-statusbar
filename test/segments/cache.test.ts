import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
  CACHE_TTL_SECONDS,
  CACHE_WARN_SECONDS,
  COLORS,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from "../../src/constants.ts";
import { cacheSegment } from "../../src/segments/cache.ts";
import { fg, makeContext, NOW, piecesText } from "../helpers.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statusbar-cache-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const iso = (ms: number): string => new Date(ms).toISOString();

/** Writes a transcript whose last request has `remaining` seconds left of `ttl`. */
const ctxWith = (
  ttl: number,
  remainingSec: number,
  tokens = { input: 4, read: 95896, created: 316 },
) => {
  const startMs = NOW.getTime() + (remainingSec - ttl) * MS_PER_SECOND;
  const creation =
    ttl === CACHE_TTL_SECONDS.fiveMinutes
      ? { ephemeral_5m_input_tokens: 1, ephemeral_1h_input_tokens: 0 }
      : { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1 };
  const lines = [
    { type: "user", timestamp: iso(startMs) },
    {
      type: "assistant",
      timestamp: iso(startMs + MS_PER_SECOND),
      message: {
        id: "msg_1",
        usage: {
          input_tokens: tokens.input,
          cache_read_input_tokens: tokens.read,
          cache_creation_input_tokens: tokens.created,
          cache_creation: creation,
        },
      },
    },
  ];
  const path = join(dir, "t.jsonl");
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n"));
  return makeContext({ transcript_path: path });
};

const ttls = [CACHE_TTL_SECONDS.fiveMinutes, CACHE_TTL_SECONDS.oneHour];

describe("cache segment", () => {
  for (const ttl of ttls) {
    const warn = CACHE_WARN_SECONDS[ttl] as number;

    test(`ttl ${ttl}: hidden one second above the warning window`, () => {
      assert.equal(piecesText(cacheSegment.render(ctxWith(ttl, warn + 1))), null);
    });

    test(`ttl ${ttl}: warns at the edge of the window`, () => {
      const minutes = Math.floor(warn / SECONDS_PER_MINUTE);
      assert.equal(
        piecesText(cacheSegment.render(ctxWith(ttl, warn))),
        fg(COLORS.warn, `⏱ cache ${minutes}m`),
      );
    });

    test(`ttl ${ttl}: expired shows the prompt size`, () => {
      assert.equal(
        piecesText(cacheSegment.render(ctxWith(ttl, -1))),
        fg(COLORS.crit, "⚠ cache expired · 96K tok"),
      );
    });
  }

  test("rounds remaining down to whole minutes", () => {
    const ttl = CACHE_TTL_SECONDS.oneHour;
    assert.equal(
      piecesText(cacheSegment.render(ctxWith(ttl, 8 * SECONDS_PER_MINUTE + 40))),
      fg(COLORS.warn, "⏱ cache 8m"),
    );
  });

  test("shows <1m under one minute", () => {
    const ttl = CACHE_TTL_SECONDS.oneHour;
    assert.equal(piecesText(cacheSegment.render(ctxWith(ttl, 30))), fg(COLORS.warn, "⏱ cache <1m"));
  });

  test("is expired exactly at expiry", () => {
    const out = piecesText(cacheSegment.render(ctxWith(CACHE_TTL_SECONDS.oneHour, 0)));
    assert.equal(out, fg(COLORS.crit, "⚠ cache expired · 96K tok"));
  });

  test("is hidden without transcript_path", () => {
    assert.equal(piecesText(cacheSegment.render(makeContext({}))), null);
  });

  test("is hidden when the transcript is missing", () => {
    assert.equal(
      piecesText(cacheSegment.render(makeContext({ transcript_path: join(dir, "nope.jsonl") }))),
      null,
    );
  });
});
