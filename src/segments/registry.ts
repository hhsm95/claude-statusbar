import { contextSegment } from "./context.ts";
import { effortSegment } from "./effort.ts";
import { fiveHourSegment } from "./five-hour.ts";
import { gitSegment } from "./git.ts";
import { modelSegment } from "./model.ts";
import { sessionSegment } from "./session.ts";
import { sevenDaySegment } from "./seven-day.ts";
import type { Segment } from "./types.ts";

/** Fixed display order. Adding a segment is one file plus one line here. */
export const SEGMENTS: readonly Segment[] = [
  modelSegment,
  effortSegment,
  sessionSegment,
  gitSegment,
  fiveHourSegment,
  sevenDaySegment,
  contextSegment,
];
