import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultConfig } from "../src/config.ts";
import { render } from "../src/render.ts";
import { fixed, name, type Piece, type Segment } from "../src/segments/types.ts";
import { COLORED, fg, makeContext } from "./helpers.ts";

const plain = (s: string): string => s;
const fake = (id: Segment["id"], text: string | null): Segment => ({
  id,
  render: () => (text === null ? null : [fixed(text, plain)]),
});
const withPieces = (id: Segment["id"], pieces: readonly Piece[]): Segment => ({
  id,
  render: () => pieces,
});
const SEP = ` ${fg(244, "│")} `;

describe("render", () => {
  const ctx = makeContext({});

  test("joins non-empty segments in order with a dim separator and a trailing newline", () => {
    const out = render(defaultConfig(), ctx, {
      segments: [fake("model", "A"), fake("effort", null), fake("git", "B"), fake("context", "C")],
    });
    assert.equal(out, `A${SEP}B${SEP}C\n`);
  });

  test("prints a dim 'no data' when nothing renders", () => {
    const out = render(defaultConfig(), ctx, { segments: [fake("model", null)] });
    assert.equal(out, `${fg(244, "no data")}\n`);
  });

  test("a segment with only empty pieces counts as empty", () => {
    const out = render(defaultConfig(), ctx, {
      segments: [withPieces("model", [fixed("", plain)]), fake("effort", "ok")],
    });
    assert.equal(out, "ok\n");
  });

  test("a segment with only empty pieces counts as empty with colors on", () => {
    const colored = makeContext({}, { ansi: COLORED });
    const out = render(defaultConfig(), colored, {
      segments: [withPieces("model", [fixed("", colored.ansi.dim)]), fake("effort", "ok")],
    });
    assert.equal(out, "ok\n");
  });

  test("does not call render on disabled segments", () => {
    let calls = 0;
    const counting: Segment = {
      id: "git",
      render: () => {
        calls += 1;
        return [fixed("x", plain)];
      },
    };
    const config = defaultConfig();
    config.segments.git = false;
    const out = render(config, ctx, { segments: [counting] });
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
    const out = render(defaultConfig(), ctx, { segments: [boom, fake("effort", "ok")] });
    assert.equal(out, "ok\n");
  });

  test("a long branch is truncated when columns is small", () => {
    const git = withPieces("git", [
      name("feat/responsive-statusline-width-aware", plain, "", "⎇ "),
    ]);
    const segments = [fake("model", "Opus"), git];
    // 4 + 3 + 2 + cap, with available 25: cap 16 keeps 15 code points
    const out = render(defaultConfig(), ctx, { columns: 27, segments });
    assert.equal(out, `Opus${SEP}⎇ feat/responsive…\n`);
  });

  test("the same line is whole when columns is unknown", () => {
    const git = withPieces("git", [
      name("feat/responsive-statusline-width-aware", plain, "", "⎇ "),
    ]);
    const out = render(defaultConfig(), ctx, { segments: [fake("model", "Opus"), git] });
    assert.equal(out, `Opus${SEP}⎇ feat/responsive-statusline-width-aware\n`);
  });
});
