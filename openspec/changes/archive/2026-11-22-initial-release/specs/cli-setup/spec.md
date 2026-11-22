## ADDED Requirements

### Requirement: Init command
`claude-statusbar init` SHALL ask, with a checkbox prompt pre-filled from the current config (or
all enabled), which segments to enable; write `statusbar.json`; and set `statusLine` in
`settings.json` to `{"type":"command","command":"claude-statusbar","padding":0,
"refreshInterval":30}`, preserving every other key of `settings.json`. It SHALL create the Claude
directory and `settings.json` when missing, and print the paths it wrote.

#### Scenario: Fresh machine
- **WHEN** no `settings.json` exists and the user keeps all segments
- **THEN** `settings.json` contains only the `statusLine` entry and `statusbar.json` has all
  seven segments set to `true`

#### Scenario: Existing settings preserved
- **WHEN** `settings.json` has `{"model":"opus","hooks":{...}}`
- **THEN** after init those keys are unchanged and `statusLine` is added

### Requirement: Previous status line kept
Init SHALL, when `settings.json` already has a `statusLine` whose `command` is not
`claude-statusbar`, ask for confirmation before replacing it (`--yes` confirms) and SHALL store the previous
value under `previousStatusLine` in `statusbar.json`. If already pointing to `claude-statusbar`,
init SHALL keep any existing `previousStatusLine` and keep the entry's other fields (for example
a custom `refreshInterval` or `padding`), only ensuring `type` and `command`.

#### Scenario: Re-running init keeps custom fields
- **WHEN** `statusLine` is `{"type":"command","command":"claude-statusbar","refreshInterval":10}`
- **THEN** after init `refreshInterval` is still 10

#### Scenario: Replacing a custom script
- **WHEN** `statusLine.command` is `~/.claude/statusline.sh` and the user confirms
- **THEN** `statusLine.command` becomes `claude-statusbar` and `statusbar.json`
  `previousStatusLine.command` is `~/.claude/statusline.sh`

#### Scenario: User declines replacement
- **WHEN** the user answers no
- **THEN** neither file is modified and the command exits 0 with a message

### Requirement: Non-interactive init
`claude-statusbar init --yes` SHALL run without prompts, enabling the segments from the existing
config (or all), confirming replacement, and SHALL also be used automatically when stdin is not a
TTY.

#### Scenario: Scripted install
- **WHEN** `init --yes` runs in CI
- **THEN** both files are written without waiting for input

### Requirement: Invalid settings file
If `settings.json` exists but is not a valid JSON object, init and uninstall SHALL abort with
exit code 1 and an error naming the file, without modifying it.

#### Scenario: Corrupt settings
- **WHEN** `settings.json` contains `{,}`
- **THEN** init exits 1 and the file is byte-for-byte unchanged

### Requirement: Uninstall command
`claude-statusbar uninstall` SHALL, when `statusLine.command` is `claude-statusbar`, replace it
with `previousStatusLine` from `statusbar.json` if present, or delete `statusLine` otherwise. It
SHALL leave `settings.json` untouched when `statusLine` points elsewhere, and SHALL keep
`statusbar.json` on disk with `previousStatusLine` removed after restoring it.

#### Scenario: Restore previous
- **WHEN** a previous status line was stored
- **THEN** `settings.json` `statusLine` equals the stored value after uninstall and
  `statusbar.json` no longer has `previousStatusLine`

#### Scenario: Not installed
- **WHEN** `statusLine.command` is another command
- **THEN** uninstall reports nothing to do and does not write the file

### Requirement: Help and version
`--help`/`-h` SHALL print usage for the render mode and every command; `--version`/`-v` SHALL
print the package version. An unknown command SHALL print usage to stderr and exit 1.

#### Scenario: Unknown command
- **WHEN** running `claude-statusbar foo`
- **THEN** usage goes to stderr and the exit code is 1
