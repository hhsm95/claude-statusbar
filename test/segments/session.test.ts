import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { sessionSegment } from "../../src/segments/session.ts";
import { fg, makeContext } from "../helpers.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statusbar-session-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const sessions = (): string => join(dir, "sessions");
const put = (file: string, content: string): void => {
  mkdirSync(sessions(), { recursive: true });
  writeFileSync(join(sessions(), file), content);
};
const ctx = (sessionId: string | null = "abc") =>
  makeContext({ session_id: sessionId ?? undefined }, { claudeDir: dir });

describe("session segment", () => {
  test("shows the name of the matching session file", () => {
    put("123.json", JSON.stringify({ sessionId: "abc", name: "api-worker" }));
    assert.equal(sessionSegment.render(ctx()), fg(244, "◉ api-worker"));
  });

  test("ignores malformed and non-matching files", () => {
    put("100.json", "{not json");
    put("101.json", JSON.stringify({ sessionId: "other", name: "nope" }));
    put("102.json", JSON.stringify(["array"]));
    put("103.json", JSON.stringify({ sessionId: "abc", name: "right" }));
    assert.equal(sessionSegment.render(ctx()), fg(244, "◉ right"));
  });

  test("first match by sorted filename wins", () => {
    put("b.json", JSON.stringify({ sessionId: "abc", name: "second" }));
    put("a.json", JSON.stringify({ sessionId: "abc", name: "first" }));
    assert.equal(sessionSegment.render(ctx()), fg(244, "◉ first"));
  });

  test("hidden when the match has no name", () => {
    put("a.json", JSON.stringify({ sessionId: "abc" }));
    assert.equal(sessionSegment.render(ctx()), null);
  });

  test("hidden when the sessions directory is missing", () => {
    assert.equal(sessionSegment.render(ctx()), null);
  });

  test("hidden without a session_id", () => {
    put("a.json", JSON.stringify({ sessionId: "abc", name: "x" }));
    assert.equal(sessionSegment.render(ctx(null)), null);
  });
});
