## MODIFIED Requirements

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
