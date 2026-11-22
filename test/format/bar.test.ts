import assert from "node:assert/strict";
import { test } from "node:test";
import { bar } from "../../src/format/bar.ts";

test("0% is all empty", () => {
  assert.equal(bar(0), "░░░░░░░░░░");
});

test("74% rounds to 7 filled cells", () => {
  assert.equal(bar(74), "▓▓▓▓▓▓▓░░░");
});

test("100% is all filled", () => {
  assert.equal(bar(100), "▓▓▓▓▓▓▓▓▓▓");
});

test("above 100 is clamped to full", () => {
  assert.equal(bar(250), "▓▓▓▓▓▓▓▓▓▓");
});

test("below 0 is clamped to empty", () => {
  assert.equal(bar(-20), "░░░░░░░░░░");
});

test("NaN renders empty", () => {
  assert.equal(bar(Number.NaN), "░░░░░░░░░░");
});

test("custom cell count", () => {
  assert.equal(bar(50, 4), "▓▓░░");
});
