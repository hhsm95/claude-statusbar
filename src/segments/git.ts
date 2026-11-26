import { basename, resolve } from "node:path";
import { COLORS, DETAIL_LABELS, FALLBACK_BASES, GLYPHS } from "../constants.ts";
import {
  type DetailRow,
  fixed,
  type GitRunner,
  name,
  type Piece,
  type RenderContext,
  type Segment,
} from "./types.ts";

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

interface GitState {
  branch: string;
  /** Folder name of the work tree, set only in a linked worktree. */
  worktree?: string;
  ahead: number;
}

function readGit({ input, runGit }: RenderContext): GitState | null {
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
  return {
    branch,
    worktree: isLinkedWorktree ? basename(root) : undefined,
    ahead: aheadCount(runGit, root),
  };
}

function render(ctx: RenderContext): readonly Piece[] | null {
  const state = readGit(ctx);
  if (state === null) return null;
  const { ansi } = ctx;

  const pieces = [name(state.branch, (s) => ansi.color(COLORS.git, s), "", `${GLYPHS.branch} `)];
  if (state.worktree !== undefined) {
    pieces.push(name(state.worktree, ansi.dim, " ", `${GLYPHS.worktree} `));
  }
  if (state.ahead > 0) {
    pieces.push(fixed(`${GLYPHS.ahead}${state.ahead}`, (s) => ansi.color(COLORS.ahead, s), " "));
  }
  return pieces;
}

function detail(ctx: RenderContext): readonly DetailRow[] | null {
  const state = readGit(ctx);
  if (state === null) return null;
  const { ansi } = ctx;

  const branch = ansi.color(COLORS.git, state.branch);
  const ahead =
    state.ahead > 0
      ? ` ${GLYPHS.dot} ${ansi.color(COLORS.ahead, `${GLYPHS.ahead}${state.ahead}`)}`
      : "";
  const rows: DetailRow[] = [{ label: DETAIL_LABELS.git, value: branch + ahead }];
  if (state.worktree !== undefined) {
    rows.push({ label: DETAIL_LABELS.worktree, value: state.worktree });
  }
  return rows;
}

export const gitSegment: Segment = { id: "git", render, detail };
