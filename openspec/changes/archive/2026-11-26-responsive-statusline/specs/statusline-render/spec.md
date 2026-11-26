## ADDED Requirements

### Requirement: Fit to terminal width
The renderer SHALL read the terminal width from the `COLUMNS` environment variable. A value that
is not a positive integer, or a missing variable, SHALL mean "width unknown", and the line SHALL be
printed exactly as it would be without this requirement. With a known width, the available width
SHALL be `COLUMNS` minus a fixed safety margin of 2 columns, and the visible width of the line
SHALL be measured on its text without ANSI sequences, counting the separators and counting the
glyphs `⏱` and `⚠` as 2 columns and every other code point as 1.

When the full line is wider than the available width, the renderer SHALL shorten it in this order
and stop at the first step that fits:

1. Truncate the git branch name (or detached short sha) and the worktree folder name. Both share
   one length cap: a name longer than the cap is cut to its first `cap - 1` code points followed
   by `…`; a name at or under the cap is unchanged. The cap SHALL be the largest value that makes
   the line fit, and SHALL NOT go below 8 columns (including the `…`).
2. Remove the progress bar of the 5h and 7d window segments, together with its leading space,
   keeping the label, percentage and reset mark; then apply the name cap again, starting from the
   full names, choosing the largest cap (not below 8) that fits.
3. If the line still does not fit, take its most compact form (bars removed, names at the minimum
   cap) and wrap it onto several lines: segments are placed in order, and a segment starts a new
   line when adding it (with its ` │ `) would exceed the available width. Separators appear only
   between segments of the same line, never at a line start or end. A segment wider than the
   available width on its own SHALL take a line by itself and overflow it. Lines are joined with
   `\n` and the output still ends with a single `\n`. No segment SHALL be hidden because of width.

Only the git branch and worktree names SHALL be truncated; the `⎇`/`⌂` glyphs, the `↑<n>` ahead
count and every other segment SHALL keep their text. Colors SHALL be the same as in the
unshortened line.

#### Scenario: Width unknown
- **WHEN** `COLUMNS` is unset, `abc`, `0` or `-5`, and the line is 140 columns wide
- **THEN** the output is identical to the output without width handling

#### Scenario: Line fits
- **WHEN** `COLUMNS` is 200 and the full line is 90 columns wide
- **THEN** the output is identical to the output without width handling

#### Scenario: Long branch truncated first
- **WHEN** the branch is `feat/responsive-statusline-width-aware`, both windows have bars, and
  the line is 20 columns too wide for the available width
- **THEN** the branch is cut to the largest cap that fits and ends in `…`, and both bars are still
  shown

#### Scenario: Branch and worktree share the cap
- **WHEN** the branch name is 30 code points, the worktree folder is 12, and the cap that fits is 14
- **THEN** the branch prints as its first 13 code points plus `…` and the worktree folder prints
  unchanged

#### Scenario: Bars dropped when names hit the minimum
- **WHEN** even with both names at 8 columns the line does not fit, but it fits without the bars
- **THEN** both bars and their leading spaces are removed, the percentages remain, and the names
  use the largest cap that fits without bars (which may be their full length)

#### Scenario: Too narrow wraps
- **WHEN** `COLUMNS` is 30 and the most compact line is 60 columns wide
- **THEN** the output is that compact form (no bars, names at 8 columns) split into lines of at
  most 28 columns, filled in segment order, with no separator at any line start or end, and no
  segment is hidden

#### Scenario: Segment wider than a line
- **WHEN** one segment alone is wider than the available width and wrapping is needed
- **THEN** that segment takes its own line and overflows it, and the following segments continue
  on the next line

#### Scenario: Short names are never cut
- **WHEN** HEAD is detached at `1a2b3c4` and the line does not fit
- **THEN** the sha prints unchanged, and the shortening goes on to removing the bars

#### Scenario: ANSI codes do not count
- **WHEN** colors are on and the visible text exactly fills the available width
- **THEN** the line is printed unshortened
