## Context

Source of truth for behavior: the author's `~/.claude/statusline.sh` (bash + jq + git), reproduced
in the `statusline-render` spec. It must become a public, cross-platform npm package. Claude Code
calls the status line command on every session event and every `refreshInterval` seconds, passing
a JSON document on stdin (`model`, `effort`, `session_id`, `workspace`, `cwd`, `context_window`,
`rate_limits`). On Windows Claude Code runs commands through Git Bash or the system shell; npm's
global bin shims (`claude-statusbar`, `.cmd`, `.ps1`) cover both.

Audience: the author on several machines, then other Claude Code users and contributors who add
segments through fork + PR.

## Goals / Non-Goals

**Goals:**
- Same visual output as the bash script (except English strings/dates), on macOS, Linux, Windows.
- Fast render path: only Node built-ins, no network, no cache files.
- Each segment on/off via config; `init` and `uninstall` that edit `settings.json` safely.
- A codebase where adding a segment is one file + one test + one registry line.
- Public repo ready for contributors and a reproducible npm release.

**Non-Goals (roadmap, listed in README):**
- Segment order, colors, thresholds, bar width, separator, language/i18n.
- Themes, multi-line layouts, plugin loading of third-party segments.
- Cost/usage tracking from transcripts (other tools do this).

**Anti-goals:**
- A status line that crashes, prints stack traces or stalls Claude Code's UI.
- `init` that loses or corrupts the user's existing `settings.json`.

## Decisions

### Language and tooling
TypeScript (`strict`, `noUncheckedIndexedAccess`, no `any`), ESM, compiled with `tsc` to `dist/`,
`engines.node >= 22`. Tests with `node:test` run through `tsx` (`node --import tsx --test`). Lint
and format with Biome (one dev dependency instead of ESLint + Prettier + plugins).
Alternatives: plain JS + JSDoc (weaker typing, rejected by user); Bun/pkg single binaries (one
build per OS, ~50 MB, no benefit over npm).

### Module layout (no barrel files)
```
src/
  cli.ts                 argv dispatch: render | init | uninstall | --help | --version
  constants.ts           colors, glyphs, defaults, strings, file names, git timeout
  input.ts               parseStatusInput(raw: string): StatusInput  (typed, tolerant)
  render.ts              render(config, ctx, segments = SEGMENTS): string
  config.ts              paths (claudeDir), loadConfig, defaultConfig, writeConfig
  settings.ts            readSettings / writeSettings (JSON object, 2-space, trailing \n)
  format/ansi.ts         createAnsi(enabled): Ansi (color, dim, bold), isColorDisabled(env)
  format/bar.ts          bar(pct, cells)
  format/tokens.ts       humanTokens(n)
  format/time.ts         formatReset(epochSec, now)  (local time, English months)
  git.ts                 runGit(dir, args): string | null  (execFileSync, timeout)
  segments/types.ts      Segment interface, SegmentId union, RenderContext
  segments/registry.ts   ordered array of all segments
  segments/window.ts     renderWindow(label, window, ctx), shared by the 5h and 7d segments
  segments/model.ts, effort.ts, session.ts, git.ts, five-hour.ts, seven-day.ts, context.ts
  commands/init.ts, commands/uninstall.ts
test/                    mirrors src/, plus helpers.ts, cli-helper.ts and setup.ts
```
`Segment = { id: SegmentId; render(ctx: RenderContext): string | null }`. `RenderContext` carries
the parsed input, `now: Date`, `claudeDir`, `ansi` helpers and `runGit`, so tests inject fakes
instead of touching the real clock, home or git. `fiveHour`/`sevenDay` share the `renderWindow`
helper. Disabled segments are filtered before `render` is called (git commands never run).

### Input parsing
`parseStatusInput` never throws: `JSON.parse` in try/catch, then each field read through small
typed getters (`str(obj, path)`, `num(obj, path)`) that return `undefined` on wrong types. Numbers
may arrive as numbers or numeric strings; anything else is missing.

### Git
`execFileSync('git', ['-C', dir, ...args], { timeout: 1000, stdio: ['ignore','pipe','ignore'],
windowsHide: true })` wrapped to return `null` on any error. Same calls as the bash script:
`rev-parse --show-toplevel`; from the root `rev-parse --abbrev-ref HEAD --git-dir
--git-common-dir`; `rev-parse --short HEAD` when detached; base resolution as in the spec;
`rev-list --count base..HEAD`. Linked worktree = resolved `git-dir` ≠ resolved `git-common-dir`
(compare with `path.resolve` from the root to normalize relative output and Windows separators);
worktree label = `path.basename(root)`.

### Time
`resets_at` is epoch seconds. `< 24h` ahead → `HH:MM` from local getters; otherwise
`DD Mon HH:MM` with a fixed English month array (no `Intl`, deterministic). Tests pin the zone
with `test/setup.ts`, loaded via `--import` before any test, which sets `process.env.TZ = 'UTC'`
(portable across shells, unlike `TZ=UTC npm test` on Windows).

### Config and settings files
`statusbar.json`: `{ "segments": { "<id>": boolean }, "previousStatusLine"?: object }`. Written
with 2-space JSON. `settings.json` is read, parsed (must be an object), modified only at
`statusLine`, and written back with 2-space JSON. Key order is preserved by `JSON.parse`/
`stringify`. Writes go to a temp file in the same directory and are renamed over the target to
avoid half-written files. Comments in `settings.json` are not supported (Claude Code writes plain
JSON).

### Init prompt
`@inquirer/prompts` (`checkbox`, `confirm`) imported dynamically inside `commands/init.ts`, so the
render path never loads it. `--yes` or non-TTY stdin skips prompts.

### Colors
Same ANSI 256 codes as the bash script (constants). `NO_COLOR` non-empty → helpers return plain
text. Separator `' │ '` in dim; empty result → dim `no data`.

### Repository and release
- Files: `README.md` (install, init, config reference, segment table with sample output, Windows
  notes, troubleshooting, roadmap), `LICENSE` (MIT, © 2026 Hugo Sandoval), `CONTRIBUTING.md`
  (fork + PR, "how to add a segment", commands, conventional commits), `CHANGELOG.md` (Keep a
  Changelog), `.github/ISSUE_TEMPLATE/{bug_report.yml,segment_proposal.yml}`,
  `.github/pull_request_template.md`, `.editorconfig`, `.gitignore`.
- `package.json`: `bin`, `files: ["dist"]`, `type: module`, `repository`, `keywords`,
  `prepublishOnly: npm run check && npm run build`.
- CI (`.github/workflows/ci.yml`): matrix `ubuntu-latest`, `macos-latest`, `windows-latest` ×
  Node 22, 24 → `npm ci`, `npm run check` (biome + tsc --noEmit + tests), `npm run build`,
  smoke test piping a fixture into `node dist/cli.js`.
- Release (`.github/workflows/release.yml`): on tag `v*`, build and `npm publish --provenance
  --access public` via npm Trusted Publishing (OIDC). The first `0.1.0` publish is manual from the
  author's machine because a trusted publisher can only be attached to an existing package.

## Risks / Trade-offs

- [`~/.claude/sessions/*.json` is undocumented and may change] → segment is best-effort, hidden on
  any mismatch, documented as such in README.
- [Node start-up (~40–60 ms) per refresh vs bash] → no runtime deps on the render path; acceptable
  for a 30 s refresh plus event-driven redraws.
- [Git slow on huge repos or network filesystems] → 1 s timeout per call; segment disabled via
  config.
- [Windows: git not on PATH, Unicode glyphs in old consoles] → segment hidden when git missing;
  glyphs render in Windows Terminal, documented in README.
- [`init` overwriting a hand-edited settings file] → only `statusLine` touched, atomic write,
  previous status line saved, abort on invalid JSON.
- [npm name squatting / similar names `cc-statusbar`, `claude-code-statusbar`] → README states
  what differs (quota windows with reset time, git worktree/ahead).

## Migration Plan

1. Implement, CI green on the three OSes.
2. Author creates the public GitHub repo (`gh repo create hhsm95/claude-statusbar --public`) and
   pushes — requires the author's explicit go-ahead.
3. Author publishes `0.1.0` manually (`npm publish --access public`), then configures Trusted
   Publishing on npmjs.com for `release.yml`.
4. On the author's machines: `npm i -g claude-statusbar && claude-statusbar init` (replaces
   `~/.claude/statusline.sh`, which is stored as `previousStatusLine`). Rollback:
   `claude-statusbar uninstall`.

## Open Questions

- None blocking. README screenshot is taken by the author (no browser automation); until then the
  README shows a text sample.
