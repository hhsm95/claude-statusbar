## Context

`render()` (`src/render.ts`) joins the strings returned by each enabled segment with a dim ` │ `
and never measures the result. Each segment returns one finished, already-colored string. In a
narrow terminal the line overflows on the right; long branch and worktree names are the usual
cause.

A spike (2026-11-25) measured what the status line process can see:

| Source | Result |
|---|---|
| `process.env.COLUMNS` / `LINES` | live terminal size, updated on resize (Warp, macOS Terminal.app) |
| `/dev/tty`, `stty size` | `ENXIO`: the process has no controlling terminal |
| `process.stdout.columns` | undefined (stdout is a pipe) |
| stdin JSON | no width field |

`COLUMNS` is injected by Claude Code (it is absent in ordinary child shells). A render fired during
a resize can carry the previous width once; the next render corrects it. Windows and Linux were
not measured.

## Goals / Non-Goals

**Goals:**
- Fit the line to `COLUMNS` by, in order: truncating branch/worktree names, dropping progress bars,
  then wrapping the compact form onto more lines (decided after the user tried the overflow in a
  narrow window: cutting off the right side is what they wanted to avoid).
- Byte-identical output when the width is unknown or the line fits.
- Keep fitting logic in one pure, testable function; compute every segment once per render.

**Non-Goals:**
- Hiding segments for lack of space.
- Truncating any name other than the git branch and worktree (session name, model, etc.).
- A multi-line layout (`layout: "multiline"`) or a `claude-statusbar details` command; those are
  separate follow-up changes.
- User-facing config for the margin or minimum length.
- Exact East Asian width / emoji width tables.

## Approaches

- **A. Segments return typed pieces (chosen).** Segments describe their output as pieces; a pure
  layout function decides truncation and removal. Each segment runs once, all fitting rules live in
  one place, and width is measured on plain text before painting, so no ANSI stripping is needed.
  Cost: the `Segment` contract changes and all 8 segments and their tests are adapted.
- **B. Render by levels.** The renderer re-renders with a level in `ctx` until the line fits.
  Smaller contract change, but git calls and the transcript read repeat per level (or need a
  cache), and the fitting rules are spread across segments.
- **C. Post-process the string.** Strip bars and cut names with regexes on ANSI-colored text.
  Rejected: fragile.

The user picked A.

## Decisions

### Piece model

In `src/segments/types.ts`:

```ts
type Paint = (text: string) => string;

interface Piece {
  kind: "fixed" | "name" | "bar";
  /** Unstyled text printed before the piece (usually a space). Dropped with a "bar" piece. */
  lead: string;
  /** Styled together with `text`, never truncated (e.g. "⎇ ", "⌂ "). */
  label: string;
  /** For "name", the truncatable part. */
  text: string;
  paint: Paint;
}

interface Segment {
  id: SegmentId;
  render(ctx: RenderContext): readonly Piece[] | null;
}
```

A piece prints as `lead + paint(label + text)`. Small constructors (`fixed`, `name`, `bar`) with
`lead`/`label` defaulting to `""` keep segment code short. This model keeps today's ANSI output
byte-identical. Examples:

- git: `name("⎇ ", branch, gitColor)`, then `name(" " lead, "⌂ ", folder, dim)` for a worktree, then
  `fixed(" " lead, "↑3", aheadColor)`.
- window: `fixed("5h", plain)`, `bar(" " lead, "▓▓▓▓░░░░░░", color)`, `fixed(" " lead, "37%",
  color)`, `fixed(" " lead, "↺16:59", dim)`.
- model, effort, session, context, cache: a single `fixed` piece.

An empty result (null, or pieces whose total text is empty) is skipped as today. A throwing segment
is still swallowed in `render()`.

Alternative considered: merging adjacent same-colored pieces instead of a `label` field. Rejected
because comparing `paint` functions is unreliable and it would change the ANSI byte stream.

### Layout (`src/layout.ts`, pure)

`layoutLine(segments: readonly (readonly Piece[])[], columns: number | undefined, paintSeparator:
Paint): string` returns the joined line (without `\n`). The plain ` │ ` is measured and
`paintSeparator` (the dim color) is applied only when printing. `render()` drops a segment whose
pieces have no plain text before layout (checked on plain text, since painting `""` still yields
ANSI codes).

1. `columns` undefined → print everything at full length (today's behavior).
2. `available = columns - WIDTH.margin`.
3. Try, in order, and return the first that fits:
   - full;
   - bars kept, names capped at `cap` for `cap` from the longest name length down to
     `WIDTH.minName`: pick the largest fitting cap;
   - bars dropped, same cap search from the longest name down to `WIDTH.minName`.
4. Nothing fits → take the compact form (bars dropped, cap = `WIDTH.minName`) and wrap it greedily:
   each segment joins the current line if the line plus ` │ ` plus the segment fits, else it starts
   a new line; a segment wider than a line sits alone and overflows. Lines are joined with `\n`.
   Claude Code renders each stdout line of the status line command as its own row.

   Alternatives considered: wrapping before any truncation (keeps full names and bars but uses
   more rows at medium widths) and truncating names then wrapping with bars kept. The user chose
   to keep the shortening order and wrap only as the last step.

Width of a candidate = sum over shown pieces of `width(lead) + width(label) + width(text after
cap)` + `3 × (segments − 1)` for the ` │ ` separators. The cap search is a linear scan; names are
short and segments few, so the cost is negligible.

Truncation works on code points (`Array.from`) so surrogate pairs are never split:
`cap - 1` code points + `…`. With a width table for wide glyphs, a name's width is computed per
code point; names are cut by code points, which is exact for ASCII names (the common case).

`width(s)` = number of code points, counting those in `WIDTH.wideGlyphs` (`⏱`, `⚠`) as 2.
Over-counting is safe: it only shortens a little earlier.

### Where `COLUMNS` is read

`parseColumns(env)` (in `src/layout.ts`) returns a positive integer or `undefined` (`/^\d+$/` and
`> 0`). `cli.ts` passes it to `render(config, ctx, { columns })`. `RenderContext` is not
extended: segments do not need the width.

### Constants

In `src/constants.ts`: `ENV.columns = "COLUMNS"`, `GLYPHS.ellipsis = "…"`, and
`WIDTH = { margin: 2, minName: 8, wideGlyphs: [GLYPHS.cacheWarn, GLYPHS.cacheExpired] }`.
`margin` and `minName` are tuning values chosen by eye.

### Tests

- Segment tests render pieces through a test helper (`piecesText(pieces)` = full-length print) so
  existing string expectations stay unchanged; this is also the byte-identical check.
- `test/layout.test.ts` covers each scenario of the delta spec with hand-built pieces and explicit
  `columns`.
- `test/render.test.ts` adds one end-to-end case with a long branch and a small `columns`.
- A CLI test checks that `COLUMNS` from the environment reaches the layout.

## Risks / Trade-offs

- [Ambiguous glyph widths (`⏱`, `⚠`, `⎇`, `⌂`, `↺`) vary by terminal and font] → `⏱`/`⚠` count
  as 2 and a 2-column margin absorbs the rest.
- [Stale `COLUMNS` during a resize] → at most one mis-fitted render; the next one (or the 30 s
  refresh) corrects it.
- [Claude Code `padding` setting reduces the usable width but is not visible to the process] →
  the margin covers the default; a large padding may still overflow slightly.
- [Unverified on Windows/Linux] → if `COLUMNS` is absent there, the width is unknown and the line
  renders exactly as today.
- [Contract change for third-party segment contributors] → documented in CONTRIBUTING/CHANGELOG;
  the package exposes no public segment API, so no semver break for users.

## Open Questions

None blocking. Follow-ups: multi-line layout and a `details` command as separate changes.
