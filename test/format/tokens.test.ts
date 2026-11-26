import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fullNumber, humanTokens } from "../../src/format/tokens.ts";

describe("fullNumber", () => {
  test("uses comma thousands separators", () => {
    assert.equal(fullNumber(0), "0");
    assert.equal(fullNumber(999), "999");
    assert.equal(fullNumber(1000), "1,000");
    assert.equal(fullNumber(1234567), "1,234,567");
  });

  test("rounds to an integer", () => {
    assert.equal(fullNumber(1234.6), "1,235");
  });
});

describe("humanTokens", () => {
  test("below 1000 is an integer", () => {
    assert.equal(humanTokens(0), "0");
    assert.equal(humanTokens(999), "999");
  });

  test("below 10000 has one decimal K", () => {
    assert.equal(humanTokens(1000), "1.0K");
    assert.equal(humanTokens(9949), "9.9K");
  });

  test("below 999500 is integer K", () => {
    assert.equal(humanTokens(16700), "17K");
    assert.equal(humanTokens(163000), "163K");
    assert.equal(humanTokens(999499), "999K");
  });

  test("from 999500 uses M with at most one decimal", () => {
    assert.equal(humanTokens(999500), "1M");
    assert.equal(humanTokens(1000000), "1M");
    assert.equal(humanTokens(1250000), "1.3M");
    assert.equal(humanTokens(2000000), "2M");
  });
});
