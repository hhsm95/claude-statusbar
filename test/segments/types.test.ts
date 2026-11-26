import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bar, fixed, name, printPiece } from "../../src/segments/types.ts";

const wrap = (s: string): string => `<${s}>`;

describe("piece constructors", () => {
  test("default lead and label to empty and set the kind", () => {
    assert.deepEqual(fixed("a", wrap), {
      kind: "fixed",
      lead: "",
      label: "",
      text: "a",
      paint: wrap,
    });
    assert.equal(name("b", wrap).kind, "name");
    assert.equal(bar("c", wrap, " ").kind, "bar");
  });

  test("a piece prints as lead + paint(label + text)", () => {
    assert.equal(printPiece(name("main", wrap, " ", "⎇ ")), " <⎇ main>");
    assert.equal(printPiece(fixed("a", wrap)), "<a>");
  });
});
