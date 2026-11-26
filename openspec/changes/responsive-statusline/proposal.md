## Why

The status line is printed at full length whatever the terminal width, so in a narrow window it
overflows on the right and the last segments (quota windows, context, cache) are cut off. Long git
branch and worktree names are what usually push it over. A spike on 2026-11-25 measured that
Claude Code passes the live terminal width to the status line process as the `COLUMNS`
environment variable (updated on resize, verified in Warp and macOS Terminal.app), so the line can
now adapt to the space it has.

## What Changes

- The renderer reads `COLUMNS` and, when the full line does not fit, shortens it in this order:
  1. truncate the git branch and worktree names with `…`, sharing one length cap, down to a
     minimum length;
  2. if that is not enough, drop the 10-cell progress bars of the 5h and 7d windows, keeping the
     percentages, and let the names grow back to whatever length now fits;
  3. if even that does not fit, wrap that most compact form onto several lines, filled in segment
     order, instead of overflowing on the right (no segment is ever hidden for lack of space).
- Without a valid `COLUMNS` (missing, non-numeric, ≤ 0), or when the line fits, the output is
  byte-identical to today's.
- Segments return typed pieces (fixed text, truncatable name, droppable bar) instead of a finished
  string, so a single pure layout function decides the fitting. This is an internal contract change
  for segment authors; no user-facing config is added.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `statusline-render`: adds the requirement that the line fits the terminal width reported in
  `COLUMNS` by truncating git names first and then dropping progress bars, and otherwise renders
  exactly as before.

## Impact

- `src/segments/types.ts`: `Segment.render` returns pieces instead of a string; piece types and
  constructors live here.
- All 8 segments in `src/segments/` and `src/segments/window.ts` build pieces.
- New pure layout module (`src/layout.ts`) for width measurement and fitting.
- `src/render.ts` and `src/cli.ts`: read `COLUMNS` and pass it to the layout.
- `src/constants.ts`: `COLUMNS` env name, minimum name length, width margin, ellipsis, wide glyphs.
- Tests: segment tests render pieces through a helper; new layout tests.
- README (segments/behavior section) and CHANGELOG.
- No new dependencies; render path stays Node built-ins only.
