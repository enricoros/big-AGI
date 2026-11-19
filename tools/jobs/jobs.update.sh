#!/usr/bin/env sh
#
# Updates this checkout to a remote branch, for a machine that runs the jobs unattended:
#
#   sh tools/jobs/jobs.update.sh origin/main
#
# It DISCARDS local changes to tracked files (git reset --hard): never run it in a checkout you work in. Untracked
# and ignored files (settings, keys, state) are left alone. Packages are installed again only when package-lock.json
# is not the one of the last complete install. It says what failed and exits 1: when the fetch or the reset fails,
# the checkout stays as it was; when the install fails, the code has moved and the install is tried again on the next
# run. The jobs can still run on what is there.

# one block, read whole before it runs: the update may replace this very file
{
  cd "$(dirname "$0")/../.." || exit 2

  ref="$1"
  case "$ref" in
    */*) ;;
    *) echo "usage: sh tools/jobs/jobs.update.sh <remote>/<branch>" >&2; exit 2 ;;
  esac

  before=$(git rev-parse --short HEAD)
  if ! git fetch --quiet "${ref%%/*}"; then
    echo "jobs.update: could not fetch ${ref%%/*}, staying at $before" >&2
    exit 1
  fi
  if ! git reset --quiet --hard "$ref"; then
    echo "jobs.update: could not move to $ref, staying at $before" >&2
    exit 1
  fi
  after=$(git rev-parse --short HEAD)
  [ "$before" = "$after" ] || echo "jobs.update: $before -> $after"

  # the lock file of the last install that completed is remembered inside node_modules: an install that was cut
  # short is tried again on the next run
  wanted=$(git rev-parse HEAD:package-lock.json)
  if [ "$(cat node_modules/.jobs-update 2>/dev/null)" != "$wanted" ]; then
    if npm install --quiet --no-audit --no-fund; then
      echo "$wanted" > node_modules/.jobs-update
    else
      echo "jobs.update: npm install failed, it will be tried again" >&2
      exit 1
    fi
  fi
  exit 0
}
