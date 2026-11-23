import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import {
  CACHE_TAIL_BYTES,
  CACHE_TAIL_BYTES_MAX,
  CACHE_TTL_SECONDS,
  SYNTHETIC_MODEL,
} from "./constants.ts";
import { isJsonObject, type JsonObject } from "./json-file.ts";

export interface LastRequest {
  startMs: number;
  ttlSec: number;
  promptTokens: number;
}

interface TailRead {
  entries: JsonObject[];
  /** True when the read began at the start of the file, so nothing earlier exists. */
  wholeFile: boolean;
}

function readTail(path: string, bytes: number): TailRead | undefined {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const size = fstatSync(fd).size;
    const offset = Math.max(0, size - bytes);
    const buffer = Buffer.alloc(size - offset);
    const read = readSync(fd, buffer, 0, buffer.length, offset);
    // A line cut by the tail is never a whole JSON object, so the parse below drops it;
    // a tail starting exactly at a line boundary keeps that line.
    const entries: JsonObject[] = [];
    for (const line of buffer.toString("utf8", 0, read).split("\n")) {
      try {
        const parsed: unknown = JSON.parse(line);
        if (isJsonObject(parsed)) entries.push(parsed);
      } catch {
        // Blank or corrupt line: skip it.
      }
    }
    return { entries, wholeFile: offset === 0 };
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

interface Request {
  index: number;
  usage: JsonObject;
}

/** Usage of a main-chain API request; synthetic error entries never reached the cache. */
function usageOf(entry: JsonObject): JsonObject | undefined {
  if (entry.type !== "assistant" || entry.isSidechain === true) return undefined;
  if (entry.isApiErrorMessage === true || !isJsonObject(entry.message)) return undefined;
  if (entry.message.model === SYNTHETIC_MODEL) return undefined;
  return isJsonObject(entry.message.usage) ? entry.message.usage : undefined;
}

function messageIdOf(entry: JsonObject): unknown {
  return isJsonObject(entry.message) ? entry.message.id : undefined;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function timestampMs(entry: JsonObject): number | undefined {
  if (typeof entry.timestamp !== "string") return undefined;
  const ms = Date.parse(entry.timestamp);
  return Number.isNaN(ms) ? undefined : ms;
}

function ttlOf(usage: JsonObject): number | undefined {
  const creation = isJsonObject(usage.cache_creation) ? usage.cache_creation : {};
  if (count(creation.ephemeral_5m_input_tokens) > 0) return CACHE_TTL_SECONDS.fiveMinutes;
  if (count(creation.ephemeral_1h_input_tokens) > 0) return CACHE_TTL_SECONDS.oneHour;
  return undefined;
}

function startOf(entries: readonly JsonObject[], lastIndex: number): number | undefined {
  const last = entries[lastIndex];
  const id = last === undefined ? undefined : messageIdOf(last);
  const firstIndex =
    id === undefined
      ? lastIndex
      : entries.findIndex((e) => e.type === "assistant" && messageIdOf(e) === id);
  for (const entry of entries.slice(0, firstIndex).reverse()) {
    const ms = timestampMs(entry);
    if (ms !== undefined) return ms;
  }
  const first = entries[firstIndex];
  return first === undefined ? undefined : timestampMs(first);
}

function analyze(entries: readonly JsonObject[]): LastRequest | undefined {
  const requests: Request[] = [];
  entries.forEach((entry, index) => {
    const usage = usageOf(entry);
    if (usage) requests.push({ index, usage });
  });
  const last = requests.at(-1);
  if (last === undefined) return undefined;
  const startMs = startOf(entries, last.index);
  if (startMs === undefined) return undefined;

  const decided = [...requests]
    .reverse()
    .map((request) => ttlOf(request.usage))
    .find((ttl) => ttl !== undefined);
  const ttlSec = decided ?? CACHE_TTL_SECONDS.oneHour;
  const { usage } = last;
  const promptTokens =
    count(usage.input_tokens) +
    count(usage.cache_read_input_tokens) +
    count(usage.cache_creation_input_tokens);
  return { startMs, ttlSec, promptTokens };
}

/**
 * Reads the last main-chain request from the tail of a transcript JSONL file.
 * Retries once with a larger tail; never throws.
 */
export function readLastRequest(
  path: string,
  tailBytes: number = CACHE_TAIL_BYTES,
  maxTailBytes: number = CACHE_TAIL_BYTES_MAX,
): LastRequest | undefined {
  const small = readTail(path, tailBytes);
  if (!small) return undefined;
  const found = analyze(small.entries);
  if (found || small.wholeFile) return found;
  const large = readTail(path, maxTailBytes);
  return large ? analyze(large.entries) : undefined;
}
