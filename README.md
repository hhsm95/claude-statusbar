# claude-statusbar

A cross-platform status line for Claude Code: model, effort, session, git, quota windows and context usage, each one switchable.

```text
Opus 5.5 │ high │ ◉ api-worker │ ⎇ feat/x ⌂ wt-a ↑2 │ 5h ▓▓▓▓▓▓▓░░░ 74% ↺16:59 │ 7d ▓▓░░░░░░░░ 21% ↺18 Nov 07:59 │ 163K/200K
```

<!-- TODO: add a screenshot of the colored status line here. -->

## Requirements

- Node.js 22 or newer
- `git` on your `PATH` (optional; without it the git segment is simply hidden)
- macOS, Linux or Windows

## Install

```bash
npm i -g claude-statusbar
claude-statusbar init
```

`init` asks which segments you want (all are pre-selected), writes `statusbar.json` and sets the `statusLine` entry of Claude Code's `settings.json`:

```json
{ "type": "command", "command": "claude-statusbar", "padding": 0, "refreshInterval": 30 }
```

Every other key of `settings.json` is left untouched. If you already had a different status line, `init` asks before replacing it and stores the previous one in `statusbar.json` so `uninstall` can restore it.

For a non-interactive install (CI, scripts, dotfiles) use `claude-statusbar init --yes`. It is also used automatically when stdin is not a TTY.

Other commands: `claude-statusbar --help` / `-h` and `claude-statusbar --version` / `-v`.

## Segments

Segments are always printed in this order, joined by a dim ` │ `. A segment with no data is skipped.

| id | What it shows | Colors / thresholds |
|---|---|---|
| `model` | Model display name, e.g. `Opus 5.5` | bold |
| `effort` | Effort level, e.g. `high` | dim gray |
| `session` | `◉ <session name>` | dim |
| `git` | `⎇ <branch>` (short sha when HEAD is detached), `⌂ <folder>` for a linked worktree, `↑<n>` commits ahead of the base branch | branch light gray, worktree dim, ahead count green |
| `fiveHour` | 5-hour quota window: `5h <bar> <pct>%` plus `↺<reset time>` | green below 70%, orange from 70%, red from 90% |
| `sevenDay` | 7-day quota window, same format with label `7d` | same as above |
| `context` | Tokens used over window size, e.g. `163K/200K`; `ctx <pct>%` when only a percentage is available | dim below 80%, orange from 80%, red from 90% |

Details:

- The bar has 10 cells (`▓` filled, `░` empty). The printed percentage drives the color.
- The reset time is `HH:MM` (local time) when less than 24 hours away, otherwise `DD Mon HH:MM` (for example `18 Nov 07:59`). An already expired window shows 0% and no reset mark.
- The git base branch is `origin/HEAD`'s target (preferring the local branch of the same name), else local `main`, else `master`, else the upstream branch. With no base there is no ahead count.

## Configuration

Settings live in `statusbar.json` inside Claude Code's config directory: `~/.claude/` by default, or `$CLAUDE_CONFIG_DIR` when that variable is set.

```json
{
  "segments": {
    "model": true,
    "effort": false,
    "session": true,
    "git": true,
    "fiveHour": true,
    "sevenDay": true,
    "context": true
  }
}
```

- A segment set to `false` is not computed or printed (a disabled `git` runs no git command).
- Missing ids default to `true`. Unknown keys and non-boolean values are ignored.
- A missing, corrupt or non-object file never breaks rendering: all segments are enabled.
- Set `NO_COLOR` to any non-empty value to print plain text with no ANSI escape sequences.

## Uninstall

```bash
claude-statusbar uninstall
npm rm -g claude-statusbar
```

`uninstall` restores the previous status line if `init` stored one, or removes the `statusLine` entry otherwise. If `statusLine` points to something else it does nothing. `statusbar.json` stays on disk.

## Windows notes

- Install with `npm i -g claude-statusbar`; npm creates the `claude-statusbar` shims that Claude Code runs.
- The glyphs (`│ ▓ ░ ◉ ⎇ ⌂ ↑ ↺`) render in Windows Terminal. Legacy consoles may show boxes.
- If `git` is not on your `PATH`, the git segment is hidden.

## Troubleshooting

- **A segment is missing.** Segments with no data are hidden on purpose: for example the quota windows appear only when Claude Code sends `rate_limits`, and git only inside a repository. Also check `statusbar.json` for a `false` toggle.
- **The session name does not show.** It is read on a best-effort basis from `<claude dir>/sessions/*.json`, an undocumented Claude Code internal that may change. If the format changes the segment is hidden rather than breaking anything.
- **The line feels slow in a huge repo or on a network drive.** Each git call has a 1 second timeout. Set `"git": false` in `statusbar.json` to disable the segment.
- **The line shows `no data`.** Claude Code sent nothing usable on stdin, or every segment is disabled or empty.

## Roadmap

Not in 0.1.0, planned or under consideration:

- Configurable segment order
- Configurable colors and thresholds
- Configurable bar width and separator
- Language / i18n

## How it differs from similar tools

Several status line tools exist for Claude Code (for example `cc-statusbar` and `claude-code-statusbar`), and many focus on cost and usage tracking. claude-statusbar focuses on the quota windows with reset times, git worktree and ahead-of-base info, and per-segment toggles, with no runtime dependencies on the render path.

## Contributing

Contributions are welcome, especially new segments. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
