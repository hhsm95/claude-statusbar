import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createAnsi, isColorDisabled } from "../../src/format/ansi.ts";

describe("createAnsi with colors", () => {
  const ansi = createAnsi(true);

  test("color wraps text in a 256-color code and reset", () => {
    assert.equal(ansi.color(214, "x"), "\x1b[38;5;214mx\x1b[0m");
  });

  test("bold wraps text in bold and reset", () => {
    assert.equal(ansi.bold("x"), "\x1b[1mx\x1b[0m");
  });

  test("dim uses code 244", () => {
    assert.equal(ansi.dim("x"), "\x1b[38;5;244mx\x1b[0m");
  });
});

describe("createAnsi without colors", () => {
  const ansi = createAnsi(false);

  test("helpers return plain text", () => {
    assert.equal(ansi.color(196, "x"), "x");
    assert.equal(ansi.bold("x"), "x");
    assert.equal(ansi.dim("x"), "x");
  });
});

describe("isColorDisabled", () => {
  test("true for a non-empty NO_COLOR", () => {
    assert.equal(isColorDisabled({ NO_COLOR: "1" }), true);
  });

  test("false when unset or empty", () => {
    assert.equal(isColorDisabled({}), false);
    assert.equal(isColorDisabled({ NO_COLOR: "" }), false);
  });
});
