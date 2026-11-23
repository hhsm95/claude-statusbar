# Contributing to claude-statusbar

Thanks for helping out. Bug reports, fixes and new segments are all welcome.

## Flow

1. For a new segment, open a **Segment proposal** issue first so we can agree on what it shows
   and where its data comes from before you write code.
2. Fork the repository and create a branch (`feat/...`, `fix/...`, `docs/...`).
3. Make your change, with tests.
4. Open a pull request against `main` and fill in the template.

## Development setup

Requires Node.js 22 or newer.

```bash
npm ci
npm run check    # biome lint + tsc --noEmit + tests
npm run build    # compiles to dist/
```

To try it locally against a sample input:

```bash
echo '{"model":{"display_name":"Opus 5.5"}}' | node dist/cli.js
```

## Adding a segment

1. Create `src/segments/<name>.ts` exporting a `Segment`
   (`{ id, render(ctx) }`). `render` returns the text to print, or `null` when there is no data.
   Read everything from `ctx` (parsed input, `now`, `claudeDir`, color helpers, `runGit`) so tests
   can inject fakes instead of touching the real clock, home directory or git.
2. Add the new id to `SEGMENT_IDS` in `src/constants.ts`. The `SegmentId` type and the default
   config (every segment enabled) are both derived from that list.
3. Register the segment in `src/segments/registry.ts`. The array order is the display order.
4. Add `test/segments/<name>.test.ts` covering the data, missing-data and wrong-type cases.
5. Add a row to the segment table in `README.md` and an entry to `CHANGELOG.md`.

## Rules

- No runtime dependencies on the render path. The render path uses only Node built-ins; the only
  runtime dependency (`@inquirer/prompts`) is loaded lazily by `init`.
- The renderer must never throw or stall: tolerate missing or wrongly typed fields and bound any
  external command with a timeout.
- TypeScript is `strict`; do not use `any`. No barrel files.
- User-facing strings are in English.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`,
  for example `feat(segments): add cost segment`.
- One commit per pull request is preferred; squash before asking for review.
- `npm run check` and `npm run build` must pass. CI runs them on Linux, macOS and Windows.
