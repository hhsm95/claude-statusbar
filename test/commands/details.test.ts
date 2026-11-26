import assert from "node:assert/strict";
import { chmodSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, test } from "node:test";
import { formatDetails, runDetails } from "../../src/commands/details.ts";
import { snapshotPath } from "../../src/snapshot.ts";
import { runCli, useTempClaudeDir } from "../cli-helper.ts";
import { COLORED, NOW, PLAIN } from "../helpers.ts";

const claude = useTempClaudeDir();
const SESSION = "abc-123";

function collectIo(): { out: string[]; err: string[]; io: Parameters<typeof runDetails>[1] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { out: (t) => out.push(t), err: (t) => err.push(t) } };
}

function writeSnapshot(content: string, ageSec = 5): void {
  const path = snapshotPath(claude.dir(), SESSION);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  const mtime = new Date(NOW.getTime() - ageSec * 1000);
  utimesSync(path, mtime, mtime);
}

function run(env: Record<string, string | undefined> = {}) {
  const sink = collectIo();
  const code = runDetails(
    { CLAUDE_CONFIG_DIR: claude.dir(), CLAUDE_CODE_SESSION_ID: SESSION, NO_COLOR: "1", ...env },
    sink.io,
    NOW,
  );
  return { code, out: sink.out.join(""), err: sink.err.join("") };
}

describe("formatDetails", () => {
  test("prints the header, then rows with labels padded to the longest", () => {
    const text = formatDetails(
      [
        { label: "Model", value: "Opus" },
        { label: "5h limit", value: "10%" },
      ],
      132,
      PLAIN,
    );
    assert.equal(
      text,
      "claude-statusbar details · updated 2m 12s ago\nModel    Opus\n5h limit 10%\n",
    );
  });

  test("dims the labels but not the values when color is on", () => {
    const text = formatDetails([{ label: "Model", value: "Opus" }], 0, COLORED);
    assert.ok(text.includes(`${COLORED.dim("Model")} Opus\n`));
  });

  test("prints the header and a dim 'no data' when there are no rows", () => {
    assert.equal(
      formatDetails([], 4, COLORED),
      `claude-statusbar details · updated 4s ago\n${COLORED.dim("no data")}\n`,
    );
  });
});

describe("runDetails", () => {
  test("prints segment rows, the cost row last, and exits 0", () => {
    writeSnapshot(
      JSON.stringify({ model: { display_name: "Opus 5.5" }, cost: { total_cost_usd: 3.4219 } }),
    );
    const { code, out, err } = run();
    assert.equal(code, 0);
    assert.equal(err, "");
    const lines = out.split("\n");
    assert.equal(lines[0], "claude-statusbar details · updated 5s ago");
    assert.equal(lines[1], "Model Opus 5.5");
    assert.equal(lines[2], "Cost  $3.42");
    assert.equal(out.endsWith("\n"), true);
  });

  test("skips segments disabled in statusbar.json but keeps the cost row", () => {
    writeSnapshot(
      JSON.stringify({ model: { display_name: "Opus 5.5" }, cost: { total_cost_usd: 1 } }),
    );
    claude.write("statusbar.json", JSON.stringify({ segments: { model: false } }));
    const { out } = run();
    assert.ok(!out.includes("Model"));
    assert.ok(out.includes("Cost $1.00"));
  });

  test("omits the cost row without a valid cost", () => {
    writeSnapshot(
      JSON.stringify({ model: { display_name: "Opus" }, cost: { total_cost_usd: -1 } }),
    );
    assert.ok(!run().out.includes("Cost"));
  });

  test("only the header and 'no data' when nothing has data", () => {
    writeSnapshot("{}");
    const { code, out } = run();
    assert.equal(code, 0);
    assert.equal(out, "claude-statusbar details · updated 5s ago\nno data\n");
  });

  test("a segment whose detail throws contributes nothing", () => {
    writeSnapshot(JSON.stringify({ model: { display_name: "Opus" } }));
    const sink = collectIo();
    const code = runDetails(
      { CLAUDE_CONFIG_DIR: claude.dir(), CLAUDE_CODE_SESSION_ID: SESSION, NO_COLOR: "1" },
      sink.io,
      NOW,
      [
        {
          id: "effort",
          render: () => null,
          detail: () => {
            throw new Error("boom");
          },
        },
      ],
    );
    assert.equal(code, 0);
    assert.equal(sink.out.join(""), "claude-statusbar details · updated 5s ago\nno data\n");
  });

  for (const id of [undefined, "", "../evil"]) {
    test(`session id ${JSON.stringify(id)} fails with one stderr line and exit 1`, () => {
      const { code, out, err } = run({ CLAUDE_CODE_SESSION_ID: id });
      assert.equal(code, 1);
      assert.equal(out, "");
      assert.match(err, /! claude-statusbar details/);
      assert.equal(err.split("\n").length, 2);
    });
  }

  test("a missing snapshot fails with exit 1", () => {
    const { code, out, err } = run();
    assert.equal(code, 1);
    assert.equal(out, "");
    assert.match(err, /No status data/);
  });

  test("a snapshot that is not a JSON object fails with exit 1", () => {
    writeSnapshot("[1,2]");
    const { code, err } = run();
    assert.equal(code, 1);
    assert.match(err, /No status data/);
  });

  test("an unparseable snapshot fails with exit 1", () => {
    writeSnapshot("not json");
    assert.equal(run().code, 1);
  });
});

describe("details via the CLI", () => {
  test("exits 1 with a stderr message without CLAUDE_CODE_SESSION_ID", () => {
    const result = runCli(["details"], {
      env: { ...claude.env(), CLAUDE_CODE_SESSION_ID: undefined },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /! claude-statusbar details/);
  });

  test("prints the snapshot written by a render", () => {
    const env = { ...claude.env(), NO_COLOR: "1", CLAUDE_CODE_SESSION_ID: SESSION };
    const input = JSON.stringify({ session_id: SESSION, model: { display_name: "Opus 5.5" } });
    assert.equal(runCli([], { input, env }).status, 0);
    const result = runCli(["details"], { env });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^claude-statusbar details · updated \d+s ago\nModel Opus 5\.5\n$/);
  });
});

describe("runDetails quota across sessions", () => {
  const nowSec = NOW.getTime() / 1000;
  const SOON = nowSec + 2 * 3600;
  const LATER = nowSec + 5 * 24 * 3600;

  interface Window {
    pct: number;
    reset: number;
  }

  function snapshot(five?: Window, seven?: Window): string {
    const limit = (w: Window) => ({ used_percentage: w.pct, resets_at: w.reset });
    const rateLimits = {
      ...(five && { five_hour: limit(five) }),
      ...(seven && { seven_day: limit(seven) }),
    };
    return JSON.stringify({ model: { display_name: "Opus" }, rate_limits: rateLimits });
  }

  function writeSibling(id: string, content: string): void {
    const path = snapshotPath(claude.dir(), id);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }

  function row(out: string, label: string): string | undefined {
    return out.split("\n").find((line) => line.startsWith(label));
  }

  test("a stale session shows the higher usage of a sibling with the same reset", () => {
    writeSnapshot(snapshot({ pct: 48, reset: SOON }));
    writeSibling("other", snapshot({ pct: 78, reset: SOON }));
    assert.match(row(run().out, "5h limit") ?? "", /78% · resets/);
  });

  test("a newer window wins over a higher, older one", () => {
    writeSnapshot(snapshot({ pct: 95, reset: SOON - 6 * 3600 }));
    writeSibling("other", snapshot({ pct: 10, reset: SOON }));
    // NOW is 12:00 UTC and setup.ts forces TZ=UTC, so SOON prints as 14:00.
    assert.match(row(run().out, "5h limit") ?? "", /10% · resets 14:00 /);
  });

  test("5h and 7d are chosen independently", () => {
    writeSnapshot(snapshot({ pct: 20, reset: SOON }, { pct: 30, reset: LATER }));
    writeSibling("a", snapshot({ pct: 60, reset: SOON }, { pct: 5, reset: LATER }));
    writeSibling("b", snapshot({ pct: 1, reset: SOON }, { pct: 70, reset: LATER }));
    const { out } = run();
    assert.match(row(out, "5h limit") ?? "", /60%/);
    assert.match(row(out, "7d limit") ?? "", /70%/);
  });

  test("other rows still come from the current session", () => {
    writeSnapshot(snapshot({ pct: 48, reset: SOON }));
    writeSibling(
      "other",
      JSON.stringify({
        model: { display_name: "Other model" },
        rate_limits: { five_hour: { used_percentage: 78, resets_at: SOON } },
      }),
    );
    assert.equal(row(run().out, "Model"), "Model    Opus");
  });

  test("a sibling with invalid JSON is ignored", () => {
    writeSnapshot(snapshot({ pct: 48, reset: SOON }));
    writeSibling("broken", "{not json");
    const { code, out } = run();
    assert.equal(code, 0);
    assert.match(row(out, "5h limit") ?? "", /48%/);
  });

  test("uses the current session's quota when the directory can't be listed", {
    skip: process.platform === "win32",
  }, () => {
    writeSnapshot(snapshot({ pct: 48, reset: SOON }));
    const dir = dirname(snapshotPath(claude.dir(), SESSION));
    chmodSync(dir, 0o311);
    try {
      assert.match(row(run().out, "5h limit") ?? "", /48%/);
    } finally {
      chmodSync(dir, 0o755);
    }
  });

  test("no quota rows when no snapshot has rate limits", () => {
    writeSnapshot(JSON.stringify({ model: { display_name: "Opus" } }));
    writeSibling("other", JSON.stringify({ model: { display_name: "Other" } }));
    const { out } = run();
    assert.equal(row(out, "5h limit"), undefined);
    assert.equal(row(out, "7d limit"), undefined);
  });
});
