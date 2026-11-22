import { basename, resolve } from "node:path";
import { COLORS, FALLBACK_BASES, GLYPHS } from "../constants.ts";
import type { GitRunner, RenderContext, Segment } from "./types.ts";

const ORIGIN_PREFIX = "origin/";

function branchExists(runGit: GitRunner, dir: string, name: string): boolean {
  return runGit(dir, ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]) !== null;
}

/** origin/HEAD's target (preferring its local branch), else local main/master, else upstream. */
function resolveBase(runGit: GitRunner, dir: string): string | null {
  const remoteHead = runGit(dir, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  if (remoteHead) {
    const local = remoteHead.startsWith(ORIGIN_PREFIX)
      ? remoteHead.slice(ORIGIN_PREFIX.length)
      : remoteHead;
    return branchExists(runGit, dir, local) ? local : remoteHead;
  }
  const local = FALLBACK_BASES.find((name) => branchExists(runGit, dir, name));
  if (local) return local;
  return runGit(dir, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]) || null;
}

function aheadCount(runGit: GitRunner, dir: string): number {
  const base = resolveBase(runGit, dir);
  if (base === null) return 0;
  const count = Number(runGit(dir, ["rev-list", "--count", `${base}..HEAD`]));
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function render({ input, ansi, runGit }: RenderContext): string | null {
  const dir = input.currentDir;
  if (dir === undefined) return null;
  const root = runGit(dir, ["rev-parse", "--show-toplevel"]);
  if (!root) return null;

  const [head, gitDir, commonDir] = (
    runGit(root, ["rev-parse", "--abbrev-ref", "HEAD", "--git-dir", "--git-common-dir"]) ?? ""
  ).split("\n");
  if (!head) return null;

  const branch = head === "HEAD" ? runGit(root, ["rev-parse", "--short", "HEAD"]) : head;
  if (!branch) return null;

  // From the root, the main checkout reports the same dir in both; a linked worktree does not.
  const isLinkedWorktree =
    !!gitDir && !!commonDir && resolve(root, gitDir) !== resolve(root, commonDir);
  const ahead = aheadCount(runGit, root);

  let text = ansi.color(COLORS.git, `${GLYPHS.branch} ${branch}`);
  if (isLinkedWorktree) text += ` ${ansi.dim(`${GLYPHS.worktree} ${basename(root)}`)}`;
  if (ahead > 0) text += ` ${ansi.color(COLORS.ahead, `${GLYPHS.ahead}${ahead}`)}`;
  return text;
}

export const gitSegment: Segment = { id: "git", render };
