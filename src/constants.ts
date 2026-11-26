export const COLORS = {
  ok: 22,
  warn: 214,
  crit: 196,
  dim: 244,
  git: 250,
  ahead: 114,
} as const;

export const THRESHOLDS = {
  windowWarn: 70,
  windowCrit: 90,
  contextWarn: 80,
  contextCrit: 90,
} as const;

export const GLYPHS = {
  barFilled: "▓",
  barEmpty: "░",
  branch: "⎇",
  worktree: "⌂",
  ahead: "↑",
  reset: "↺",
  session: "◉",
  cacheWarn: "⏱",
  cacheExpired: "⚠",
  dot: "·",
  separator: "│",
  ellipsis: "…",
} as const;

/** Width fitting: `margin` columns kept free, `minName` is the shortest a name is cut to. */
export const WIDTH = {
  margin: 2,
  minName: 8,
  wideGlyphs: [GLYPHS.cacheWarn, GLYPHS.cacheExpired],
} as const;

export const BAR_CELLS = 10;
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;

/** Units for `formatDuration`, largest first. */
export const DURATION_UNITS = [
  { suffix: "d", seconds: SECONDS_PER_DAY },
  { suffix: "h", seconds: SECONDS_PER_HOUR },
  { suffix: "m", seconds: SECONDS_PER_MINUTE },
  { suffix: "s", seconds: 1 },
] as const;
export const DURATION_MAX_UNITS = 2;
export const MS_PER_SECOND = 1000;

/** Prompt-cache TTLs used by the Claude API, in seconds. */
export const CACHE_TTL_SECONDS = {
  fiveMinutes: 300,
  oneHour: 3600,
} as const;

/** How long before expiry the cache segment starts warning, per TTL (tuning values). */
export const CACHE_WARN_SECONDS: Readonly<Record<number, number>> = {
  [CACHE_TTL_SECONDS.fiveMinutes]: 120,
  [CACHE_TTL_SECONDS.oneHour]: 600,
};

/** Transcript bytes read from the end; one retry with the larger size. */
export const CACHE_TAIL_BYTES = 64 * 1024;
export const CACHE_TAIL_BYTES_MAX = 1024 * 1024;

/** `message.model` of transcript entries Claude Code writes for failed API calls. */
export const SYNTHETIC_MODEL = "<synthetic>";

export const WINDOW_LABELS = { fiveHour: "5h", sevenDay: "7d" } as const;

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const STRINGS = {
  noData: "no data",
  contextPrefix: "ctx",
  cache: "cache",
  cacheExpired: "cache expired",
  tokens: "tok",
  minuteSuffix: "m",
  underOneMinute: "<1m",
} as const;

/** Row labels of the `details` command (plain; the renderer pads them). */
export const DETAIL_LABELS = {
  model: "Model",
  effort: "Effort",
  session: "Session",
  git: "Git",
  worktree: "Worktree",
  fiveHour: "5h limit",
  sevenDay: "7d limit",
  context: "Context",
  cache: "Cache",
  cost: "Cost",
} as const;

/** Words used inside `details` row values. */
export const DETAIL_TEXT = {
  started: "started",
  resets: "resets",
  resetPassed: "reset passed",
  in: "in",
  ago: "ago",
  out: "out",
  tokens: "tokens",
  warm: "warm",
  expired: "expired",
  ttl: "TTL",
  expires: "expires",
  promptTokens: "prompt tokens",
  tokensToRecache: "tokens to re-cache",
  zeroDuration: "0s",
  ttlFiveMinutes: "5m",
  ttlOneHour: "1h",
} as const;

export const DETAILS = {
  header: (age: string): string => `claude-statusbar details ${GLYPHS.dot} updated ${age} ago`,
  labelGap: " ",
  costPrefix: "$",
  costDecimals: 2,
  noSession:
    "No Claude Code session found. Run it from inside Claude Code as: ! claude-statusbar details",
  noSnapshot:
    "No status data for this session yet. Wait for the status line to render once and try again.",
} as const;

export const CLI = {
  packageFile: "package.json",
  helpFlags: ["--help", "-h"],
  versionFlags: ["--version", "-v"],
  yesFlag: "--yes",
  commands: { init: "init", uninstall: "uninstall", details: "details" },
  usage: [
    "Usage:",
    "  claude-statusbar              Render the status line from Claude Code's JSON on stdin",
    "  claude-statusbar init         Choose segments and install into Claude Code settings",
    "                                (--yes: no prompts, keep or enable all segments)",
    "  claude-statusbar uninstall    Restore the previous status line, or remove this one",
    "  claude-statusbar details      Show the full details of the current session",
    "                                (run it inside Claude Code as: ! claude-statusbar details)",
    "  claude-statusbar --help       Show this help",
    "  claude-statusbar --version    Show the version",
  ].join("\n"),
  unknownCommand: (name: string): string => `Unknown command: ${name}`,
  /** `@inquirer/prompts` needs `node:util` `styleText` and declares `^22.13.0` on the 22 line. */
  initMinNode: { major: 22, minor: 13 },
  nodeTooOld: (current: string): string =>
    `claude-statusbar init needs Node.js 22.13 or newer (found ${current}). Update Node.js and try again.`,
} as const;

export const MESSAGES = {
  settingsInvalid: (path: string, reason: string): string =>
    `Cannot use ${path}: ${reason}. Fix or remove the file and try again; it was not modified.`,
  settingsReasons: {
    "invalid-json": "it is not valid JSON",
    "not-an-object": "its content is not a JSON object",
    unreadable: "it could not be read",
  },
  initPromptSegments: "Segments to show",
  initConfirmReplace: (current: string): string =>
    `A status line is already configured (${current}). Replace it? It is saved so uninstall can restore it.`,
  initDeclined: "Left everything as it was.",
  initWrote: (path: string): string => `Wrote ${path}`,
  uninstallNothing: "Nothing to do: the status line does not point to claude-statusbar.",
  uninstallRestored: "Restored the previous status line.",
  uninstallRemoved: "Removed the status line entry.",
} as const;

export const SETTINGS_KEYS = {
  statusLine: "statusLine",
  command: "command",
  type: "type",
} as const;

export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
} as const;

export const FILES = {
  config: "statusbar.json",
  settings: "settings.json",
  sessionsDir: "sessions",
  claudeDirName: ".claude",
} as const;

const MS_PER_DAY = SECONDS_PER_DAY * MS_PER_SECOND;

export const SNAPSHOT = {
  /** Directory parts under the Claude config dir. */
  dirParts: ["statusbar", "snapshots"],
  fileSuffix: ".json",
  tempSuffix: ".tmp",
  retentionMs: 7 * MS_PER_DAY,
  sessionIdPattern: /^[A-Za-z0-9_-]{1,128}$/,
} as const;

export const ENV = {
  configDir: "CLAUDE_CONFIG_DIR",
  noColor: "NO_COLOR",
  columns: "COLUMNS",
  sessionId: "CLAUDE_CODE_SESSION_ID",
} as const;

export const SEGMENT_IDS = [
  "model",
  "effort",
  "session",
  "git",
  "fiveHour",
  "sevenDay",
  "context",
  "cache",
] as const;

export const STATUS_LINE_DEFAULTS = {
  type: "command",
  command: "claude-statusbar",
  padding: 0,
  refreshInterval: 30,
} as const;

export const GIT_TIMEOUT_MS = 1000;

export const JSON_INDENT = 2;
export const PERMISSION_BITS = 0o777;

export const UTF8_BOM = "\uFEFF";
export const MAX_STDIN_BYTES = 1_000_000;
export const PERCENT = 100;
export const MILLION_THRESHOLD = 999_500;
export const THOUSAND = 1000;
export const TEN_THOUSAND = 10_000;
export const HUNDRED_THOUSAND = 100_000;
export const FALLBACK_BASES = ["main", "master"] as const;
