# Development Tools - Worktrees

## `wt.sh`

Manage git worktrees with development configurations.

```bash
wt.sh <branch-name>                # Create worktree from HEAD
wt.sh <branch-name> --from <ref>   # Create from a specific ref
wt.sh <branch-name> --no-env       # Create without copying .env* files
wt.sh <branch-name> --no-ide       # Create without launching the IDE
wt.sh --materialize <branch|path>  # Copy .env* + run configs, npm install into an existing worktree
wt.sh --remove <branch-name>       # Remove worktree
wt.sh --list                       # List worktrees
```

Creates worktree at `../big-agi_<branch-name>` with:

- New branch at current HEAD, or `--from <ref>` when provided
- All `.env*` files, unless `--no-env` is provided
- IntelliJ/WebStorm configurations
- Auto `npm install`

Main worktree is protected from removal.
