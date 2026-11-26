# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@hhsm95/claude-statusbar` is a Node CLI (TypeScript, ESM, Node ≥ 22.13) that Claude Code runs as its
`statusLine` command: it reads the status JSON on stdin and prints one ANSI-colored line.

## Commands

```bash
npm ci
npm run check        # biome lint + tsc --noEmit + all tests (what CI runs)
npm run build        # tsc -p tsconfig.build.json → dist/ (gitignored)
npm test             # all tests
npx biome check --write .   # apply safe lint/format fixes

# Single test file (setup.ts forces TZ=UTC; always include it)
node --import tsx --import ./test/setup.ts --test test/segments/cache.test.ts
# Single test by name
node --import tsx --import ./test/setup.ts --test --test-name-pattern "expired" test/segments/cache.test.ts

# Manual smoke test against built output
echo '{"model":{"display_name":"Opus 5.5"}}' | NO_COLOR=1 node dist/cli.js
```

`Taskfile.yml` wraps the same npm scripts (`task check`, `task setup` = build + `npm link` +
`claude-statusbar init`, `task unlink`). Tests use Node's built-in `node:test` runner via `tsx`; there
is no Jest/Vitest. Source imports use explicit `.ts` extensions (rewritten to `.js` on build).

## Architecture

- **`src/cli.ts`** — entry point. No args → render path (read stdin, capped at `MAX_STDIN_BYTES`).
  `init` / `uninstall` are loaded via dynamic `import()` so their dependency (`@inquirer/prompts`) never
  loads on the render path.
- **Render path**: `parseStatusInput` (`src/input.ts`) normalizes Claude Code's raw JSON into a typed
  `StatusInput` (tolerates missing/wrong-typed fields, numeric strings) → `loadConfig` reads
  `statusbar.json` → `render` (`src/render.ts`) iterates `SEGMENTS` in registry order, skips disabled
  ones, swallows any segment exception, and joins non-empty outputs with a dim `│`. Any failure ends in
  the dim `no data` line; the renderer must never throw or stall.
- **Segments** (`src/segments/`): each exports a `Segment` `{ id, render(ctx) }` returning typed
  pieces (`fixed` / `name` / `bar` from `types.ts`) or `null`. `src/layout.ts` fits them to the
  `COLUMNS` width: truncates `name` pieces (git branch/worktree), then drops `bar` pieces, else
  wraps the compact form onto more lines; without `COLUMNS` it is one full-length line.
  Everything external comes through `RenderContext` (`input`, `now`, `claudeDir`, `ansi`,
  `runGit`) so tests inject fakes (see `test/helpers.ts`: `makeContext`, fixed `NOW`, `noGit`).
  Display order = array order in `src/segments/registry.ts`.
- **Adding a segment**: new file in `src/segments/`, add its id to `SEGMENT_IDS` in
  `src/constants.ts` (`SegmentId` and the default config are derived from it in `config.ts`),
  register it in `registry.ts`, add `test/segments/<name>.test.ts`, a README
  segment-table row and a CHANGELOG entry.
- **`src/constants.ts`** centralizes all colors, thresholds, glyphs, user-facing strings, CLI text,
  file names, env vars and timeouts. Don't inline these elsewhere.
- **Config dir**: `$CLAUDE_CONFIG_DIR` or `~/.claude`. `statusbar.json` (segment toggles +
  `previousStatusLine`) and Claude Code's `settings.json` are both written atomically
  (`writeJsonAtomic` in `src/json-file.ts`). `init` only touches the `statusLine` key and stores any
  previous status line for `uninstall` to restore.
- **External data sources** (best-effort, must degrade to hidden): `src/git.ts` runs git with a 1 s
  timeout; the `session` segment reads `<claudeDir>/sessions/*.json` (undocumented Claude Code
  internal); `src/transcript.ts` reads only the tail of the transcript JSONL (64 KB, growing up to
  1 MB) to find the last request's start time, cache TTL and prompt tokens for the `cache` segment.

## Rules

- No runtime dependencies on the render path — Node built-ins only.
- TypeScript `strict` + `noUncheckedIndexedAccess`; no `any`, no `console.*` (biome errors on both);
  no barrel files. User-facing strings in English.
- CI runs `check` + `build` + a smoke test on Linux/macOS/Windows × Node 22/24; keep paths and git
  calls cross-platform.
- Releases: push a `v<version>` tag matching `package.json`; `release.yml` publishes to npm via
  Trusted Publishing.
- Specs and change history live in `openspec/` (`openspec/specs/` is the current behavior; archived
  changes in `openspec/changes/archive/`). Remote is GitHub (`gh`), not GitLab.
