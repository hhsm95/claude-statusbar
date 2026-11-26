import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseStatusInput } from "../src/input.ts";

const FULL = JSON.stringify({
  model: { display_name: "Opus 5.5" },
  effort: { level: "high" },
  session_id: "abc",
  workspace: { current_dir: "/work/repo" },
  cwd: "/other",
  transcript_path: "/t/s.jsonl",
  context_window: {
    total_input_tokens: 150000,
    total_output_tokens: 13000,
    context_window_size: 200000,
    used_percentage: 42,
  },
  rate_limits: {
    five_hour: { used_percentage: 74, resets_at: 1700000000 },
    seven_day: { used_percentage: 12.5, resets_at: 1700500000 },
  },
});

describe("parseStatusInput", () => {
  test("reads a full document", () => {
    assert.deepEqual(parseStatusInput(FULL), {
      modelName: "Opus 5.5",
      effortLevel: "high",
      sessionId: "abc",
      currentDir: "/work/repo",
      transcriptPath: "/t/s.jsonl",
      context: { inputTokens: 150000, outputTokens: 13000, size: 200000, usedPct: 42 },
      fiveHour: { usedPct: 74, resetsAt: 1700000000 },
      sevenDay: { usedPct: 12.5, resetsAt: 1700500000 },
    });
  });

  test("empty and invalid JSON give an empty input", () => {
    for (const raw of ["", "not json", "{oops", "null", "[]", "42", '"x"']) {
      const input = parseStatusInput(raw);
      assert.equal(input.modelName, undefined, raw);
      assert.equal(input.context.size, undefined, raw);
      assert.equal(input.fiveHour.usedPct, undefined, raw);
    }
  });

  test("wrong types are treated as missing", () => {
    const input = parseStatusInput(
      JSON.stringify({
        model: { display_name: 5 },
        effort: "high",
        context_window: {
          total_input_tokens: "abc",
          total_output_tokens: {},
          context_window_size: 200000,
        },
        rate_limits: { five_hour: { used_percentage: [1], resets_at: true } },
      }),
    );
    assert.equal(input.modelName, undefined);
    assert.equal(input.effortLevel, undefined);
    assert.equal(input.context.inputTokens, undefined);
    assert.equal(input.context.outputTokens, undefined);
    assert.equal(input.context.size, 200000);
    assert.equal(input.fiveHour.usedPct, undefined);
    assert.equal(input.fiveHour.resetsAt, undefined);
  });

  test("numeric strings are read as numbers", () => {
    const input = parseStatusInput(
      JSON.stringify({
        context_window: { total_input_tokens: "150000", used_percentage: " 7.5 " },
      }),
    );
    assert.equal(input.context.inputTokens, 150000);
    assert.equal(input.context.usedPct, 7.5);
  });

  test("empty strings and non-finite numbers are missing", () => {
    const input = parseStatusInput(
      JSON.stringify({
        model: { display_name: "" },
        context_window: { total_input_tokens: "", context_window_size: "Infinity" },
      }),
    );
    assert.equal(input.modelName, undefined);
    assert.equal(input.context.inputTokens, undefined);
    assert.equal(input.context.size, undefined);
  });

  test("reads cost.total_cost_usd as a finite, non-negative number", () => {
    const cost = (value: unknown) =>
      parseStatusInput(JSON.stringify({ cost: { total_cost_usd: value } })).costUsd;
    assert.equal(cost(3.4219), 3.4219);
    assert.equal(cost(0), 0);
    assert.equal(cost("1.5"), 1.5);
    for (const bad of [-0.01, "abc", {}, null, true]) {
      assert.equal(cost(bad), undefined, String(bad));
    }
    assert.equal(parseStatusInput("{}").costUsd, undefined);
  });

  test("currentDir falls back to cwd", () => {
    assert.equal(parseStatusInput(JSON.stringify({ cwd: "/c" })).currentDir, "/c");
    assert.equal(
      parseStatusInput(JSON.stringify({ workspace: { current_dir: 3 }, cwd: "/c" })).currentDir,
      "/c",
    );
  });

  test("reads transcript_path, treating non-strings and empty strings as missing", () => {
    const path = "/home/u/.claude/projects/p/s.jsonl";
    assert.equal(parseStatusInput(JSON.stringify({ transcript_path: path })).transcriptPath, path);
    for (const value of [undefined, "", 7, {}]) {
      const raw = JSON.stringify({ transcript_path: value });
      assert.equal(parseStatusInput(raw).transcriptPath, undefined, raw);
    }
  });
});
