# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `details` takes the 5h and 7d quota from the freshest snapshot of any session (latest reset
  time, then highest usage) instead of only the current session's, which Claude Code can leave
  outdated while the session is idle.

## [0.4.0] - 2026-11-25

### Added

- `claude-statusbar details` prints the full, untruncated values behind the status line (model,
  effort, session, git, quota windows with reset times, context, cache and session cost). Run it
  inside Claude Code as `! claude-statusbar details`.
- Each render saves a per-session snapshot of Claude Code's JSON in
  `<claude dir>/statusbar/snapshots/`, pruned after 7 days.

## [0.3.0] - 2026-11-25

### Added

- The line fits narrow terminals: using the width Claude Code passes in `COLUMNS`, it first
  truncates long git branch and worktree names with `…`, then drops the quota bars (keeping the
  percentages), and wraps onto more lines when even that does not fit. Without `COLUMNS` the
  output is unchanged.

## [0.2.0] - 2026-11-23

### Added

- `cache` segment: warns before the prompt cache expires from inactivity (`⏱ cache <n>m`) and,
  once expired, shows how many tokens the next message will re-write (`⚠ cache expired · <n> tok`).
  It detects the 1-hour or 5-minute cache lifetime from the session transcript.
- The `session` segment shows the session start time: `◉ <name> · HH:MM`.

## [0.1.2] - 2026-11-22

### Fixed

- `claude-statusbar init` on Node.js older than 22.13 now exits with a message asking to update
  Node.js, instead of failing with `The requested module 'node:util' does not provide an export
  named 'styleText'`. `engines.node` is now `>=22.13`, the minimum `@inquirer/prompts` requires.

## [0.1.1] - 2026-11-22

### Changed

- Package published as `@hhsm95/claude-statusbar` (npm rejected the unscoped name as too similar
  to an existing package). The command is still `claude-statusbar`.
- Releases are published from GitHub Actions through npm Trusted Publishing, with provenance.

## [0.1.0] - 2026-11-22

### Added

- `claude-statusbar` command that renders Claude Code's status line from the JSON on stdin, on
  macOS, Linux and Windows, with no runtime dependencies on the render path.
- Segments: model, effort, session name, git (branch or short sha, linked worktree, commits ahead
  of base), 5h and 7d quota windows (bar, percentage, reset time) and context tokens.
- Per-segment on/off configuration in `statusbar.json`, located in `$CLAUDE_CONFIG_DIR` or
  `~/.claude`.
- `claude-statusbar init` (interactive or `--yes`) to write the config and the `statusLine` entry
  of `settings.json`, keeping any previous status line.
- `claude-statusbar uninstall` to restore the previous status line or remove the entry.
- `--help` and `--version` flags.
- `NO_COLOR` support.
- CI on Linux, macOS and Windows with Node 22 and 24, and a tag-triggered npm release with
  provenance.
