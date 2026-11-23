## ADDED Requirements

### Requirement: Last request from the transcript tail
The cache segment SHALL read only the tail of the file at stdin's `transcript_path` (never the
whole file) and parse it as JSON lines, ignoring any line that is not a whole JSON object (which
covers a line cut by the tail). The last request SHALL be the last entry with `type: "assistant"`,
`isSidechain` not `true`, `isApiErrorMessage` not `true`, `message.model` other than `<synthetic>`,
and a `message.usage` object. Its start time SHALL be the `timestamp` of
the closest entry before the first `assistant` entry that shares its `message.id`; when no such
entry is in the tail, the start time SHALL be that first `assistant` entry's `timestamp`. When the
tail holds no qualifying entry, a larger tail SHALL be read once before giving up.

#### Scenario: Request spread over several entries
- **WHEN** the tail ends with a `user` entry at 10:00:00, two `assistant` entries with the same
  `message.id` at 10:00:20 and 10:01:30 (the last one with `usage`), then `system` and
  `attachment` entries at 10:01:31
- **THEN** the request start is 10:00:00

#### Scenario: Sidechain entries are ignored
- **WHEN** the last entry with `usage` has `isSidechain: true` and an earlier main-chain one exists
- **THEN** the earlier main-chain request is used

#### Scenario: Synthetic error entries are ignored
- **WHEN** a real request is followed by a `user` entry and an `assistant` entry with
  `isApiErrorMessage: true` (or `message.model: "<synthetic>"`) and zero usage
- **THEN** the real request is used: its start time and its prompt tokens

#### Scenario: Tail cut at a line boundary
- **WHEN** the tail starts exactly at the beginning of a line
- **THEN** that line is parsed like any other

#### Scenario: Missing or unreadable transcript
- **WHEN** `transcript_path` is absent, does not exist, or holds no qualifying entry
- **THEN** the cache segment is hidden

### Requirement: TTL detection
The TTL SHALL be 300 seconds when the last request's `usage.cache_creation.ephemeral_5m_input_tokens`
is greater than 0 (even if 1h tokens were also written), otherwise 3600 seconds when
`ephemeral_1h_input_tokens` is greater than 0. When both
are 0 or missing, earlier main-chain requests in the tail SHALL be checked from newest to oldest;
when none decides, the TTL SHALL be 3600 seconds.

#### Scenario: Five-minute TTL
- **WHEN** the last request has `cache_creation: {"ephemeral_5m_input_tokens": 120, "ephemeral_1h_input_tokens": 0}`
- **THEN** the TTL is 300 seconds

#### Scenario: Pure cache read falls back to an earlier request
- **WHEN** the last request wrote nothing to the cache and the previous one wrote 1h tokens
- **THEN** the TTL is 3600 seconds

### Requirement: Cache segment states
Let remaining be the request start plus the TTL minus `now`. The segment SHALL be hidden while
remaining is above the warning window of its TTL (`CACHE_WARN_SECONDS` in constants). Inside the
window it SHALL print `⏱ cache <M>m` in the warning color, where `<M>` is remaining rounded down to
whole minutes, or `<1m` below one minute. When remaining is 0 or less it SHALL print
`⚠ cache expired · <T> tok` in the critical color, where `<T>` is `humanTokens` of the last
request's `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.

#### Scenario: Warm cache
- **WHEN** remaining is one second above the warning window
- **THEN** the cache segment is hidden

#### Scenario: Inside the warning window
- **WHEN** remaining is 8 minutes 40 seconds and inside the warning window
- **THEN** the segment is `⏱ cache 8m` in the warning color

#### Scenario: Under one minute
- **WHEN** remaining is 30 seconds
- **THEN** the segment is `⏱ cache <1m` in the warning color

#### Scenario: Expired
- **WHEN** the TTL has passed and the last request had 4 input, 95,896 cache read and 316 cache
  creation tokens
- **THEN** the segment is `⚠ cache expired · 96K tok` in the critical color
