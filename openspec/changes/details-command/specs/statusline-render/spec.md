## ADDED Requirements

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
