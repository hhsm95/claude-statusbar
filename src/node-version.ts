export interface NodeVersion {
  major: number;
  minor: number;
}

/** An unparseable version passes: the check exists to explain a known failure, not to block. */
export function meetsMinimumNode(version: string, minimum: NodeVersion): boolean {
  const match = /^v?(\d+)\.(\d+)/.exec(version);
  if (match === null) return true;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major !== minimum.major) return major > minimum.major;
  return minor >= minimum.minor;
}
