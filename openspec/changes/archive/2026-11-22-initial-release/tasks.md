## 1. Project scaffold

- [x] 1.1 `package.json` (name, bin, type module, engines, files, scripts: build, test, lint, typecheck, check, prepublishOnly), `tsconfig.json` (strict, noUncheckedIndexedAccess, NodeNext), `biome.json`, `.gitignore`, `.editorconfig`; install dev deps (typescript, tsx, @biomejs/biome, @types/node) and `@inquirer/prompts`
- [x] 1.2 `test/setup.ts` pinning `TZ=UTC`; a placeholder test so `npm run check` passes end to end
- [x] 1.3 `src/constants.ts` with colors, glyphs, strings, file names, statusLine defaults, git timeout

## 2. Formatting helpers (pure)

- [x] 2.1 `format/ansi.ts` (color, bold, dim; NO_COLOR) with tests
- [x] 2.2 `format/bar.ts` with tests (0, 74, 100, >100, <0)
- [x] 2.3 `format/tokens.ts` with tests on the humanize boundaries of the spec
- [x] 2.4 `format/time.ts` with tests (<24h, ≥24h, month names)

## 3. Input and config

- [x] 3.1 `input.ts` `parseStatusInput` with tests (full fixture, empty, invalid JSON, wrong types, numeric strings, `cwd` fallback)
- [x] 3.2 `config.ts` (claudeDir with CLAUDE_CONFIG_DIR, loadConfig tolerant, defaultConfig, writeConfig atomic) with tests on temp dirs
- [x] 3.3 `settings.ts` read/write (object check, atomic write, key preservation) with tests

## 4. Segments and render

- [x] 4.1 `segments/types.ts`, `segments/registry.ts`, `render.ts` (filter disabled, join, `no data`) with tests using fake segments
- [x] 4.2 `model`, `effort` segments with tests
- [x] 4.3 `five-hour`, `seven-day` via shared window helper, with tests (colors per threshold, expired window, reset marks, absent data)
- [x] 4.4 `context` segment with tests (tokens, colors 80/90, pct fallback)
- [x] 4.5 `session` segment with tests on a temp sessions dir (match, malformed file, missing dir)
- [x] 4.6 `git.ts` runner + `git` segment with tests against real temp repos (branch, ahead of main, detached, linked worktree, upstream base, non-repo, disabled ⇒ no git call)

## 5. CLI

- [x] 5.1 `cli.ts` dispatch: render from stdin (never throws, exit 0), `--help`, `--version`, unknown command ⇒ stderr + exit 1; tests spawning the built-from-source CLI via tsx
- [x] 5.2 `commands/init.ts` (prompts lazy-loaded, `--yes`/non-TTY, previousStatusLine, abort on invalid settings) with tests in temp CLAUDE_CONFIG_DIR using `--yes`
- [x] 5.3 `commands/uninstall.ts` with tests (restore previous, delete, not installed, invalid settings)
- [x] 5.4 Parity check: render the bash script's typical fixtures and compare with `~/.claude/statusline.sh` output on macOS (differences only in English strings/date format), documented in the PR

## 6. Repository docs and automation

- [x] 6.1 `README.md` (what it shows with text sample, install, init, config reference, segment table, Windows notes, troubleshooting, uninstall, roadmap, comparison note)
- [x] 6.2 `LICENSE` (MIT, 2026 Hugo Sandoval), `CHANGELOG.md` (0.1.0), `CONTRIBUTING.md` (fork + PR, adding a segment step by step, commands, commit style)
- [x] 6.3 `.github/ISSUE_TEMPLATE/bug_report.yml`, `segment_proposal.yml`, `.github/pull_request_template.md`
- [x] 6.4 `.github/workflows/ci.yml` (3 OS × Node 22/24, check, build, smoke) and `release.yml` (tag `v*`, provenance, trusted publishing)
- [x] 6.5 `npm pack --dry-run` shows only `dist/`, README, LICENSE, package.json

## 7. Author tasks (not for implementers)

- [ ] 7.1 Approve and create the public GitHub repo and push
- [ ] 7.2 Publish 0.1.0 manually and configure npm Trusted Publishing
- [ ] 7.3 Install on own machines with `init`, take the README screenshot
