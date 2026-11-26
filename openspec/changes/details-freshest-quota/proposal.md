## Why

Claude Code sends each session its own copy of `rate_limits`, and a session that has not made an
API request lately keeps getting a stale one: on 2026-11-25 the `hacker-front-4e` snapshot was
written at 21:22:11 with `five_hour.used_percentage: 48` while three other sessions, seconds
apart, reported 77–78%. The 5h and 7d quota belongs to the account, not the session, so
`details` can show a fresher value by looking at every session's snapshot.

## What Changes

- `claude-statusbar details` takes the `5h limit` and `7d limit` rows from the freshest value
  found across all snapshots in `<claudeDir>/statusbar/snapshots/`, chosen per window: the
  greatest `resets_at` wins (newest window), and within the same `resets_at` the highest
  `used_percentage` wins (usage only grows inside a window).
- When no snapshot has a usable value for a window, the current session's value is used, as
  today.
- Every other row (model, effort, session, git, context, cache, cost) and the `updated <age> ago`
  header keep coming from the current session's snapshot.
- The status line itself is unchanged: it still renders only from its stdin.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `details-command`: adds a requirement for taking the freshest 5h / 7d quota from all
  sessions' snapshots; the existing requirements are unchanged.

## Impact

- `src/snapshot.ts` (reading all snapshots), a pure selection function for the windows,
  `src/commands/details.ts` (overriding `fiveHour` / `sevenDay` in the parsed input).
- Tests in `test/commands/details.test.ts` and `test/snapshot.test.ts`.
- README `details` section and CHANGELOG entry.
- No new dependencies; the render path is not touched.
