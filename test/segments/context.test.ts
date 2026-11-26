import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { contextSegment } from "../../src/segments/context.ts";
import { fg, makeContext, piecesText } from "../helpers.ts";

const ctxWith = (window: Record<string, unknown>) => makeContext({ context_window: window });

describe("context segment", () => {
  test("token counts, orange from 80%", () => {
    const ctx = ctxWith({
      total_input_tokens: 150000,
      total_output_tokens: 13000,
      context_window_size: 200000,
    });
    assert.equal(piecesText(contextSegment.render(ctx)), fg(214, "163K/200K"));
  });

  test("dim below 80%, red from 90%", () => {
    const low = ctxWith({ total_input_tokens: 100000, context_window_size: 200000 });
    assert.equal(piecesText(contextSegment.render(low)), fg(244, "100K/200K"));
    const high = ctxWith({ total_input_tokens: 180000, context_window_size: 200000 });
    assert.equal(piecesText(contextSegment.render(high)), fg(196, "180K/200K"));
  });

  test("boundary percentages use the rounded value", () => {
    const warn = ctxWith({ total_input_tokens: 159000, context_window_size: 200000 }); // 79.5 -> 80
    assert.match(piecesText(contextSegment.render(warn)) ?? "", /38;5;214m/);
    const justBelow = ctxWith({ total_input_tokens: 158000, context_window_size: 200000 }); // 79
    assert.match(piecesText(contextSegment.render(justBelow)) ?? "", /38;5;244m/);
  });

  test("missing output tokens count as 0", () => {
    const ctx = ctxWith({ total_input_tokens: 1500, context_window_size: 200000 });
    assert.equal(piecesText(contextSegment.render(ctx)), fg(244, "1.5K/200K"));
  });

  test("numeric strings are accepted, other types are missing", () => {
    const ok = ctxWith({ total_input_tokens: "150000", context_window_size: 200000 });
    assert.equal(piecesText(contextSegment.render(ok)), fg(244, "150K/200K"));
    const bad = ctxWith({ total_input_tokens: "abc", used_percentage: 42 });
    assert.equal(piecesText(contextSegment.render(bad)), fg(244, "ctx 42%"));
  });

  test("zero window size falls back to the percentage", () => {
    const ctx = ctxWith({ total_input_tokens: 10, context_window_size: 0, used_percentage: 10 });
    assert.equal(piecesText(contextSegment.render(ctx)), fg(244, "ctx 10%"));
  });

  test("percentage fallback rounds", () => {
    assert.equal(
      piecesText(contextSegment.render(ctxWith({ used_percentage: 41.6 }))),
      fg(244, "ctx 42%"),
    );
  });

  test("hidden with neither tokens nor percentage", () => {
    assert.equal(piecesText(contextSegment.render(makeContext({}))), null);
  });
});
