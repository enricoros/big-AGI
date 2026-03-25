# Performance Audit

This repo now ships a reproducible performance audit flow for long chat and long council sessions.

## What is measured

- Build and bundle size via `npm run perf:build`
- Browser session load and post-interaction metrics via `npm run perf:browser`
- Synthetic long transcripts behind `?perf=1&perfSeed=chat-long` and `?perf=1&perfSeed=council-long`
- Instrumented browser-side derivations through `window.__BIG_AGI_PERF__`

## Perf-only seeds

Perf seeds are disabled unless both of these are true:

- `perf=1`
- `perfSeed=chat-long` or `perfSeed=council-long`

Examples:

- `/ ?perf=1&perfSeed=chat-long`
- `/ ?perf=1&perfSeed=council-long`

The seed bootstrap is loaded dynamically and only on those perf URLs, or when restoring the pre-seed chat state after leaving perf mode.

## Commands

Build and bundle report:

```bash
npm run perf:build
```

Browser session profiling against an already running server:

```bash
PERF_BASE_URL=http://127.0.0.1:3101 npm run perf:browser
```

Full audit:

```bash
npm run perf:audit
```

`perf:audit` runs the build profiler and then the browser profiler. The browser profiler expects a reachable app URL; override it with `PERF_BASE_URL`.

## Artifacts

Artifacts are written to `artifacts/perf/`:

- `next-build-profile.json`
- `browser-session-summary.json`
- `browser-session-chat-long.json`
- `browser-session-council-long.json`
- `browser-session-*.trace.json`
- `browser-session-*.jpeg`

## Browser inspector

When profiling manually in a browser, these helpers are available:

```js
window.__BIG_AGI_PERF__.snapshot()
window.__BIG_AGI_PERF__.print()
window.__BIG_AGI_PERF__.reset()
window.__BIG_AGI_PERF__.enable()
window.__BIG_AGI_PERF__.disable()
```
