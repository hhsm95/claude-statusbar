import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { meetsMinimumNode } from "../src/node-version.ts";

const MINIMUM = { major: 10, minor: 5 };

describe("meetsMinimumNode", () => {
  test("accepts the exact minimum", () => {
    assert.equal(meetsMinimumNode("10.5.0", MINIMUM), true);
  });

  test("accepts a later minor or patch on the same major", () => {
    assert.equal(meetsMinimumNode("10.6.0", MINIMUM), true);
    assert.equal(meetsMinimumNode("10.5.9", MINIMUM), true);
  });

  test("accepts any later major, even with a lower minor", () => {
    assert.equal(meetsMinimumNode("11.0.0", MINIMUM), true);
  });

  test("rejects an earlier minor on the same major", () => {
    assert.equal(meetsMinimumNode("10.4.9", MINIMUM), false);
  });

  test("rejects an earlier major, even with a higher minor", () => {
    assert.equal(meetsMinimumNode("9.99.0", MINIMUM), false);
  });

  test("treats an unparseable version as supported rather than blocking", () => {
    assert.equal(meetsMinimumNode("garbage", MINIMUM), true);
  });
});
