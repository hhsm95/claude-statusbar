## MODIFIED Requirements

### Requirement: Segment toggles
The config file SHALL be a JSON object with a `segments` object mapping segment ids (`model`,
`effort`, `session`, `git`, `fiveHour`, `sevenDay`, `context`, `cache`) to booleans. A segment set to
`false` SHALL not be computed or printed. Missing ids SHALL default to `true`.

#### Scenario: Git disabled
- **WHEN** the config is `{"segments":{"git":false}}`
- **THEN** no git command is run and the git segment is absent, while the rest render

#### Scenario: Partial config
- **WHEN** the config only contains `{"segments":{"effort":false}}`
- **THEN** every segment except effort is enabled

#### Scenario: Cache disabled
- **WHEN** the config is `{"segments":{"cache":false}}`
- **THEN** the transcript is not read and the cache segment is absent
