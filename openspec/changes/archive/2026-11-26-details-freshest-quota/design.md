## Context

Every render writes the raw stdin JSON to `<claudeDir>/statusbar/snapshots/<session_id>.json`
(`saveSnapshot`); snapshots older than 7 days are pruned. `runDetails` reads only the current
session's snapshot, runs it through `parseStatusInput` and asks each enabled segment for its
detail rows. The `fiveHour` / `sevenDay` segments read `input.fiveHour` / `input.sevenDay`
(`WindowInput { usedPct?, resetsAt? }`).

Claude Code fills `rate_limits` per session, so an idle session can carry an older value than
its siblings even when its snapshot file is the newest one.

## Goals / Non-Goals

**Goals:**
- `details` shows the most up-to-date 5h and 7d quota seen by any session of the same config dir.
- Same failure tolerance as today: unreadable or malformed snapshots are skipped silently.

**Non-Goals:**
- Changing the status line render path (it would add a directory scan to every render).
- Telling the user which session the quota came from.
- Changing the `updated <age> ago` header, which keeps describing the current snapshot.

## Decisions

**Freshness by window content, not by file mtime.** A snapshot written later can still carry an
older quota (the motivating case), so mtime is not a valid order. Per window, the candidates are
all snapshots whose window has a `usedPct`; the winner has the greatest `resetsAt`, and ties are
broken by the highest `usedPct`. A window without `resetsAt` ranks below any window that has one.
5h and 7d are chosen independently, so they may come from different snapshots.
- Alternative: newest mtime — rejected, fails on the observed data.
- Alternative: highest `usedPct` regardless of `resetsAt` — rejected, a previous, already reset
  window would win over the current one.

**Pure selection + thin I/O.** A pure function `freshestWindow(windows: readonly WindowInput[]):
WindowInput | undefined` holds the rule and is unit-tested with values set by the test. A
function in `src/snapshot.ts` lists the snapshot directory (only `*.json` names that are not temp
files), reads and parses each with `parseStatusInput`, and returns the parsed windows; any file
error skips that file. `runDetails` replaces `input.fiveHour` / `input.sevenDay` with the winners
before building the context, falling back to the current session's windows when no candidate
exists. The current session's snapshot is in the same directory, so it competes like the others.

**Expired windows are not filtered.** A newer window always has a later `resetsAt`, so it wins
anyway; if every candidate is expired, the existing `0% · reset passed` rendering applies.

## Risks / Trade-offs

- [Two accounts sharing one `CLAUDE_CONFIG_DIR`] → their quotas would mix. Accepted: a config dir
  normally belongs to one account.
- [Many snapshots] → one small file read per session from the last 7 days; only on `details`,
  never on render.
- [Snapshot format is Claude Code's stdin] → parsed with the same tolerant `parseStatusInput`,
  so wrong-typed fields just drop out as candidates.
