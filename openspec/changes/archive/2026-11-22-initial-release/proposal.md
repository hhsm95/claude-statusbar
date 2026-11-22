## Why

The author's Claude Code status line (`~/.claude/statusline.sh`) shows model, effort, session
name, git state, the 5h / 7d quota windows and context usage. It only lives on one machine, only
runs on macOS (BSD `date -r`), and needs `jq` and `bash`. Packaging it as a cross-platform npm CLI
lets the author install it on any machine and lets other Claude Code users adopt it, choosing which
segments to show.

## What Changes

- New npm package `claude-statusbar` (global install) exposing a `claude-statusbar` binary that
  works on macOS, Linux and Windows with Node ≥ 20 and no runtime dependencies on the render path.
- Port of every existing segment from the bash script to TypeScript, with the same output: model,
  effort, session name, git (branch or short sha, linked worktree, commits ahead of base), 5h and
  7d quota windows (bar, percentage, reset time) and context tokens used over total.
- Per-segment on/off configuration in a JSON file next to Claude Code's settings.
- `claude-statusbar init`: interactive (or `--yes`) setup that writes the config and the
  `statusLine` entry of Claude Code's `settings.json`, keeping any previous status line so it can
  be restored.
- `claude-statusbar uninstall`: removes (or restores) the `statusLine` entry.
- User-facing strings and date format in English (the bash script used Spanish).
- Public GitHub repository with README, MIT license, CONTRIBUTING guide (fork + PR, one file per
  segment), issue/PR templates, CHANGELOG, CI on the three OSes and a tag-triggered npm release.

## Capabilities

### New Capabilities
- `statusline-render`: reading Claude Code's stdin JSON and printing the status line, including
  every segment's behavior, colors, separators and failure tolerance.
- `segment-config`: the configuration file, its location, defaults and how invalid content is
  handled.
- `cli-setup`: the `init`, `uninstall`, `--help` and `--version` commands and how they edit Claude
  Code's `settings.json`.

### Modified Capabilities
<!-- none: new repository -->

## Impact

- New repository `github.com/hhsm95/claude-statusbar` and npm package `claude-statusbar`.
- Dev dependencies: TypeScript, tsx, Biome, `@types/node`. Runtime dependency used only by `init`:
  `@inquirer/prompts` (loaded lazily).
- Reads `~/.claude/sessions/*.json` (an undocumented Claude Code internal) for the session name;
  the segment degrades to hidden if the format changes.
- The author's own machine keeps `~/.claude/statusline.sh` until they run `init`.
