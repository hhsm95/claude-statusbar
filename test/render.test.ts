import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultConfig } from "../src/config.ts";
import { render } from "../src/render.ts";
import type { Segment } from "../src/segments/types.ts";
import { fg, makeContext } from "./helpers.ts";

const fake = (id: Segment["id"], text: string | null): Segment => ({ id, render: () => text });
const SEP = ` ${fg(244, "│")} `;

describe("render", () => {
  const ctx = makeContext({});

  test("joins non-empty segments in order with a dim separator and a trailing newline", () => {
    const out = render(defaultConfig(), ctx, [
      fake("model", "A"),
      fake("effort", null),
      fake("git", "B"),
      fake("context", "C"),
    ]);
    assert.equal(out, `A${SEP}B${SEP}C\n`);
  });

  test("prints a dim 'no data' when nothing renders", () => {
    assert.equal(render(defaultConfig(), ctx, [fake("model", null)]), `${fg(244, "no data")}\n`);
  });

  test("does not call render on disabled segments", () => {
    let calls = 0;
    const counting: Segment = {
      id: "git",
      render: () => {
        calls += 1;
        return "x";
      },
    };
    const config = defaultConfig();
    config.segments.git = false;
    const out = render(config, ctx, [counting]);
    assert.equal(calls, 0);
    assert.equal(out, `${fg(244, "no data")}\n`);
  });

  test("a throwing segment is skipped", () => {
    const boom: Segment = {
      id: "model",
      render: () => {
        throw new Error("boom");
      },
    };
    assert.equal(render(defaultConfig(), ctx, [boom, fake("effort", "ok")]), "ok\n");
  });
});
