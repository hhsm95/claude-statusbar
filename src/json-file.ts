import {
  chmodSync,
  existsSync,
  mkdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { JSON_INDENT, PERMISSION_BITS } from "./constants.ts";

export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Writes 2-space JSON with a trailing newline via a temp file in the same dir plus rename. */
export function writeJsonAtomic(requested: string, value: unknown): void {
  // A symlinked file is updated where it really lives, so the link survives the rename.
  const path = existsSync(requested) ? realpathSync(requested) : requested;
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const temp = join(dir, `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(temp, `${JSON.stringify(value, null, JSON_INDENT)}\n`, "utf8");
    if (existsSync(path)) chmodSync(temp, statSync(path).mode & PERMISSION_BITS);
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}
