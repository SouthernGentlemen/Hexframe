# Hexframe agent workflow

These instructions apply to the entire repository.

## Definition of done

After every task that changes repository files, the agent must finish the delivery loop before handing the task back:

1. Inspect the worktree and account for every modified, deleted, and untracked file.
2. Preserve unrelated or user-authored work. Never discard, overwrite, reset, or clean away changes merely to make the tree appear clean.
3. Remove only task-created temporary artifacts, then run the relevant tests, type checks, production build, and `git diff --check`.
4. Commit all intended task changes with a concise, descriptive commit message. Do not leave task changes staged, unstaged, or untracked.
5. Push the commit to the configured upstream branch.
6. Deploy the verified commit to production with the repository's production deployment command.
7. Verify the live production URL and the changed user workflow, not only the deploy command's exit status.
8. Confirm `git status --short` is empty before reporting completion.

If a required check, commit, push, deployment, or live verification cannot be completed, do not claim the task is finished. Report the exact blocker and leave all recoverable work intact.

Read-only questions and reviews that do not change repository files do not require an empty commit or redundant deployment.
