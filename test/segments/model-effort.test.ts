import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { effortSegment } from "../../src/segments/effort.ts";
import { modelSegment } from "../../src/segments/model.ts";
import { fg, makeContext } from "../helpers.ts";

describe("model segment", () => {
  test("prints the display name in bold", () => {
    const ctx = makeContext({ model: { display_name: "Opus 5.5" } });
    assert.equal(modelSegment.render(ctx), "\x1b[1mOpus 5.5\x1b[0m");
  });

  test("is hidden without a model", () => {
    assert.equal(modelSegment.render(makeContext({})), null);
  });
});

describe("effort segment", () => {
  test("prints the level in dim color 244", () => {
    const ctx = makeContext({ effort: { level: "high" } });
    assert.equal(effortSegment.render(ctx), fg(244, "high"));
  });

  test("is hidden without effort.level", () => {
    assert.equal(effortSegment.render(makeContext({})), null);
  });
});
