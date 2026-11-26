## Context

The status line is a single line fitted to `COLUMNS` (0.3.0): git names are truncated, bars are
dropped, tokens are rounded (`84k/200k`), reset times are short and the cache segment only appears
near expiry. Claude Code's `statusLine` has no hover, tooltip or scroll, and the process exits
after printing, so the full detail has nowhere to go.

Constraints found while exploring:

- The data that matters (`rate_limits`, `context_window`, `cost`) only arrives on the stdin JSON
  Claude Code passes to the renderer. Neither `<claudeDir>/sessions/*.json` nor the transcript
  carries it. A command run by hand gets no stdin.
- Inside Claude Code both the Bash tool and the `!` bash mode receive `CLAUDE_CODE_SESSION_ID`
  (verified in this session: `! echo "$CLAUDE_CODE_SESSION_ID"` printed the session's id).
- The stdin `session_id` and `CLAUDE_CODE_SESSION_ID` are the same id: Claude Code's
  `sessions/<CLAUDE_PID>.json` holds `sessionId` equal to the env var (checked), and the existing
  `session` segment already matches the stdin `session_id` against those files successfully.
  The user's manual check (task 1.5) confirms it end to end before the rest is built.
- A custom slash command would feed the output to the model (one model turn per call, and the
  model may reformat it); `!` prints directly at no cost.
- The render path must never throw or stall and has no runtime dependencies.

## Goals / Non-Goals

**Goals:**
- `! claude-statusbar details` prints the full, untruncated detail of the current session's line.
- Identify the session with certainty (no guessing between concurrent sessions).
- Zero visible effect on the line: same output, same exit code, negligible extra time.
- Adding a segment keeps its detail next to its render code.

**Non-Goals:**
- A `/statusbar` slash command or any change to `init`/`uninstall`.
- Running from a separate terminal (no session id → clear error, no "latest session" guess).
- Live refresh / watch mode, JSON output, OSC 8 links.
- Making `Cost` a configurable bar segment.

**Anti-goals:** the snapshot write must never make the line slower in a noticeable way, fail it,
or leave temp files behind.

## Approaches

Snapshot storage:
- **A (chosen) — raw stdin JSON** per session. The format is Claude Code's, `details` reuses
  `parseStatusInput`, and fields added later (like `cost`) are already there.
- B — normalized `StatusInput`. Slightly smaller, but every internal type change breaks old
  snapshots and forces a versioned format.

Row content:
- **1 (chosen) — optional `Segment.detail(ctx)`** beside `render(ctx)`. Reuses what each
  segment already computes (transcript read, git calls), gets config filtering and registry order
  for free, and a new segment carries its row in the same file.
- 2 — a separate `src/details.ts` building every row. Leaves segments untouched but duplicates
  their logic and is easy to forget when adding a segment.
- Rejected: reusing `render()` with unlimited width — pieces have no absolute reset times nor
  token breakdowns.

Entry point: `!` + subcommand (chosen by the user) over a slash command (costs a model turn per
call) or both.

## Decisions

### Snapshot write (`src/snapshot.ts`)
- Path: `<claudeDir>/statusbar/snapshots/<session_id>.json` — a directory of our own, separate
  from Claude Code's `sessions/`. Constants in `src/constants.ts`.
- Session id must match `^[A-Za-z0-9_-]{1,128}$` (shared validator, used by `details` too);
  otherwise nothing is written. This blocks path traversal from stdin or env.
- Written only when the stdin JSON parses to an object; stored via `writeJsonAtomic` (re-indented
  but semantically unchanged — fine, it is read back with `JSON.parse`).
- Timestamp = file mtime; no wrapper object, so the file is exactly Claude Code's JSON.
- Each render overwrites the session's snapshot (no merge): `details` shows exactly what the
  line was given last. A sparse early render (before the first API response) is a real "no data
  yet" state, and the next render fills it.
- Pruning runs only when the write created a new file (first render of a session; check
  `existsSync` before writing), so repeat renders pay no directory scan: `readdirSync` the
  directory and `rmSync` `*.json` entries with `mtime` older than 7 days
  (`SNAPSHOT_RETENTION_MS`). Temp files left by a crash are
  dot-files ending in `.tmp`; prune those too when older than the retention.
- Called from `renderFromStdin` in `src/cli.ts` after the line is computed, inside its own
  `try/catch` so it can never change the output. `cli.ts` keeps the raw string; `snapshot.ts`
  re-parses it (cheap; keeps `parseStatusInput`'s signature untouched).
- The render path stays dependency-free: `snapshot.ts` only uses `node:fs`/`node:path` and
  `json-file.ts`.

### Detail rows (`src/segments/types.ts`)
- `interface DetailRow { label: string; value: string }` — `value` may contain ANSI (painted with
  the segment's colors); `label` is plain.
- `Segment.detail?(ctx: RenderContext): readonly DetailRow[] | null`. Optional in the type so
  third-party-style additions don't break, but every built-in segment implements it (a test
  asserts that for `SEGMENTS`).
- Labels live in `constants.ts` (`DETAIL_LABELS`): `Model`, `Effort`, `Session`, `Git`,
  `Worktree`, `5h limit`, `7d limit`, `Context`, `Cache`, `Cost`.
- Per-segment content is exactly the `Segment rows` requirement in the spec. Shared logic stays
  in the segment file: `window.ts` gets `detailWindow()` next to `renderWindow()`; `git.ts`
  reuses its git calls (the render and detail can share a private `readGit()` that returns
  `{branch, worktree?, ahead}`); `cache.ts` reuses `readLastRequest`.
- Colors: values reuse the line's colors where they carry meaning (window/context thresholds,
  cache warn/crit, git color); otherwise plain. Labels dim.

### Formatting helpers (`src/format/`)
- `formatDuration(seconds)` in `time.ts`: two largest non-zero units of d/h/m/s, `0s` at zero,
  negative input treated as its absolute value (callers say "in"/"ago").
- `formatClock(epochSec)` — the existing private `formatLocal(_, false)` exported as `HH:MM` for
  the cache expiry; resets reuse `formatReset`, session start reuses `formatStart`.
- Full numbers: `fullNumber(n)` in `tokens.ts` via `Math.round(n).toLocaleString("en-US")`
  (deterministic separator regardless of locale).
- TTL label: `ttlLabel(ttlSec)` → `5m` / `1h` (falls back to `formatDuration`).
- Cost: `$` + `toFixed(2)`.

### Input (`src/input.ts`)
- `StatusInput.costUsd?: number` from `cost.total_cost_usd` via `num()` (numeric strings accepted,
  like every other field); rejected when negative.
- Session row without a name is omitted, as the line's `session` segment does today.

### Command (`src/commands/details.ts`)
- `runDetails(env, io, now = new Date()): number`, loaded by `cli.ts` with dynamic `import()`
  like `init`/`uninstall`; `CLI.commands.details = "details"` and a usage line.
- Flow: validate `env.CLAUDE_CODE_SESSION_ID` → read snapshot (`statSync` for mtime +
  `readFileSync`) → `parseStatusInput(raw)` → build `RenderContext` (`claudeDir`, `now`, ansi
  from `isColorDisabled(env)`, real `runGit`) → `loadConfig(dir)` → for each enabled segment in
  `SEGMENTS`, call `detail` in a `try/catch` (a throwing segment just contributes nothing, as in
  `render`) → append the cost row → pad labels to the longest → print header + rows.
- Errors (no id / no snapshot / snapshot not an object) → one line to stderr from `constants.ts`,
  exit 1. No rows → header + dim `no data`, exit 0.
- The pure part (`formatDetails(rows, ageSec, ansi): string`) is separated from I/O for tests.

## Risks / Trade-offs

- [Extra disk write on every render] → one small atomic write (~2–4 KB) plus a `readdir` of a
  directory with one file per recent session; failures are swallowed. Measured cost is expected
  to be well under the git calls already made.
- [Snapshot is stale by up to one render interval] → the header shows `updated <age> ago`.
- [`CLAUDE_CODE_SESSION_ID` is an undocumented env var] → clear error when missing; same
  best-effort stance as `sessions/*.json`.
- [Snapshot contains `cwd`, transcript path, cost] → stored under the user's own `claudeDir`
  with default permissions, like Claude Code's own files; pruned after 7 days.
- [Concurrent renders of the same session] → atomic rename; last writer wins.
- [Git / transcript reads at `details` time reflect "now", while quotas reflect the snapshot] →
  acceptable: git and cache are read live, which is more accurate.

## Migration Plan

Additive. First render after upgrading creates the directory. Rollback: downgrade; the leftover
`<claudeDir>/statusbar/` directory is harmless (and `uninstall` does not need to touch it — calls
it out in the README instead).

## Open Questions

None blocking. Left to the builder: exact ANSI colors per value beyond the rule above, and
helper names.
