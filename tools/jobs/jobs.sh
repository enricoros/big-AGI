#!/usr/bin/env sh
#
# Jobs: work that runs against the live world (vendors, deployments), started by a schedule, a webhook or by hand,
# and never by `npm test`. One folder per job, named for its subject and what it does to it. This script runs them.
#
#   sh tools/jobs/jobs.sh csf-cors-checker   one job
#   sh tools/jobs/jobs.sh csf                every job whose name starts with it
#   sh tools/jobs/jobs.sh                    lists the jobs
#
# A checker is <job>/<subject>.checker.ts, in node:test form:
# - it prints what it assumes first, then what differs from the code today
# - it fails only on what must be fixed: exit 0 clean, 1 a job failed, 2 nothing to run
# Jobs use real keys: from the environment, .env.api-keys, or the registry scanner's key file. Each says what it costs.
#
# When a job runs is written in the scheduler only (node on its PATH). cron, Mondays at 6:37:
#   37 6 * * 1  sh /path/to/big-agi/tools/jobs/jobs.sh csf-cors-checker >> /path/to/jobs.log 2>&1
# The reporter is named because older Node versions switch to TAP when the output is not a terminal.
#
# With JOBS_DISCORD_WEBHOOK_URL set, in the environment or in tools/jobs/.env (per machine, never committed), what
# breaks is also posted to that Discord channel: once per finding, and once more when the job is back to normal.
# Only breakage is posted (a listing that is down, a job that could not run): never drift, never what a job only
# prints. What was posted is remembered in tools/jobs/.state/.

cd "$(dirname "$0")/../.." || exit 2

if [ -z "$1" ]; then
  ls tools/jobs/*/*.checker.ts | sed 's|^tools/jobs/||; s|/.*||'
  exit 2
fi

name="$1"
set -- tools/jobs/"$name"*/*.checker.ts
if [ ! -e "$1" ]; then
  echo "no job matches: $name" >&2
  exit 2
fi

[ -f tools/jobs/.env ] && . tools/jobs/.env
if [ -z "$JOBS_DISCORD_WEBHOOK_URL" ]; then
  exec npx tsx --test --test-reporter=spec "$@"
fi

# posting: one job at a time, so that each has its own findings and its own exit status
export JOBS_DISCORD_WEBHOOK_URL
mkdir -p tools/jobs/.state
worst=0
for checker in "$@"; do
  job=$(basename "$(dirname "$checker")")
  JOBS_FINDINGS_FILE="tools/jobs/.state/$job.findings"
  export JOBS_FINDINGS_FILE
  : > "$JOBS_FINDINGS_FILE"
  npx tsx --test --test-reporter=spec "$checker"
  status=$?
  node tools/jobs/jobs.notify.mjs "$job" "$status" "$JOBS_FINDINGS_FILE"
  [ "$status" -gt "$worst" ] && worst=$status
done
exit "$worst"
