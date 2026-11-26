## 1. Piece contract

- [x] 1.1 Add `Piece`, `Paint` and the `fixed`/`name`/`bar` constructors to `src/segments/types.ts`; change `Segment.render` to return `readonly Piece[] | null`
- [x] 1.2 Add a test helper `piecesText(pieces)` in `test/helpers.ts` that prints pieces at full length (`lead + paint(label + text)`)
- [x] 1.3 Add `ENV.columns`, `GLYPHS.ellipsis` and `WIDTH` (`margin`, `minName`, `wideGlyphs`) to `src/constants.ts`

## 2. Segments to pieces

- [x] 2.1 Convert model, effort, session, context and cache to a single `fixed` piece; update their tests to go through `piecesText` with unchanged expectations
- [x] 2.2 Convert `renderWindow` (5h/7d) to label, `bar`, percentage and reset pieces; update window tests with unchanged expectations
- [x] 2.3 Convert git to branch `name`, worktree `name` and ahead `fixed` pieces; update git tests with unchanged expectations

## 3. Layout

- [x] 3.1 `parseColumns(env)` in `src/layout.ts` with tests (unset, `abc`, `0`, `-5`, `80`)
- [x] 3.2 `width()` and name truncation by code points with tests (wide glyphs count 2, `…` cut, names at or under the cap unchanged)
- [x] 3.3 `layoutLine(segments, columns)` covering each scenario of the delta spec: width unknown, fits, names truncated first with a shared cap, bars dropped at the minimum with names growing back, wrap of the compact form onto more lines (segment order, own line when wider than a line), short sha never cut, ANSI not counted

## 4. Wiring

- [x] 4.1 `render(config, ctx, { columns, segments })` uses `layoutLine`; keep the `no data` fallback and the swallowed segment errors; update `test/render.test.ts` and add one long-branch case with a small `columns`
- [x] 4.2 `cli.ts` passes `parseColumns(process.env)`; add a CLI test that `COLUMNS` reaches the output

## 5. Docs and verification

- [x] 5.1 README: describe width fitting (order, minimum, wrapping, `COLUMNS` source and the unverified platforms) and update the "Adding a segment" notes in CONTRIBUTING and CLAUDE.md for the piece contract
- [x] 5.2 CHANGELOG `Unreleased` entry
- [x] 5.3 `npm run check`, `npm run build` and a manual smoke test with `COLUMNS=60` and a long branch
- [x] 5.4 Manual check by the user in Claude Code with a narrow window (user task)
