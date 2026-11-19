#!/usr/bin/env sh
#
# Jobs: work that runs against the live world (vendors, deployments), started by a schedule, a webhook or by hand,
# and never by `npm test`. One folder per job, named for its subject and what it does to it. This script runs them.
#
#   sh tools/jobs/jobs.sh csf-cors-checker           one job
#   sh tools/jobs/jobs.sh csf                        every job whose name starts with it
#   sh tools/jobs/jobs.sh llm-registry-sync --help   one job, with arguments for it
#   sh tools/jobs/jobs.sh                            lists the jobs
#
# A job is one file in its folder, <subject>.<kind>.ts:
# - checker: a node:test file. It prints what it assumes first, then what differs from the code today, and fails
#   only on what must be fixed
# - sync: a script that brings a local copy in line with the outside. It takes arguments
# Exit status: 0 clean, 1 a job failed, 2 nothing to run.
# Jobs use real keys: from the environment, .env.api-keys, or tools/jobs/llm-registry-sync/llm-services.json.
#
# Settings are per machine and never committed: tools/jobs/.env for every job, tools/jobs/<job>/.env for that job.
# Both hold one NAME=value per line, given to the job as its environment. They are read as text, not run by a
# shell: everything after the = is the value.
#
# When a job runs is written in the scheduler only (node on its PATH). Jobs of one checkout must not overlap: they
# share its files, and jobs.update.sh replaces them. Give them one lock and a time limit. cron on Linux, hourly:
#   7 * * * *  flock -w 120 /tmp/jobs.lock timeout -k 1m 10m sh /path/to/tools/jobs/jobs.sh llm-listing-checker
# A machine that runs the jobs unattended updates its checkout first, under the same lock: tools/jobs/jobs.update.sh.
#
# With JOBS_DISCORD_WEBHOOK_URL set in tools/jobs/.env, what breaks is also posted to that Discord channel: once per
# finding, and once more when the job is back to normal. Only breakage is posted (a listing that is down, a job that
# could not run): never drift, never what a job only prints. A run with arguments is a side task, and is not posted.
# What was posted is remembered in tools/jobs/.state/.

cd "$(dirname "$0")/../.." || exit 2

# the file that runs a job: the one <subject>.<kind>.ts of its folder
entry_of() {
  for entry in "$1"/*.checker.ts "$1"/*.sync.ts; do
    [ -e "$entry" ] && echo "$entry" && return
  done
}

# prints the settings of a file, one NAME=value per line, as env(1) takes them. The file is read as text and never
# run: a value may hold spaces, quotes or &. A leading "export " and one pair of quotes around a value are dropped.
# A line that is not a setting, a comment or blank is skipped, and named on stderr by its number, not its content
cr=$(printf '\r')
settings_of() {
  [ -f "$1" ] || return 0
  number=0
  while IFS= read -r line || [ -n "$line" ]; do
    number=$((number + 1))
    line=${line%"$cr"}
    line=${line#export }
    case "$line" in '' | '#'*) continue ;; esac
    name=${line%%=*}
    case "$line" in *=*) ;; *) name= ;; esac
    case "$name" in '' | [0-9]* | *[!A-Za-z0-9_]*)
      echo "jobs.sh: $1 line $number is not a NAME=value setting, skipped" >&2
      continue ;;
    esac
    value=${line#*=}
    case "$value" in
      \"*\") value=${value#\"}; value=${value%\"} ;;
      \'*\') value=${value#\'}; value=${value%\'} ;;
    esac
    printf '%s\n' "$name=$value"
  done < "$1"
}

if [ -z "$1" ]; then
  for dir in tools/jobs/*/; do
    [ -n "$(entry_of "${dir%/}")" ] && basename "$dir"
  done
  exit 2
fi

name="$1"
shift
found=""
count=0
for dir in tools/jobs/"$name"*/; do
  [ -n "$(entry_of "${dir%/}")" ] && found="$found ${dir%/}" && count=$((count + 1))
done
if [ "$count" -eq 0 ]; then
  echo "no job matches: $name" >&2
  exit 2
fi
if [ $# -gt 0 ] && [ "$count" -ne 1 ]; then
  echo "arguments go to one job, and '$name' matches several:$(for dir in $found; do printf ' %s' "$(basename "$dir")"; done)" >&2
  exit 2
fi

# runs one job with its settings as environment: the folder, then the arguments for the job. The settings reach
# the job through env(1) and never become variables of this script, so none of them can change what it does
run_job() {
  dir="$1"
  shift
  entry=$(entry_of "$dir")
  (
    case "$entry" in
      *.checker.ts) set -- npx tsx --test --test-reporter=spec "$entry" ;;
      *) set -- npx tsx "$entry" "$@" ;;
    esac
    # the settings are appended in file order (a later one wins), then the command is moved behind them
    command=$#
    while IFS= read -r setting; do
      [ -n "$setting" ] && set -- "$@" "$setting"
    done <<EOF
$(settings_of tools/jobs/.env; settings_of "$dir/.env")
EOF
    while [ "$command" -gt 0 ]; do
      word=$1
      shift
      set -- "$@" "$word"
      command=$((command - 1))
    done
    exec env "$@"
  )
}

# where to post, when this machine posts
webhook=$(settings_of tools/jobs/.env 2> /dev/null | sed -n 's/^JOBS_DISCORD_WEBHOOK_URL=//p' | tail -n 1)
[ -n "$webhook" ] || webhook=$JOBS_DISCORD_WEBHOOK_URL

worst=0
for dir in $found; do
  job=$(basename "$dir")
  if [ -n "$webhook" ] && [ $# -eq 0 ]; then
    mkdir -p tools/jobs/.state
    JOBS_FINDINGS_FILE="tools/jobs/.state/$job.findings"
    export JOBS_FINDINGS_FILE
    : > "$JOBS_FINDINGS_FILE"
    run_job "$dir"
    status=$?
    JOBS_DISCORD_WEBHOOK_URL="$webhook" node tools/jobs/jobs.notify.mjs "$job" "$status" "$JOBS_FINDINGS_FILE"
  else
    run_job "$dir" "$@"
    status=$?
  fi
  [ "$status" -gt "$worst" ] && worst=$status
done
exit "$worst"
