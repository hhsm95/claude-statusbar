## 1. Selection rule

- [x] 1.1 Test and implement a pure `freshestWindow(windows)` that returns the window with the
      latest `resetsAt`, ties broken by highest `usedPct`, windows without `resetsAt` ranked last,
      ignoring windows without `usedPct`, and `undefined` when there is no candidate

## 2. Reading every snapshot

- [x] 2.1 Test and implement in `src/snapshot.ts` a reader that lists the snapshots directory
      (only `*.json`, no temp files), parses each with `parseStatusInput` and returns their
      `fiveHour` / `sevenDay` windows, skipping unreadable or malformed files and returning an
      empty list when the directory is missing

## 3. Wiring into details

- [x] 3.1 Test and implement in `runDetails` the override of `fiveHour` / `sevenDay` with the
      freshest windows, falling back to the current snapshot's; cover the spec scenarios (stale
      session, newer window, independent windows, unreadable sibling, no quota anywhere)

## 4. Docs and verification

- [x] 4.1 Update the README `details` section and add a CHANGELOG entry
- [x] 4.2 Run `npm run check` and `npm run build`
