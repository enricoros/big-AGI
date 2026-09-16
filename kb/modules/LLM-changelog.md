# LLM Changelog - per-service model history and the Update All session

Every model listing records its outcome, so the app can answer "when was this service last checked,
and what changed" without re-listing. Closes #1204 (refresh all models, with a per-service report of
what was added, removed, or failed). The log is a bounded, device-local list of small entries in the
models store (`changelog`, next to `llms` and `sources`); the listing code writes them, the Updates
screen and the Preferences alert read them. Types and pure logic live in `llms.changelog.ts`.

## Entries

One entry per service per operation: the operation stamp `at` (shared by every service of the same
session, which is how a surface sums a session up), the service id, `via` (`service` for a single
listing from any button or the wizard, `all` for Update All, `boot` for the startup defs refresh),
`n` models listed, `add` / `rem` / `mod` as the diff, or `err` as a single-line failure message (a
failed listing leaves the models untouched). Model refs are the DLLM id minus the `${sId}-` prefix.

`mod` maps a ref to change letters. The table is FROZEN and append-only: letters are storage, the UI
renders the words, and unknown letters (from a newer build) render as "changed".

| Letter | Word | Compares |
|---|---|---|
| `l` | name | label |
| `c` | context | context window |
| `o` | output limit | max output tokens |
| `i` | capabilities | interfaces, order-insensitive |
| `p` | pricing | price values only: input, output, cache read/write, per-call tool fees |
| `s` | parameters | parameter specs, canonical (spec and key order do not count) |
| `h` | hidden | hidden flipped to true (editorial curation) |
| `v` | shown | hidden flipped to false |
| `r` | release date | pubDate (see [LLM-editorial-pubdate.md](LLM-editorial-pubdate.md)) |
| `b` | benchmark | benchmark, canonical |

Rules that keep the diff honest:

- Structured fields compare by value, never by stored shape: a build that reshapes the pricing
  object (the wire cache tag dropped in Sep 2026, a renamed key) is not a price change on the first
  listing after the upgrade. Derived and informational pricing fields are not prices either.
- Not compared: `created`/`updated` (vendor churn, TogetherAI re-stamps them on redeploys),
  `description` (prose churn), initial parameters (derived from output limit and specs), the user's
  own overrides, and user clones (never reported as removed).
- Noise letters `b h v o` are recorded and shown, but do not count as a "change": `b h v` are
  editorial sweeps, `o` flaps on aggregators. An entry with no diff and no error is "eventless".
- Routers (OpenRouter) advertise the price, context and output limit of whichever provider they
  rank first at the moment (22 providers behind one DeepSeek model, input prices from 0.58 to 1.65
  per million, probed 2026-09-16), so `c`, `o` and `p` are not recorded for them at all: a routing
  swing is not a model change. The expanded row says so.
- First listing: a service whose stored list was empty records `{ n }` only, no `add`. A creation
  is not N additions.
- Caps: 32 refs per `add` / `rem` / `mod`; in a capped `mod`, context, capability and price changes
  survive first; the UI appends `+` at the cap.

`DLLM.firstSeen` (`YYYYMMDD`) is stamped in the same pass, only on models that appear after their
service's first listing; absent means "there since the first listing". Store-owned like the user
fields (carried across refreshes), it answers "how long has this been here" beyond the log window.

## Retention

Pruning runs on every write and on rehydration, and the result is newest first:

1. per service, only the newest no-change check is kept, and a run of identical errors keeps its newest;
2. per service, three entries are pinned past every bound: the newest ("checked"), the newest
   meaningful ("last change") and the newest successful listing (so a failing service still shows
   when it last listed fine);
3. entries younger than 30 days, at most 50.

Arithmetic: ~50 chars for an eventless entry, 150-400 for a meaningful one, ~2.5K for a worst-case
capped one, so the count cap is the byte bound: 125K chars at the theoretical worst, 10-50K in
practice, plus the pins on top (~8K per ten services at most), against a measured 133K-char store
for 145 models (~0.9M for a 1000-model user). The one case that approaches the bound is an
aggregator whose blended prices drift on every listing; that is a comparison tolerance question,
not a retention one.

Nothing here ships in a backup or survives an import: backups serialize the services only, and
import rebuilds them from id/label/vendor/setup, so an imported service starts with no history. The
store is not synced on either branch; if it ever syncs as one snapshot row, the log rides along as
the last writer's observation. Surfaces say "last checked", never "full history".

## The refresh session

One session at a time, shared by boot and Update All; a caller arriving while one runs joins it. It
lists a few services in parallel over a snapshot queue, one changelog entry each, through the same
react-query key as the per-service listings, so a session dedupes with the modal's per-service
button and with every vendor setup panel (one vendor call, one entry), and those controls show the
session's in-flight state for free. Listing failures are swallowed (already recorded); the models
re-rank to the services order afterwards, since a listing prepends its service's block.

The session lives in a small non-persisted store: progress (start stamp, last stamp, service ids,
done ids, what started it) and control (a promise that resolves when it ends and never rejects, and
a stop). Nothing about it lives in React, so closing the dialog does not stop a run; the boot run can
be stopped from the Updates screen. A stop skips the pending services and drops in-flight results: a
listing that lands afterwards writes nothing and logs no entry.

Stamping: every successful listing, whatever the trigger, stamps the service with the current model
definitions version, so a service the user just listed is not re-listed at the next boot. Boot
additionally pre-stamps before each attempt as its loop protection (a dead service is not retried
every boot, but at its next version). See [LLM-defs-refresh.md](LLM-defs-refresh.md).

Eligibility for Update All: a known vendor, and not positively unconfigured (the service has
models, or a server-side key, or a client setup that validates; vendors without a validator are
attempted).

The boot refresh resolves to the session stamp (null when nothing was stale): the hook for a future
"models added" notice.

## Surfaces

- **Service selector**: an "All services" pseudo-option opens the Updates screen (breadcrumb
  "Configure > AI Models > Updates", AI Models links back); the delete slot holds the primary
  "Update all" button, which reads "N of M..." behind a spinner while a session runs.
- **Three-dot menu**, "All Services" submenu: Update All Models, Updates, then Direct Connection.
- **Preferences > AI**: a refresh icon button beside "AI Models" starts a session; a clickable alert
  under the row shows "Updating N of M services...", then "All models are up to date" or the counts
  ("3 added, 1 changed; 2 services failed"), and opens the dialog on the Updates screen. It hides once
  anything newer is logged, and never shows for a boot session.
- **Updates screen**: a header with three states (last checked; running, with a progress bar and
  Stop; the last session's outcome with count chips), then one row per service sorted by label:
  models, Updated (newest entry, green when it belongs to the current or last session, "Listing..."
  and "Queued" during one), Last change (newest meaningful entry with `+N ~N -N` chips, or the
  failure text). Rows with history expand into one block per operation (date, an "Automatic (app
  update)" caption for boot entries, one chip per ref with the change words), five entries then
  "Show N more", and two buttons: configure the service, refresh it alone. The service name opens
  its setup.

The existing models-updated analytics event carries the trigger (`service` / `all` / `boot`).

## Future home box

"Recently added to your services" = entries with `add` within N days, ids rebuilt as `${sId}-${ref}`
and resolved against the store; beyond the window, `firstSeen` gives the same answer per model. It is
disjoint from the pubDate-based "newly published" path, which asks what the vendor released, not what
appeared in the user's services. The Update All function is the trigger a home surface calls.

## Extending

Append a letter and its word, and add it to the noise or priority set if it belongs there. Never
reuse a letter: stored entries keep their meaning. On `dev`, the backend-capability helper the
eligibility check calls has a different name; the rebase reports no conflict on the new session file,
so rename that one call when the type check flags it.
