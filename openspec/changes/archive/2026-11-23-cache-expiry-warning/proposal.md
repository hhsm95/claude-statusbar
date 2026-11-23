## Why

Claude Code caches the conversation prefix with a TTL (1 hour on subscriptions, 5 minutes in
usage overage or on some API-key setups). Every request that reads the cache restarts its timer,
so a long but active session stays warm; what makes it expire is **idle time** since the last
request. The next message after expiry re-writes the whole context at the cache-write price
(about 40× a cache read on Opus 5.5), and nothing in the status line warns about it. The user
wants to see that coming before sending the expensive message.

## What Changes

- New `cache` segment, placed last (after `context`), that reads the tail of the session
  transcript to find when the last main-chain request started, which TTL it used and how many
  prompt tokens it carried.
  - Hidden while the cache is warm.
  - Amber `⏱ cache <N>m` when the remaining time falls inside the warning window.
  - Red `⚠ cache expired · <tokens> tok` once the TTL has passed, with the prompt size that the
    next message will re-write.
- The session segment appends the session start time: `◉ <name> · HH:MM` (dim), from the
  `startedAt` field of the session file it already reads.
- `transcript_path` is parsed from the status line JSON.
- New `cache` toggle in `statusbar.json` (enabled by default).

## Capabilities

### New Capabilities
- `cache-expiry`: detecting the last request's start, TTL and prompt size from the transcript
  tail, and rendering the warning / expired states of the `cache` segment.

### Modified Capabilities
- `statusline-render`: the fixed segment order gains `cache` at the end; the session segment
  shows the start time.
- `segment-config`: the list of segment ids gains `cache`.

## Impact

- Code: `src/input.ts`, `src/constants.ts`, `src/segments/registry.ts`,
  `src/segments/session.ts`, new `src/segments/cache.ts` and a transcript-tail reader,
  `src/format/time.ts`.
- One extra bounded file read (transcript tail) per render, every `refreshInterval` (30 s).
- Relies on Claude Code's undocumented transcript JSONL shape; any mismatch hides the segment.
- Docs: README `## Segments` table and `## Configuration` example; CHANGELOG.
