import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { layoutLine, parseColumns, truncate, width } from "../src/layout.ts";
import { bar, fixed, name, type Paint, type Piece } from "../src/segments/types.ts";

const plain: Paint = (s) => s;
const BRANCH = "abcdefghijklmnopqrstuvwxyz0123"; // 30 code points
const WORKTREE = "wt-folder-1"; // 11 code points
const CELLS = "▓▓▓▓▓▓▓░░░";

const model = (): Piece[] => [fixed("Opus", plain)];
const branch = (text = BRANCH): Piece[] => [name(text, plain, "", "⎇ ")];
const branchAndWorktree = (): Piece[] => [
  name(BRANCH, plain, "", "⎇ "),
  name(WORKTREE, plain, " ", "⌂ "),
];
const window5h = (paint: Paint = plain): Piece[] => [
  fixed("5h", paint),
  bar(CELLS, paint, " "),
  fixed("74%", paint, " "),
];
const line = (columns: number | undefined, ...segments: Piece[][]): string =>
  layoutLine(segments, columns, plain);

// Full line: 4 + 3 + (2 + 30) + 3 + 17 = 59 columns.
const FULL = `Opus │ ⎇ ${BRANCH} │ 5h ${CELLS} 74%`;

describe("parseColumns", () => {
  test("unset, non-numeric, zero and negative mean unknown", () => {
    assert.equal(parseColumns({}), undefined);
    assert.equal(parseColumns({ COLUMNS: "abc" }), undefined);
    assert.equal(parseColumns({ COLUMNS: "0" }), undefined);
    assert.equal(parseColumns({ COLUMNS: "-5" }), undefined);
    assert.equal(parseColumns({ COLUMNS: "" }), undefined);
    assert.equal(parseColumns({ COLUMNS: "12.5" }), undefined);
  });

  test("a positive integer is returned", () => {
    assert.equal(parseColumns({ COLUMNS: "80" }), 80);
  });
});

describe("width", () => {
  test("counts code points, with the clock and warning glyphs as 2", () => {
    assert.equal(width(""), 0);
    assert.equal(width("abc"), 3);
    assert.equal(width("⏱"), 2);
    assert.equal(width("⚠ x"), 4);
    assert.equal(width("😀"), 1);
  });
});

describe("truncate", () => {
  test("names at or under the cap are unchanged", () => {
    assert.equal(truncate("abcdefgh", 8), "abcdefgh");
    assert.equal(truncate("abc", 8), "abc");
  });

  test("a longer name keeps cap - 1 code points plus the ellipsis", () => {
    assert.equal(truncate("abcdefghi", 8), "abcdefg…");
    assert.equal(truncate("abcdefghi", 1), "…");
  });

  test("never splits a surrogate pair", () => {
    assert.equal(truncate("😀😀😀😀", 3), "😀😀…");
  });
});

describe("layoutLine", () => {
  test("width unknown prints everything", () => {
    assert.equal(line(undefined, model(), branch(), window5h()), FULL);
  });

  test("a line that fits is printed unchanged", () => {
    assert.equal(line(200, model(), branch(), window5h()), FULL);
  });

  test("the line fits exactly at columns minus the margin", () => {
    assert.equal(line(61, model(), branch(), window5h()), FULL);
  });

  test("a long name is truncated first, keeping the bars", () => {
    // available 48 = 27 other columns + 2 label + cap 19
    assert.equal(
      line(50, model(), branch(), window5h()),
      `Opus │ ⎇ abcdefghijklmnopqr… │ 5h ${CELLS} 74%`,
    );
  });

  test("branch and worktree share the cap; a shorter name stays whole", () => {
    // available 58 = 27 + (2 + cap) + (3 + 11): cap 15 fits, 16 does not
    assert.equal(
      line(60, model(), branchAndWorktree(), window5h()),
      `Opus │ ⎇ abcdefghijklmn… ⌂ wt-folder-1 │ 5h ${CELLS} 74%`,
    );
  });

  test("names at the minimum cap still fit with their bars", () => {
    // available 48 = 27 + (2 + 8) + (3 + 8)
    assert.equal(
      line(50, model(), branchAndWorktree(), window5h()),
      `Opus │ ⎇ abcdefg… ⌂ wt-fold… │ 5h ${CELLS} 74%`,
    );
  });

  test("bars are dropped when names at the minimum do not fit, and the cap grows back", () => {
    // available 40: with bars even cap 8 needs 48; without bars (16 other columns) cap 9 fits
    assert.equal(
      line(42, model(), branchAndWorktree(), window5h()),
      "Opus │ ⎇ abcdefgh… ⌂ wt-folde… │ 5h 74%",
    );
  });

  test("names return to full length when dropping the bars is enough", () => {
    // available 44: without bars 16 + (2 + 12) + (3 + 11) fits cap 12; the 11-code-point name is whole
    assert.equal(
      line(46, model(), branchAndWorktree(), window5h()),
      "Opus │ ⎇ abcdefghijk… ⌂ wt-folder-1 │ 5h 74%",
    );
  });

  test("too narrow wraps the compact form onto more lines, filled in order", () => {
    // available 28: "Opus │ ⎇ abcdefg… ⌂ wt-fold…" is 28 columns, "5h 74%" goes to the next line
    assert.equal(
      line(30, model(), branchAndWorktree(), window5h()),
      "Opus │ ⎇ abcdefg… ⌂ wt-fold…\n5h 74%",
    );
  });

  test("a segment wider than a line gets its own line and overflows", () => {
    // available 8: each 6-column window fits alone, two do not (6 + 3 + 6)
    assert.equal(
      line(10, [fixed("aaaaaaaaaaaa", plain)], window5h(), window5h()),
      "aaaaaaaaaaaa\n5h 74%\n5h 74%",
    );
  });

  test("wrapped lines carry the painted separator only between segments", () => {
    const out = layoutLine(
      [[fixed("aaaa", plain)], [fixed("bbbb", plain)], [fixed("cccc", plain)]],
      13,
      (text) => `<${text}>`,
    );
    // available 11: "aaaa │ bbbb" is 11 columns
    assert.equal(out, "aaaa <│> bbbb\ncccc");
  });

  test("a short sha is never cut; shortening goes on to the bars", () => {
    // full 36 columns, available 30: a 7-code-point name is below the minimum cap
    assert.equal(line(32, model(), branch("1a2b3c4"), window5h()), "Opus │ ⎇ 1a2b3c4 │ 5h 74%");
  });

  test("wide glyphs count as 2 columns", () => {
    const text = "abcdefghijklmnopqrst"; // 20
    const segments = [[fixed("⏱", plain)], [name(text, plain)]]; // 2 + 3 + 20 = 25
    assert.equal(layoutLine(segments, 27, plain), `⏱ │ ${text}`);
    assert.equal(layoutLine(segments, 26, plain), "⏱ │ abcdefghijklmnopqr…");
  });

  test("styling is not counted and keeps its place", () => {
    const paint: Paint = (s) => `<${s}>`;
    const segments = [[fixed("Opus", paint)], [name(BRANCH, paint, "", "⎇ ")], window5h(paint)];
    assert.equal(
      layoutLine(segments, 61, paint),
      `<Opus> <│> <⎇ ${BRANCH}> <│> <5h> <${CELLS}> <74%>`,
    );
    // available 58: the branch loses exactly its last 2 code points
    assert.equal(
      layoutLine(segments, 60, paint),
      `<Opus> <│> <⎇ abcdefghijklmnopqrstuvwxyz01…> <│> <5h> <${CELLS}> <74%>`,
    );
  });
});
