# Hexframe agent workflow

These instructions apply to the entire repository.

## Definition of done

After every task that changes repository files, the agent must finish the delivery loop before handing the task back:

1. Inspect the worktree and account for every modified, deleted, and untracked file.
2. Preserve unrelated or user-authored work. Never discard, overwrite, reset, or clean away changes merely to make the tree appear clean.
3. Remove only task-created temporary artifacts, then run the relevant tests, type checks, production build, and `git diff --check`.
4. Commit all intended task changes with a concise, descriptive commit message. Do not leave task changes staged, unstaged, or untracked.
5. Push the commit to the configured upstream branch.
6. Open a pull request. Do not push to `main`, and do not deploy from a branch.
7. Confirm `git status --short` is empty before reporting completion.

## Deployment is not part of the delivery loop

An earlier version of this workflow deployed every commit to production. That is superseded
by the release model: production deploys a **release tag**, never an arbitrary `main` commit,
and the deployment records its own identity at `/version.json`.

See [docs/RELEASE-MANAGEMENT.md](docs/RELEASE-MANAGEMENT.md). The historical workflow is kept
in this repository's history because it explains why the reconstructed source commits deploy
as often as they do.

If a required check, commit, push, deployment, or live verification cannot be completed, do not claim the task is finished. Report the exact blocker and leave all recoverable work intact.

Read-only questions and reviews that do not change repository files do not require an empty commit or redundant deployment.
