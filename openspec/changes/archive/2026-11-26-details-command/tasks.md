## 1. Snapshot on the render path

- [x] 1.1 Add constants: snapshot dir parts, file suffix, `SNAPSHOT_RETENTION_MS` (7 days), session-id pattern
- [x] 1.2 `src/snapshot.ts`: `isSafeSessionId`, `snapshotPath`, `saveSnapshot(claudeDir, raw, now)` (object-only, atomic) with tests (written, unsafe id, missing id, not an object)
- [x] 1.3 Prune `*.json` and stale `.tmp` files older than the retention only when the write created a new file, with tests using `utimesSync`
- [x] 1.4 Call `saveSnapshot` from `renderFromStdin` in its own `try/catch`; CLI test that the line and exit code are unchanged when the dir is unwritable, and that the file appears otherwise
- [x] 1.5 (user) After `task setup`, run `! ls ~/.claude/statusbar/snapshots/ && echo "$CLAUDE_CODE_SESSION_ID"` in a live session and confirm the file name matches the id

## 2. Formatting helpers and input

- [x] 2.1 `formatDuration`, exported `formatClock`, `ttlLabel` in `src/format/time.ts` with tests
- [x] 2.2 `fullNumber` in `src/format/tokens.ts` with tests
- [x] 2.3 `StatusInput.costUsd` from `cost.total_cost_usd` (finite, non-negative) with tests in `test/input.test.ts`

## 3. Segment detail rows

- [x] 3.1 `DetailRow` and optional `Segment.detail` in `src/segments/types.ts`; `DETAIL_LABELS` in constants
- [x] 3.2 `model`, `effort`, `session` detail rows with tests
- [x] 3.3 `git` detail rows (full branch, ahead, worktree) sharing the git reads with `render`, with tests (long branch untruncated, detached, linked worktree)
- [x] 3.4 `detailWindow` in `window.ts` for `fiveHour`/`sevenDay` (future reset, passed reset, no reset) with tests
- [x] 3.5 `context` detail row (full counts, no output, percentage only) with tests
- [x] 3.6 `cache` detail row (warm far from expiry, expired, no transcript) with tests
- [x] 3.7 Registry test: every segment in `SEGMENTS` implements `detail`

## 4. `details` command

- [x] 4.1 `formatDetails(rows, ageSec, ansi)` pure function (header, label padding, `no data`, trailing `\n`) with tests
- [x] 4.2 `runDetails(env, io, now)` in `src/commands/details.ts`: session lookup, snapshot read, config filter, per-segment `try/catch`, cost row, error messages and exit codes, with tests using a temp `CLAUDE_CONFIG_DIR`
- [x] 4.3 Dispatch `details` from `src/cli.ts` via dynamic `import()`; add `CLI.commands.details` and the usage line; CLI test for exit code 1 without `CLAUDE_CODE_SESSION_ID`

## 5. Docs and verification

- [x] 5.1 README: `details` section (`! claude-statusbar details`, what it shows, snapshot dir and retention) and usage
- [x] 5.2 CHANGELOG `Unreleased` entry
- [x] 5.3 `npm run check`, `npm run build`, smoke: render with a `session_id` under a temp `CLAUDE_CONFIG_DIR`, then `CLAUDE_CODE_SESSION_ID=<id> node dist/cli.js details`
- [x] 5.4 (user) Run `! claude-statusbar details` in a real Claude Code session after `task setup` and confirm the rows
