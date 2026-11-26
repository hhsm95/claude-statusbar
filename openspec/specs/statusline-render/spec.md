# statusline-render Specification

## Purpose
How `claude-statusbar` turns Claude Code's status line JSON on stdin into the printed line: the
segments, their order, format and colors, how the line fits the terminal width, and the
guarantee that rendering never fails.
## Requirements
### Requirement: Render from stdin
Running `claude-statusbar` with no arguments SHALL read Claude Code's status line JSON from stdin
and print one line made of the enabled, non-empty segments joined by a dim ` │ ` separator, in
this fixed order: model, effort, session, git, 5h window, 7d window, context, cache.

#### Scenario: All data present
- **WHEN** stdin contains model, effort, session id, workspace dir, both rate limit windows and
  context window fields, and every segment is enabled
- **THEN** the output contains those seven segments in the fixed order separated by ` │ `, and the
  cache segment follows context only when it is in its warning or expired state

#### Scenario: Segment without data is skipped
- **WHEN** stdin has no `effort.level`
- **THEN** the effort segment and its separator do not appear

### Requirement: Never fail
The renderer SHALL exit with code 0 and print a line for any stdin content, including empty
input, invalid JSON or unexpected field types. When no segment produces output it SHALL print a
dim `no data`.

#### Scenario: Invalid JSON
- **WHEN** stdin is `not json`
- **THEN** the process prints a dim `no data` and exits 0

#### Scenario: Wrong field type
- **WHEN** `context_window.total_input_tokens` is `"abc"` or an object
- **THEN** the field is treated as missing and the other segments still render

#### Scenario: Numeric string accepted
- **WHEN** `context_window.total_input_tokens` is `"150000"`
- **THEN** it is read as the number 150000

#### Scenario: Line ending
- **WHEN** any line is printed, including `no data`
- **THEN** it ends with a single `\n`

### Requirement: Model and effort segments
The model segment SHALL print `model.display_name` in bold. The effort segment SHALL print
`effort.level` in dim color (ANSI 256 code 244).

#### Scenario: Model shown in bold
- **WHEN** `model.display_name` is `Opus 5.5`
- **THEN** the model segment is `Opus 5.5` wrapped in bold and reset codes

### Requirement: Session name segment
The session segment SHALL print `◉ <name>` in dim color, where `<name>` is the `name` field of the
first JSON file, by filename sorted ascending, in `<claudeDir>/sessions/` whose `sessionId` equals stdin's `session_id`. When that file
also has a numeric `startedAt` (epoch milliseconds), the segment SHALL print
`◉ <name> · <start>` in dim color, where `<start>` is the local start time as `HH:MM` when it is
less than 24 hours before `now`, and `DD Mon HH:MM` otherwise. Missing
directory, unreadable or malformed files, or no match SHALL hide the segment.

#### Scenario: Matching session file
- **WHEN** `sessions/123.json` contains `{"sessionId":"abc","name":"api-worker"}` and stdin
  `session_id` is `abc`
- **THEN** the segment is `◉ api-worker`

#### Scenario: Start time shown
- **WHEN** the matching file also has `startedAt` 2 hours 45 minutes before `now`, at 09:15 local
- **THEN** the segment is `◉ api-worker · 09:15`

#### Scenario: Start time from an earlier day
- **WHEN** `startedAt` is 3 days before `now`, on 17 Nov at 09:15 local
- **THEN** the segment is `◉ api-worker · 17 Nov 09:15`

#### Scenario: Malformed file is ignored
- **WHEN** one session file is invalid JSON and another matches
- **THEN** the matching file's name is shown

### Requirement: Git segment
The git segment SHALL use `workspace.current_dir` (falling back to `cwd`) and, when it is inside a
git work tree, print `⎇ <branch>` (ANSI 250); the short sha instead of the branch when HEAD is
detached; ` ⌂ <worktree-folder>` (dim) when it is a linked worktree; and ` ↑<n>` (ANSI 114) when
HEAD is n > 0 commits ahead of the base. The base SHALL be resolved as: `origin/HEAD`'s target,
preferring the local branch of the same name if it exists; else local `main`, else local
`master`; else the upstream `@{u}`. No base means no ahead count. Git missing, a non-repo dir, or
any git error SHALL hide the segment (or the affected part); each git call has its own 1 s
timeout, so a stalled call delays the line by at most that per call.

#### Scenario: Feature branch ahead of main
- **WHEN** the dir is a repo on branch `feat/x` with 2 commits not in `main`
- **THEN** the segment is `⎇ feat/x ↑2`

#### Scenario: Detached HEAD in a linked worktree
- **WHEN** the dir is a linked worktree folder `wt-a` with detached HEAD at sha `1a2b3c4`
- **THEN** the segment is `⎇ 1a2b3c4 ⌂ wt-a`

#### Scenario: Not a repository
- **WHEN** the dir is not inside a git work tree
- **THEN** the git segment is hidden

### Requirement: Quota window segments
Each quota window segment SHALL, for `rate_limits.five_hour` (label `5h`) and
`rate_limits.seven_day` (label `7d`) with a `used_percentage`, print `<label> <bar> <pct>%` and, when `resets_at` is
present and in the future, ` ↺<time>` in dim. The bar has 10 cells, `round(pct / 10)` filled
(`▓`) clamped to 0–10, the rest `░`, computed from the clamped raw `used_percentage` and not from
the rounded printed value (74.6 gives 7 cells and prints 75%). Rounding uses half-up
(`Math.round`), which may differ by one from the bash script's `printf` on exact .5 values. The printed percentage is `used_percentage` clamped to
0–100 and rounded to an integer, and that printed value drives the color: green (22) below 70,
orange (214) from 70 and red (196) from 90 (the bash script truncated for color; this port
intentionally uses the displayed number). A window without `used_percentage` SHALL be hidden even
if `resets_at` exists. A `resets_at` at or before now SHALL render the window as 0% with no reset
mark. The reset time is local `HH:MM` when `resets_at - now < 86400` seconds, otherwise
`DD Mon HH:MM` with English three-letter months.

#### Scenario: Rounded value drives color
- **WHEN** `used_percentage` is 69.6
- **THEN** the segment prints `70%` in orange (214)

#### Scenario: Warning level with near reset
- **WHEN** `five_hour.used_percentage` is 74 and `resets_at` is 3 hours ahead at 16:59 local
- **THEN** the segment is `5h ▓▓▓▓▓▓▓░░░ 74% ↺16:59` with bar and percentage in color 214

#### Scenario: Far reset
- **WHEN** `seven_day.resets_at` is 3 days ahead on 18 Nov at 07:59 local
- **THEN** the reset mark is `↺18 Nov 07:59`

#### Scenario: Expired window
- **WHEN** `resets_at` is in the past and `used_percentage` is 95
- **THEN** the segment is `5h ░░░░░░░░░░ 0%` in green with no reset mark

#### Scenario: No quota data
- **WHEN** `rate_limits` is absent
- **THEN** both window segments are hidden

### Requirement: Context segment
The context segment SHALL print, when `context_window.total_input_tokens` and
`context_window_size` are present, `<used>/<size>` where used is input plus output tokens, both humanized
(`< 1000` as integer, `< 10000` as one-decimal `K`, `< 999500` as integer `K`, otherwise `M` with
at most one decimal). Color is dim below 80% of size, orange (214) from 80 and red (196) from 90.
A missing `total_output_tokens` counts as 0. The color uses the rounded percentage of used over
size. Without token counts, or with `context_window_size` ≤ 0, but with `used_percentage`, it
SHALL print `ctx <pct>%` (rounded) in dim; with neither the segment is hidden.

#### Scenario: Zero window size
- **WHEN** `context_window_size` is 0 and `used_percentage` is 10
- **THEN** the segment is `ctx 10%`

#### Scenario: Token counts
- **WHEN** input is 150000, output is 13000 and size is 200000
- **THEN** the segment is `163K/200K` in orange

#### Scenario: Humanize boundaries
- **WHEN** values are 999, 16700, 163000 and 1000000
- **THEN** they render as `999`, `17K`, `163K` and `1M` (1500 renders as `1.5K`)

#### Scenario: Percentage fallback
- **WHEN** only `used_percentage` 42 is present
- **THEN** the segment is `ctx 42%`

### Requirement: Disable colors
When the `NO_COLOR` environment variable is set to a non-empty value the output SHALL contain no
ANSI escape sequences.

#### Scenario: NO_COLOR set
- **WHEN** `NO_COLOR=1` and all data is present
- **THEN** the output contains no `\x1b[` sequence

### Requirement: Fit to terminal width
The renderer SHALL read the terminal width from the `COLUMNS` environment variable. A value that
is not a positive integer, or a missing variable, SHALL mean "width unknown", and the line SHALL be
printed exactly as it would be without this requirement. With a known width, the available width
SHALL be `COLUMNS` minus a fixed safety margin of 2 columns, and the visible width of the line
SHALL be measured on its text without ANSI sequences, counting the separators and counting the
glyphs `⏱` and `⚠` as 2 columns and every other code point as 1.

When the full line is wider than the available width, the renderer SHALL shorten it in this order
and stop at the first step that fits:

1. Truncate the git branch name (or detached short sha) and the worktree folder name. Both share
   one length cap: a name longer than the cap is cut to its first `cap - 1` code points followed
   by `…`; a name at or under the cap is unchanged. The cap SHALL be the largest value that makes
   the line fit, and SHALL NOT go below 8 columns (including the `…`).
2. Remove the progress bar of the 5h and 7d window segments, together with its leading space,
   keeping the label, percentage and reset mark; then apply the name cap again, starting from the
   full names, choosing the largest cap (not below 8) that fits.
3. If the line still does not fit, take its most compact form (bars removed, names at the minimum
   cap) and wrap it onto several lines: segments are placed in order, and a segment starts a new
   line when adding it (with its ` │ `) would exceed the available width. Separators appear only
   between segments of the same line, never at a line start or end. A segment wider than the
   available width on its own SHALL take a line by itself and overflow it. Lines are joined with
   `\n` and the output still ends with a single `\n`. No segment SHALL be hidden because of width.

Only the git branch and worktree names SHALL be truncated; the `⎇`/`⌂` glyphs, the `↑<n>` ahead
count and every other segment SHALL keep their text. Colors SHALL be the same as in the
unshortened line.

#### Scenario: Width unknown
- **WHEN** `COLUMNS` is unset, `abc`, `0` or `-5`, and the line is 140 columns wide
- **THEN** the output is identical to the output without width handling

#### Scenario: Line fits
- **WHEN** `COLUMNS` is 200 and the full line is 90 columns wide
- **THEN** the output is identical to the output without width handling

#### Scenario: Long branch truncated first
- **WHEN** the branch is `feat/responsive-statusline-width-aware`, both windows have bars, and
  the line is 20 columns too wide for the available width
- **THEN** the branch is cut to the largest cap that fits and ends in `…`, and both bars are still
  shown

#### Scenario: Branch and worktree share the cap
- **WHEN** the branch name is 30 code points, the worktree folder is 12, and the cap that fits is 14
- **THEN** the branch prints as its first 13 code points plus `…` and the worktree folder prints
  unchanged

#### Scenario: Bars dropped when names hit the minimum
- **WHEN** even with both names at 8 columns the line does not fit, but it fits without the bars
- **THEN** both bars and their leading spaces are removed, the percentages remain, and the names
  use the largest cap that fits without bars (which may be their full length)

#### Scenario: Too narrow wraps
- **WHEN** `COLUMNS` is 30 and the most compact line is 60 columns wide
- **THEN** the output is that compact form (no bars, names at 8 columns) split into lines of at
  most 28 columns, filled in segment order, with no separator at any line start or end, and no
  segment is hidden

#### Scenario: Segment wider than a line
- **WHEN** one segment alone is wider than the available width and wrapping is needed
- **THEN** that segment takes its own line and overflows it, and the following segments continue
  on the next line

#### Scenario: Short names are never cut
- **WHEN** HEAD is detached at `1a2b3c4` and the line does not fit
- **THEN** the sha prints unchanged, and the shortening goes on to removing the bars

#### Scenario: ANSI codes do not count
- **WHEN** colors are on and the visible text exactly fills the available width
- **THEN** the line is printed unshortened

### Requirement: Session snapshot
The renderer SHALL save the stdin JSON when it is a JSON object whose `session_id` is a string
of 1–128 characters from `[A-Za-z0-9_-]`. It SHALL store it, unchanged, at
`<claudeDir>/statusbar/snapshots/<session_id>.json` using an atomic write (temp file plus
rename), replacing any previous snapshot of that session. When the write created a file that did
not exist before (a new session), it SHALL then delete every `*.json` file in that directory
whose modification time is more than 7 days old. Any failure while saving or pruning SHALL be ignored: the printed
line and the exit code SHALL be exactly what they would be without the snapshot.

#### Scenario: Snapshot written
- **WHEN** stdin is `{"session_id":"abc-123","model":{"display_name":"Opus 5.5"}}`
- **THEN** `<claudeDir>/statusbar/snapshots/abc-123.json` contains that same JSON object

#### Scenario: Unsafe session id
- **WHEN** `session_id` is `../../settings` or is missing
- **THEN** no snapshot is written and the line renders as usual

#### Scenario: Old snapshots pruned
- **WHEN** the snapshots directory holds a snapshot last modified 8 days ago and one modified
  1 day ago
- **THEN** after the first render of a new valid `session_id` the 8-day-old one is gone and the
  1-day-old one remains

#### Scenario: No pruning on repeat renders
- **WHEN** the session's snapshot already exists and an 8-day-old snapshot is present
- **THEN** rendering again overwrites the session's snapshot and leaves the old one in place

#### Scenario: Unwritable directory
- **WHEN** `<claudeDir>/statusbar` cannot be created or written
- **THEN** the line prints normally and the exit code is 0

