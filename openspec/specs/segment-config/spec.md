# segment-config Specification

## Purpose
TBD - created by archiving change initial-release. Update Purpose after archive.
## Requirements
### Requirement: Claude directory resolution
The Claude directory SHALL be `$CLAUDE_CONFIG_DIR` when set and non-empty, otherwise
`<home>/.claude` using `os.homedir()`. The config file SHALL be `<claudeDir>/statusbar.json` and
Claude Code's settings SHALL be `<claudeDir>/settings.json`.

#### Scenario: Custom config dir
- **WHEN** `CLAUDE_CONFIG_DIR=/tmp/cc`
- **THEN** the config path is `/tmp/cc/statusbar.json`

### Requirement: Segment toggles
The config file SHALL be a JSON object with a `segments` object mapping segment ids (`model`,
`effort`, `session`, `git`, `fiveHour`, `sevenDay`, `context`) to booleans. A segment set to
`false` SHALL not be computed or printed. Missing ids SHALL default to `true`.

#### Scenario: Git disabled
- **WHEN** the config is `{"segments":{"git":false}}`
- **THEN** no git command is run and the git segment is absent, while the rest render

#### Scenario: Partial config
- **WHEN** the config only contains `{"segments":{"effort":false}}`
- **THEN** every segment except effort is enabled

### Requirement: Tolerant config loading
A missing file, invalid JSON, a non-object root, unknown keys or non-boolean values SHALL NOT
break rendering: missing or invalid content falls back to all segments enabled, unknown keys are
ignored and non-boolean toggles count as missing.

#### Scenario: Corrupt config
- **WHEN** `statusbar.json` contains `{oops`
- **THEN** the status line renders with all segments enabled

#### Scenario: Unknown segment id
- **WHEN** the config contains `{"segments":{"weather":true,"model":false}}`
- **THEN** `weather` is ignored and model is hidden

