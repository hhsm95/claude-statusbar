import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fiveHourSegment } from "../../src/segments/five-hour.ts";
import { sevenDaySegment } from "../../src/segments/seven-day.ts";
import { fg, makeContext, NOW_SEC, piecesText } from "../helpers.ts";

const HOUR = 3600;
const DAY = 86400;
const limits = (key: string, window: Record<string, unknown>): unknown => ({
  rate_limits: { [key]: window },
});

describe("five-hour segment", () => {
  test("warning level with a near reset", () => {
    const resetsAt = NOW_SEC + 3 * HOUR; // 15:00 UTC
    const ctx = makeContext(limits("five_hour", { used_percentage: 74, resets_at: resetsAt }));
    assert.equal(
      piecesText(fiveHourSegment.render(ctx)),
      `5h ${fg(214, "▓▓▓▓▓▓▓░░░")} ${fg(214, "74%")} ${fg(244, "↺15:00")}`,
    );
  });

  test("rounded value drives the color", () => {
    const ctx = makeContext(limits("five_hour", { used_percentage: 69.6 }));
    assert.equal(
      piecesText(fiveHourSegment.render(ctx)),
      `5h ${fg(214, "▓▓▓▓▓▓▓░░░")} ${fg(214, "70%")}`,
    );
  });

  test("the bar uses the raw percentage, not the rounded printed one", () => {
    const ctx = makeContext(limits("five_hour", { used_percentage: 74.6 }));
    assert.equal(
      piecesText(fiveHourSegment.render(ctx)),
      `5h ${fg(214, "▓▓▓▓▓▓▓░░░")} ${fg(214, "75%")}`,
    );
  });

  test("the bar rounds to nearest, not down (79 -> 8 cells)", () => {
    const ctx = makeContext(limits("five_hour", { used_percentage: 79 }));
    assert.equal(
      piecesText(fiveHourSegment.render(ctx)),
      `5h ${fg(214, "▓▓▓▓▓▓▓▓░░")} ${fg(214, "79%")}`,
    );
  });

  test("a window that resets exactly now is expired", () => {
    const ctx = makeContext(limits("five_hour", { used_percentage: 80, resets_at: NOW_SEC }));
    assert.equal(
      piecesText(fiveHourSegment.render(ctx)),
      `5h ${fg(22, "░░░░░░░░░░")} ${fg(22, "0%")}`,
    );
  });

  test("green below 70 and red from 90", () => {
    const green = makeContext(limits("five_hour", { used_percentage: 69.4 }));
    assert.match(piecesText(fiveHourSegment.render(green)) ?? "", /38;5;22m69%/);
    const red = makeContext(limits("five_hour", { used_percentage: 90 }));
    assert.match(piecesText(fiveHourSegment.render(red)) ?? "", /38;5;196m90%/);
  });

  test("clamps the percentage to 0-100", () => {
    const high = makeContext(limits("five_hour", { used_percentage: 250 }));
    assert.equal(
      piecesText(fiveHourSegment.render(high)),
      `5h ${fg(196, "▓▓▓▓▓▓▓▓▓▓")} ${fg(196, "100%")}`,
    );
    const low = makeContext(limits("five_hour", { used_percentage: -5 }));
    assert.equal(
      piecesText(fiveHourSegment.render(low)),
      `5h ${fg(22, "░░░░░░░░░░")} ${fg(22, "0%")}`,
    );
  });

  test("expired window renders as 0% green with no reset mark", () => {
    const ctx = makeContext(
      limits("five_hour", { used_percentage: 95, resets_at: NOW_SEC - HOUR }),
    );
    assert.equal(
      piecesText(fiveHourSegment.render(ctx)),
      `5h ${fg(22, "░░░░░░░░░░")} ${fg(22, "0%")}`,
    );
  });

  test("window without used_percentage is hidden even with resets_at", () => {
    const ctx = makeContext(limits("five_hour", { resets_at: NOW_SEC + HOUR }));
    assert.equal(piecesText(fiveHourSegment.render(ctx)), null);
  });

  test("hidden when rate_limits is absent", () => {
    assert.equal(piecesText(fiveHourSegment.render(makeContext({}))), null);
  });
});

describe("window pieces", () => {
  test("only the progress bar is droppable", () => {
    const ctx = makeContext(
      limits("five_hour", { used_percentage: 74, resets_at: NOW_SEC + 3 * HOUR }),
    );
    const kinds = (fiveHourSegment.render(ctx) ?? []).map((piece) => piece.kind);
    assert.deepEqual(kinds, ["fixed", "bar", "fixed", "fixed"]);
  });
});

describe("seven-day segment", () => {
  test("far reset shows day and month", () => {
    const resetsAt = Date.UTC(2026, 10, 23, 7, 59) / 1000; // 3 days ahead, 23 Nov
    const ctx = makeContext(limits("seven_day", { used_percentage: 10, resets_at: resetsAt }));
    assert.ok(resetsAt - NOW_SEC >= DAY);
    assert.match(piecesText(sevenDaySegment.render(ctx)) ?? "", /↺23 Nov 07:59/);
  });

  test("uses the 7d label and is hidden without data", () => {
    const ctx = makeContext(limits("seven_day", { used_percentage: 10 }));
    assert.ok(piecesText(sevenDaySegment.render(ctx))?.startsWith("7d "));
    assert.equal(piecesText(sevenDaySegment.render(makeContext({}))), null);
  });
});
