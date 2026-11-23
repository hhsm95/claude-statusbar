## Context

Prompt-cache semantics (Claude API, prompt caching reference): a cache entry lives for its TTL
measured from the **start** of the request that wrote or last read it, and every read restarts
the timer. A conversation therefore stays warm while requests keep coming less than one TTL
apart, whatever the session's age. Claude Code uses the 1-hour TTL on subscriptions (verified in
this user's transcripts: every write is `ephemeral_1h_input_tokens`) and drops to 5 minutes in
usage overage.

Current state of the code (exploration report):

- `src/input.ts:15-23` does not parse `transcript_path`.
- Segments are `{id, render(ctx): string | null}` (`src/segments/types.ts:8-20`), ordered by
  `SEGMENTS` in `src/segments/registry.ts:11-19`, ids in `SEGMENT_IDS`
  (`src/constants.ts:116-124`). `null` hides; `render.ts` wraps each segment in try/catch and
  skips disabled segments without calling them.
- Colors, thresholds and glyphs live in `src/constants.ts` (`COLORS`, `THRESHOLDS`, `GLYPHS`,
  `STRINGS`). `context.ts` uses warn 214 and crit 196.
- `init` installs `refreshInterval: 30` (`src/constants.ts:126-131`), so the line re-renders
  every 30 s while idle — a countdown works without changes.
- `session.ts` already reads `<claudeDir>/sessions/*.json` every render; those files carry
  `startedAt` (epoch ms).
- `src/format/time.ts` has only `formatReset(epochSec, now)`.

Observed transcript tail shape (Claude Code 2.1.330): one request's answer is split across
several `assistant` entries sharing `message.id`, the last with `message.usage`; after it come
non-request entries (`system` with `subtype`, `attachment`, `cost-state`, `last-prompt`,
`file-history-snapshot`, some without `timestamp`). Subagent entries carry `isSidechain: true`.

## Goals / Non-Goals

**Goals:**
- Warn before the next message pays a full cache re-write, with the real TTL of the session.
- Say how big that re-write is (prompt tokens of the last request).
- Show the session start time as information.
- Never slow down or break rendering.

**Non-Goals:**
- Showing a countdown while the cache is warm (option B chosen: hidden until the warning window).
- Estimating dollars (pricing differs per model and plan).
- Tracking subagent caches or per-breakpoint TTL mixes.
- Keeping the cache warm (no keep-alive requests).

## Decisions

### Approaches considered (user picked 1)
1. **Read the transcript tail** — precise start time, real TTL and prompt size. Chosen.
2. **Transcript mtime** — trivial, but non-request entries (`system`, `attachment`, `cost-state`)
   touch the file after each answer, and it cannot see the 5-minute TTL: it would warn 55 minutes
   late in overage. Rejected.
3. **State file of last token change** — refreshes carry no new data, state is lost on restart
   and the time is the render's, not the request's. Rejected.

### Request start = entry before the first assistant entry of the last request
The TTL counts from request start. The closest entry before the first `assistant` entry of the
message is the user prompt or tool result that triggered the request, so its timestamp is the
start. Using the `assistant` timestamp would overstate remaining time by the generation length.
A user entry *after* the last answer (a local command, or a request in flight) is deliberately
not used: local commands (`/model`, `!cmd`) are `user` entries that send no request, and
treating them as a start would silently hide a real warning.

### Bounded tail read
Read the last `CACHE_TAIL_BYTES` (64 KiB) with `fs.openSync` + `readSync` at
`size - CACHE_TAIL_BYTES`. If no qualifying request is found (a huge tool result can fill the
tail), retry once with `CACHE_TAIL_BYTES_MAX` (1 MiB), then hide. Drop the first line when
reading from a non-zero offset. Lives in its own module (`src/transcript.ts`) returning
`{startMs, ttlSec, promptTokens} | undefined`, so the segment only maps it to text.

### TTL detection with fallback to 1h
5m write tokens decide 300 s; 1h write tokens decide 3600 s; a pure read looks further back. If
nothing in the tail decides, default to 3600 s — the default for subscriptions. Defaulting to
5 minutes would flash red on every five-minute pause for 1h users and teach them to ignore it.
TTL durations (300 / 3600) are API facts and may be fixed literals in tests.

### Warning windows are tuning values
`CACHE_WARN_SECONDS = { 300: 120, 3600: 600 }` in `constants.ts` (2 min for 5m, 10 min for 1h).
Tests build timestamps from these constants instead of comparing them to literals.

### Rendering
- Warning: `⏱ cache <M>m`, `COLORS.warn`; `<M>` is `floor(remaining / 60)`, `<1m` under a minute.
  Rounding down never promises time that isn't there.
- Expired: `⚠ cache expired · <humanTokens(T)> tok`, `COLORS.crit`, where
  `T = input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.
- Glyphs and strings go to `GLYPHS` / `STRINGS`.
- Placed last in the order: it qualifies the context segment just before it and appears only
  occasionally, so the rest of the line doesn't shift when it shows up.

### Session start time
`session.ts` appends ` · ${formatStart(startedAt / 1000, now)}` when `startedAt` is a finite
number; the whole segment stays dim. `formatStart` (new, in `src/format/time.ts`) mirrors
`formatReset` backwards: `HH:MM` when the start is under 24 h before `now`, `DD Mon HH:MM`
otherwise. `formatReset` itself can't be reused: it only looks ahead, so any past instant would
print `HH:MM` even days later.

## Risks / Trade-offs

- [Transcript format is not a public contract] → every field is read defensively; any mismatch
  returns `undefined` and hides the segment. The scenarios pin the shape observed today.
- [A long thinking turn before the first assistant entry] → the start uses the preceding entry,
  not the assistant one, so it is unaffected.
- [Clock skew between transcript timestamps (UTC ISO) and `now`] → both are absolute instants;
  only local-clock errors matter, which equally affect Claude Code.
- [Status line refresh only every 30 s] → remaining time can be up to 30 s stale; floor rounding
  and a minutes-level display absorb it.
- [Cost of an extra read per render] → at most 64 KiB (1 MiB in the rare retry) every 30 s, and
  only when the segment is enabled.

## Migration Plan

Additive. Existing `statusbar.json` files without `cache` get it enabled by default; users can
set `"cache": false`. No settings.json change is needed (`refreshInterval` already installed).
