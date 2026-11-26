# details-command Specification

## Purpose
How `claude-statusbar details` shows the full, untruncated detail behind the status line from
inside Claude Code: how it finds the current session's snapshot, how it picks the freshest quota
across all sessions' snapshots, the rows each segment contributes, the layout, and its errors and
exit codes.
## Requirements
### Requirement: Session lookup
`claude-statusbar details` SHALL identify the session from the `CLAUDE_CODE_SESSION_ID`
environment variable and load `<claudeDir>/statusbar/snapshots/<id>.json`, parsing it with the
same rules as the render input. It SHALL NOT read stdin.

#### Scenario: Outside Claude Code
- **WHEN** `CLAUDE_CODE_SESSION_ID` is unset, empty or not a safe session id
- **THEN** a message explaining to run it from Claude Code as `! claude-statusbar details` goes to
  stderr and the exit code is 1

#### Scenario: No snapshot yet
- **WHEN** the session id is valid but its snapshot file is missing or is not a JSON object
- **THEN** a message saying there is no status data for this session yet goes to stderr and the
  exit code is 1

#### Scenario: Snapshot found
- **WHEN** the snapshot exists and is a JSON object
- **THEN** the details are printed to stdout and the exit code is 0

### Requirement: Details layout
The output SHALL start with a header `claude-statusbar details · updated <age> ago`, where
`<age>` is the time since the snapshot file was last modified. It SHALL then print one row per
detail line as `<label> <value>`, with labels left-aligned and padded to the longest label
printed. Rows SHALL follow the segment registry order, SHALL include only segments enabled in
`statusbar.json`, and SHALL omit rows whose data is missing. No value SHALL be truncated and no
bar SHALL be drawn. Colors SHALL follow the same `NO_COLOR` rule as the renderer. Every line SHALL
end with `\n`.

#### Scenario: Disabled segment
- **WHEN** `sevenDay` is disabled in `statusbar.json`
- **THEN** no `7d limit` row is printed

#### Scenario: Missing data
- **WHEN** the snapshot has no `rate_limits`
- **THEN** neither `5h limit` nor `7d limit` rows are printed and the other rows still are

#### Scenario: Nothing to show
- **WHEN** no row has data
- **THEN** only the header and a dim `no data` line are printed, with exit code 0

### Requirement: Durations
Relative times SHALL be written with the two largest non-zero units among days, hours, minutes
and seconds (`4s`, `12m`, `2h 12m`, `5d 6h`), with `0s` for zero.

#### Scenario: Two units
- **WHEN** the duration is 2 hours, 12 minutes and 40 seconds
- **THEN** it is written `2h 12m`

### Requirement: Segment rows
Each segment SHALL contribute these rows when its data is present:
- `model` → `Model`: the model display name.
- `effort` → `Effort`: the effort level.
- `session` → `Session`: the session name, plus `· started <start>` when the start time is known
  (same start format as the line).
- `git` → `Git`: the full branch name (or short hash when detached), plus `· ↑<n>` when ahead of
  the base; and `Worktree`: the full worktree directory name, only in a linked worktree.
- `fiveHour` / `sevenDay` → `5h limit` / `7d limit`: `<pct>% · resets <reset> (in <duration>)`,
  where `<reset>` uses the line's reset format; when the reset time has passed the value is
  `0% · reset passed`; without a reset time it is just `<pct>%`.
- `context` → `Context`: with token counts,
  `<used> / <size> tokens (<pct>%) · in <input> · out <output>` using full numbers with `,`
  thousands separators (`out` omitted when unknown); with only a percentage, `<pct>%`.
- `cache` → `Cache`: with the last request known, while warm
  `warm · TTL <ttl> · expires <HH:MM> (in <duration>) · <prompt> prompt tokens`, and once expired
  `expired <HH:MM> (<duration> ago) · <prompt> tokens to re-cache`, where `<ttl>` is `5m` or
  `1h` and `<prompt>` uses the line's short token format. Unlike the line, the row is shown
  whenever the last request is known, not only near expiry.

#### Scenario: Long branch is not truncated
- **WHEN** the branch is `feat/details-command-with-a-very-long-name`
- **THEN** the `Git` row contains the whole name

#### Scenario: Reset in the future
- **WHEN** the 5h window is at 37% and resets 2h 12m from now
- **THEN** the row reads `5h limit` and `37% · resets <HH:MM> (in 2h 12m)`

#### Scenario: Cache far from expiry
- **WHEN** the last request has a 1h TTL and expires in 48 minutes
- **THEN** a `Cache` row with `warm · TTL 1h · expires <HH:MM> (in 48m)` is printed, although the
  line itself hides the cache segment

### Requirement: Cost row
When the snapshot has a finite, non-negative `cost.total_cost_usd`, a `Cost` row SHALL be printed
after the segment rows as `$<amount>` with two decimals. It is not a segment and is not affected
by `statusbar.json`.

#### Scenario: Cost present
- **WHEN** `cost.total_cost_usd` is `3.4219`
- **THEN** the last row reads `Cost` and `$3.42`

### Requirement: Freshest quota across sessions
The 5h and 7d quota shown by `details` SHALL be chosen, independently for each window, among the
windows with a used percentage found in every snapshot under `<claudeDir>/statusbar/snapshots/`,
including the current session's. The window with the latest reset time SHALL win; among windows
with the same reset time, the highest used percentage SHALL win; a window without a reset time
SHALL rank below any window that has one. Snapshot files that cannot be read or parsed SHALL be
skipped. When no snapshot has a used percentage for a window, that window SHALL come from the
current session's snapshot. All other rows and the header SHALL still come from the current
session's snapshot only. The status line render SHALL NOT change.

#### Scenario: Stale session, fresher sibling
- **WHEN** the current snapshot has the 5h window at 48% resetting at 23:10 and another snapshot
  has it at 78% with the same reset time
- **THEN** the `5h limit` row shows 78%

#### Scenario: Newer window wins over a higher old one
- **WHEN** one snapshot has the 5h window at 95% resetting at 18:00 and another at 10% resetting
  at 23:10
- **THEN** the `5h limit` row shows 10% and resets at 23:10

#### Scenario: Windows chosen independently
- **WHEN** snapshot A has the freshest 5h window and snapshot B the freshest 7d window
- **THEN** the `5h limit` row comes from A and the `7d limit` row from B

#### Scenario: Unreadable sibling
- **WHEN** another file in the snapshots directory is not valid JSON
- **THEN** it is ignored and the details are printed normally

#### Scenario: No quota anywhere
- **WHEN** no snapshot has `rate_limits`
- **THEN** neither `5h limit` nor `7d limit` rows are printed

