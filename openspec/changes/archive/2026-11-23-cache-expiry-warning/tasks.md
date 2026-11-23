## 1. Input and constants

- [x] 1.1 Parse `transcript_path` into `StatusInput.transcriptPath` with `str()` in `src/input.ts`; test present, absent and non-string values in `test/input.test.ts`
- [x] 1.2 Add to `src/constants.ts`: `cache` to `SEGMENT_IDS`, `CACHE_TTL_SECONDS` (300 / 3600), `CACHE_WARN_SECONDS`, `CACHE_TAIL_BYTES` (64 KiB), `CACHE_TAIL_BYTES_MAX` (1 MiB), glyphs `cacheWarn` (`⏱`) and `cacheExpired` (`⚠`), strings for `cache`, `cache expired` and `tok`
- [x] 1.3 Make `defaultConfig` / `loadConfig` cover `cache` (enabled by default, toggle honored); test in `test/config.test.ts`

## 2. Transcript reader

- [x] 2.1 Create `src/transcript.ts` with `readLastRequest(path): {startMs, ttlSec, promptTokens} | undefined` reading only the tail (open + read at offset, drop the first line when the offset > 0, skip invalid JSON lines)
- [x] 2.2 Request selection: last `assistant` entry with `message.usage` and `isSidechain !== true`; start = `timestamp` of the closest entry before the first `assistant` entry with the same `message.id`, else that assistant entry's timestamp
- [x] 2.3 TTL detection: 5m tokens → 300, 1h tokens → 3600, else check earlier main-chain requests, else 3600
- [x] 2.4 Retry once with `CACHE_TAIL_BYTES_MAX` when the small tail has no qualifying request; return `undefined` for missing file or no match
- [x] 2.5 Tests in `test/transcript.test.ts` with temp JSONL fixtures (`mkdtempSync`): split request with trailing `system`/`attachment` entries, sidechain ignored, 5m TTL, pure-read fallback, default 1h, partial first line, invalid lines, large entry forcing the retry, missing file

## 3. Cache segment

- [x] 3.1 Create `src/segments/cache.ts`: hidden when no transcript data or remaining above the warning window; `⏱ cache <M>m` / `<1m` in `COLORS.warn`; `⚠ cache expired · <humanTokens> tok` in `COLORS.crit`
- [x] 3.2 Register it last in `SEGMENTS` (`src/segments/registry.ts`)
- [x] 3.3 Tests in `test/segments/cache.test.ts` with times built from `CACHE_WARN_SECONDS` / TTL relative to `NOW`: warm (hidden one second above the window), inside the window, under one minute, exactly at expiry, expired with token count, both TTLs (disabled via config: covered generically by `test/render.test.ts` "does not call render on disabled segments")

## 4. Session start time

- [x] 4.1 Add `formatStart(epochSec, now)` to `src/format/time.ts` (`HH:MM` under 24 h before `now`, else `DD Mon HH:MM`) and append ` · ${formatStart(startedAt / 1000, now)}` in `src/segments/session.ts` when `startedAt` is a finite number
- [x] 4.2 Tests in `test/segments/session.test.ts`: same-day start, start on another day, missing / non-numeric `startedAt` keeps `◉ <name>`

## 5. Docs

- [x] 5.1 README: `cache` row in the `## Segments` table and its details, session start time, `cache` in the `## Configuration` example
- [x] 5.2 CHANGELOG: `## [Unreleased]` section with the new segment and the session start time

## 6. Verification (user)

- [x] 6.1 User checks in a real session: segment hidden while active, amber after ~50 min idle, red after 60 min, then hidden again after sending a message
