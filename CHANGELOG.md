# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
