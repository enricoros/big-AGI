# Development Tools - Worktrees

## `create-dev-worktree.sh`

Manage git worktrees with development configurations.

```bash
create-dev-worktree.sh <branch-name>                # Create worktree from HEAD
create-dev-worktree.sh <branch-name> --from <ref>   # Create from a specific ref
create-dev-worktree.sh <branch-name> --no-env       # Create without copying .env* files
create-dev-worktree.sh --remove <branch-name>       # Remove worktree
create-dev-worktree.sh --list                       # List worktrees
```

Creates worktree at `../big-agi_<branch-name>` with:

- New branch at current HEAD, or `--from <ref>` when provided
- All `.env*` files, unless `--no-env` is provided
- IntelliJ/WebStorm configurations
- Auto `npm install`

Main worktree is protected from removal.
