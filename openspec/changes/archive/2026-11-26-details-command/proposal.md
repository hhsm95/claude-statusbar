## Why

The status line is one terminal line that shortens branch names, drops bars and rounds tokens to
fit; Claude Code's `statusLine` has no hover, tooltip or scroll, and the process exits after
printing. There is no way today to see the full detail behind the line (exact reset times, full
token counts, cache TTL, untruncated git names). A `details` command, run inside Claude Code as
`! claude-statusbar details`, fills that gap.

## What Changes

- The render path saves the raw stdin JSON it received as a per-session snapshot under
  `<claudeDir>/statusbar/snapshots/<session_id>.json` (atomic write, best-effort, never affects
  the printed line), and removes snapshots older than 7 days.
- New `claude-statusbar details` command: finds the current session through the
  `CLAUDE_CODE_SESSION_ID` env var (present in Claude Code's `!` bash mode and Bash tool), loads
  that session's snapshot, and prints one labeled row per enabled segment with the full,
  untruncated detail, plus a header with the snapshot age and a details-only `Cost` row.
- `Segment` gains an optional `detail(ctx)` method next to `render(ctx)`; every existing segment
  implements it.
- `StatusInput` gains the session cost (`cost.total_cost_usd`).
- `--help` usage lists the new command.

## Capabilities

### New Capabilities
- `details-command`: the `details` subcommand — session lookup, snapshot loading, row content
  per segment, header, cost row, errors and exit codes.

### Modified Capabilities
- `statusline-render`: the renderer also writes the per-session snapshot (and prunes old ones)
  without changing its output or its never-fail guarantee.

## Impact

- Code: `src/cli.ts` (snapshot write after render, `details` dispatch via dynamic `import()`),
  new `src/snapshot.ts`, new `src/commands/details.ts`, `src/segments/types.ts` (`DetailRow`,
  `Segment.detail`), all files in `src/segments/`, `src/input.ts` (cost), `src/format/time.ts`
  (durations), `src/constants.ts` (labels, strings, paths, retention).
- Disk: one small JSON file per active session in `<claudeDir>/statusbar/snapshots/`.
- No new runtime dependencies. Docs: README (command + usage), CHANGELOG.
