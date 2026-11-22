import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatReset } from "../../src/format/time.ts";

const NOW_SEC = Date.UTC(2026, 10, 15, 12, 0, 0) / 1000;
const now = new Date(NOW_SEC * 1000);

describe("formatReset", () => {
  test("under 24h shows HH:MM", () => {
    assert.equal(formatReset(NOW_SEC + 3 * 3600 + 59 * 60, now), "15:59");
  });

  test("pads hours and minutes", () => {
    assert.equal(formatReset(NOW_SEC + 21 * 3600 + 5 * 60, now), "09:05");
  });

  test("exactly 24h ahead uses the date form", () => {
    assert.equal(formatReset(NOW_SEC + 86400, now), "16 Nov 12:00");
  });

  test("just under 24h uses HH:MM", () => {
    assert.equal(formatReset(NOW_SEC + 86399, now), "11:59");
  });

  test("3 days ahead shows day, English month and time", () => {
    const at = Date.UTC(2026, 10, 18, 7, 59, 0) / 1000;
    assert.equal(formatReset(at, now), "18 Nov 07:59");
  });

  test("covers every month name", () => {
    const names = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    for (const [month, name] of names.entries()) {
      const at = Date.UTC(2027, month, 5, 1, 2, 0) / 1000;
      assert.equal(formatReset(at, new Date(Date.UTC(2026, 0, 1))), `05 ${name} 01:02`);
    }
  });
});
