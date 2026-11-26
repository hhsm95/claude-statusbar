## ADDED Requirements

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
