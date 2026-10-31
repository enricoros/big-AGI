# aix-openai-sandbox-keepalive

Scale test of the OpenAI sandbox keep-alive (`src/modules/aix/server/dispatch/chatGenerate/adapters/openai.companion-containerKeepAlive.ts`)
against a mock Containers API. No network, no key, about 2.5 minutes.

The keeper discovers a response's containers by listing the newest ones, newest first and paginated, keeps the `auto` and
`running` ones created around each registration, pings every target once per tick through a small pool, and releases on the
executor's `finally` or on the intake abort. This test runs that code path with 100 staggered registrations against a listing
of 620 mock containers: 200 of ours, 60 same-second neighbors, 40 expired, 20 explicit, 300 older. Then it aborts 20 fresh
registrations before their first tick.

```bash
NODE_ENV=development npx tsx tools/test/aix-openai-sandbox-keepalive/scale-mock.ts
```

Expectations, exit code 1 if any fails:

- the listing is paginated, 3 to 5 pages, stopping past the oldest registration's window
- all 200 of ours are discovered; the 60 same-second neighbors are pinged too, by design on a shared key
- expired, explicit and older containers are never pinged
- each target is pinged exactly once per tick across the 100 registrations
- after the abort, no listing and no ping happen at the first tick

Not covered here: the real API's listing contract (`order=desc`, `after=<last_id>`, `has_more`, `last_id`), checked against
`api.openai.com` on 2026-10-31, and the end-to-end effect, measured there with pro-mode runs whose first cell came after 20
minutes: cells fail without the keep-alive, succeed with it.
