import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { defaultConfig } from "../../src/config.ts";
import { COLORS } from "../../src/constants.ts";
import { createAnsi } from "../../src/format/ansi.ts";
import { runGit } from "../../src/git.ts";
import { render } from "../../src/render.ts";
import { gitSegment } from "../../src/segments/git.ts";
import { SEGMENTS } from "../../src/segments/registry.ts";
import type { GitRunner } from "../../src/segments/types.ts";
import { fg, makeContext, piecesText } from "../helpers.ts";

let base: string;
before(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "statusbar-git-")));
});
after(() => rmSync(base, { recursive: true, force: true }));

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

let counter = 0;
const freshDir = (): string => join(base, `d${counter++}`);

function initRepo(branch = "main"): string {
  const dir = freshDir();
  git(base, "init", "-q", "-b", branch, dir);
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "commit.gpgsign", "false");
  commit(dir);
  return dir;
}

const commit = (dir: string, message = "c"): void => {
  git(dir, "commit", "-q", "--allow-empty", "-m", message);
};

const renderAt = (dir: string, runner: GitRunner = runGit): string | null =>
  piecesText(
    gitSegment.render(makeContext({ workspace: { current_dir: dir } }, { runGit: runner })),
  );

describe("git segment (real repos)", () => {
  test("branch on main without commits ahead", () => {
    assert.equal(renderAt(initRepo()), fg(250, "⎇ main"));
  });

  test("feature branch ahead of main", () => {
    const dir = initRepo();
    git(dir, "checkout", "-q", "-b", "feat/x");
    commit(dir);
    commit(dir);
    assert.equal(renderAt(dir), `${fg(250, "⎇ feat/x")} ${fg(114, "↑2")}`);
  });

  test("works from a subdirectory of the work tree", () => {
    const dir = initRepo();
    git(dir, "checkout", "-q", "-b", "feat/y");
    commit(dir);
    const sub = join(dir, "sub");
    mkdirSync(sub, { recursive: true });
    assert.equal(renderAt(sub), `${fg(250, "⎇ feat/y")} ${fg(114, "↑1")}`);
  });

  test("detached HEAD in a linked worktree", () => {
    const dir = initRepo();
    const wt = join(base, "wt-a");
    git(dir, "worktree", "add", "-q", "--detach", wt);
    const sha = git(wt, "rev-parse", "--short", "HEAD");
    assert.equal(renderAt(wt), `${fg(250, `⎇ ${sha}`)} ${fg(244, "⌂ wt-a")}`);
  });

  test("linked worktree on a branch shows its folder, main checkout does not", () => {
    const dir = initRepo();
    const wt = join(base, "wt-b");
    git(dir, "worktree", "add", "-q", "-b", "feat/wt", wt);
    commit(wt);
    assert.equal(renderAt(wt), `${fg(250, "⎇ feat/wt")} ${fg(244, "⌂ wt-b")} ${fg(114, "↑1")}`);
    assert.equal(renderAt(dir), fg(250, "⎇ main"));
  });

  test("branch and worktree folder are truncatable names, the ahead count is fixed", () => {
    const dir = initRepo();
    const wt = join(base, "wt-kinds");
    git(dir, "worktree", "add", "-q", "-b", "feat/kinds", wt);
    commit(wt);
    const ctx = makeContext({ workspace: { current_dir: wt } }, { runGit });
    const pieces = gitSegment.render(ctx) ?? [];
    assert.deepEqual(
      pieces.map((piece) => [piece.kind, piece.text]),
      [
        ["name", "feat/kinds"],
        ["name", "wt-kinds"],
        ["fixed", "↑1"],
      ],
    );
  });

  test("uses the upstream as base when there is no main, master or origin/HEAD", () => {
    const dir = initRepo("trunk");
    git(dir, "checkout", "-q", "--track", "-b", "feat", "trunk");
    commit(dir);
    assert.equal(renderAt(dir), `${fg(250, "⎇ feat")} ${fg(114, "↑1")}`);
  });

  test("no base means no ahead count", () => {
    const dir = initRepo("trunk");
    git(dir, "checkout", "-q", "-b", "feat");
    commit(dir);
    assert.equal(renderAt(dir), fg(250, "⎇ feat"));
  });

  test("prefers the local branch of origin/HEAD's target over origin/main", () => {
    const source = initRepo();
    const clone = freshDir();
    git(base, "clone", "-q", source, clone);
    git(clone, "config", "user.name", "Test");
    git(clone, "config", "user.email", "test@example.com");
    git(clone, "config", "commit.gpgsign", "false");
    // Local main is one commit ahead of origin/main; feat adds one more on top of it.
    commit(clone, "local-main");
    git(clone, "checkout", "-q", "-b", "feat");
    commit(clone);
    // Against origin/main it would be 2 ahead; against local main it is 1.
    assert.equal(git(clone, "rev-list", "--count", "origin/main..HEAD"), "2");
    assert.equal(renderAt(clone), `${fg(250, "⎇ feat")} ${fg(114, "↑1")}`);
  });

  test("falls back to origin/HEAD itself when its local branch is missing", () => {
    const source = initRepo();
    const clone = freshDir();
    git(base, "clone", "-q", source, clone);
    git(clone, "config", "user.name", "Test");
    git(clone, "config", "user.email", "test@example.com");
    git(clone, "config", "commit.gpgsign", "false");
    git(clone, "checkout", "-q", "-b", "feat");
    git(clone, "branch", "-q", "-D", "main");
    commit(clone);
    assert.equal(renderAt(clone), `${fg(250, "⎇ feat")} ${fg(114, "↑1")}`);
  });

  test("main wins over master when both exist and there is no origin", () => {
    const dir = initRepo("main");
    git(dir, "branch", "master"); // master stays at the first commit
    commit(dir, "main-2");
    git(dir, "checkout", "-q", "-b", "feat");
    commit(dir);
    // Against master it would be 2 ahead; against main it is 1.
    assert.equal(renderAt(dir), `${fg(250, "⎇ feat")} ${fg(114, "↑1")}`);
  });

  test("hidden outside a repository", () => {
    const dir = freshDir();
    mkdirSync(dir, { recursive: true });
    assert.equal(renderAt(dir), null);
  });

  test("hidden when the directory does not exist", () => {
    assert.equal(renderAt(freshDir()), null);
  });
});

describe("git segment (fake runner)", () => {
  test("hidden without a current dir and never calls git", () => {
    let calls = 0;
    const counting: GitRunner = () => {
      calls += 1;
      return null;
    };
    assert.equal(piecesText(gitSegment.render(makeContext({}, { runGit: counting }))), null);
    assert.equal(calls, 0);
  });

  test("disabled git segment never invokes the runner", () => {
    let calls = 0;
    const counting: GitRunner = () => {
      calls += 1;
      return "x";
    };
    const config = defaultConfig();
    config.segments.git = false;
    const ctx = makeContext({ workspace: { current_dir: "/repo" } }, { runGit: counting });
    render(config, ctx, { segments: SEGMENTS });
    assert.equal(calls, 0);
  });

  test("git missing (runner returns null) hides the segment", () => {
    assert.equal(
      renderAt("/repo", () => null),
      null,
    );
  });
});

describe("git segment detail rows", () => {
  const detailAt = (dir: string, runner: GitRunner = runGit) =>
    gitSegment.detail?.(
      makeContext({ workspace: { current_dir: dir } }, { runGit: runner, ansi: createAnsi(false) }),
    );

  test("long branch is not truncated and shows the ahead count", () => {
    const dir = initRepo();
    const branch = "feat/details-command-with-a-very-long-name";
    git(dir, "checkout", "-q", "-b", branch);
    commit(dir);
    commit(dir);
    assert.deepEqual(detailAt(dir), [{ label: "Git", value: `${branch} · ↑2` }]);
  });

  test("branch and ahead count keep the line's colors", () => {
    const dir = initRepo();
    git(dir, "checkout", "-q", "-b", "feat/x");
    commit(dir);
    const rows = gitSegment.detail?.(
      makeContext({ workspace: { current_dir: dir } }, { runGit, ansi: createAnsi(true) }),
    );
    assert.deepEqual(rows, [
      {
        label: "Git",
        value: `${fg(COLORS.git, "feat/x")} · ${fg(COLORS.ahead, "↑1")}`,
      },
    ]);
  });

  test("no ahead suffix on the base branch", () => {
    assert.deepEqual(detailAt(initRepo()), [{ label: "Git", value: "main" }]);
  });

  test("detached HEAD shows the short hash", () => {
    const dir = initRepo();
    const sha = git(dir, "rev-parse", "--short", "HEAD");
    git(dir, "checkout", "-q", "--detach");
    assert.deepEqual(detailAt(dir), [{ label: "Git", value: sha }]);
  });

  test("a linked worktree adds a Worktree row", () => {
    const dir = initRepo();
    const wt = join(base, "wt-detail");
    git(dir, "worktree", "add", "-q", "-b", "feat/detail", wt);
    assert.deepEqual(detailAt(wt), [
      { label: "Git", value: "feat/detail" },
      { label: "Worktree", value: "wt-detail" },
    ]);
  });

  test("null outside a repository or without a directory", () => {
    assert.equal(
      detailAt("/repo", () => null),
      null,
    );
    assert.equal(gitSegment.detail?.(makeContext({})), null);
  });
});
