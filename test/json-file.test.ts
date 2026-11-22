import assert from "node:assert/strict";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { writeJsonAtomic } from "../src/json-file.ts";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statusbar-json-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("writeJsonAtomic", () => {
  test("writes 2-space JSON with a trailing newline", () => {
    const path = join(dir, "a.json");
    writeJsonAtomic(path, { a: 1 });
    assert.equal(readFileSync(path, "utf8"), '{\n  "a": 1\n}\n');
  });

  test("a symlinked file is updated at its real location and stays a symlink", (t) => {
    const real = join(dir, "real.json");
    const link = join(dir, "link.json");
    writeFileSync(real, "{}");
    try {
      symlinkSync(real, link);
    } catch {
      t.skip("symlinks not available");
      return;
    }
    writeJsonAtomic(link, { b: 2 });
    assert.ok(lstatSync(link).isSymbolicLink());
    assert.deepEqual(JSON.parse(readFileSync(real, "utf8")), { b: 2 });
  });

  test("keeps the mode of an existing file", { skip: process.platform === "win32" }, () => {
    const path = join(dir, "private.json");
    writeFileSync(path, "{}");
    chmodSync(path, 0o600);
    writeJsonAtomic(path, { c: 3 });
    assert.equal(statSync(path).mode & 0o777, 0o600);
  });
});
