# Gemini Interactions API

The Interactions API powers Gemini's managed-agent runs. Currently wired:
- **Deep Research** (`deep-research-*-preview-*`) — research/synthesis agent. Requires `background=true`; rejects top-level `system_instruction` (we prepend to input). Configurable via `agent_config` (`thinking_summaries`, `visualization`).
- **Antigravity Agent** (`antigravity-preview-05-2026`, released 2026-05-19) — general-purpose Gemini-3.5-Flash-powered agent inside a Google-hosted Linux sandbox with code_execution / google_search / url_context / filesystem tools. REJECTS `background=true` (we omit it); accepts native `system_instruction`; needs `environment` ('remote' for fresh sandbox; `env_<id>` to resume). [Docs](https://ai.google.dev/gemini-api/docs/antigravity-agent).

Per-agent flags live in `gemini.interactionsCreate.ts` (`isDeepResearch` / `isAntigravity` gates). This doc is the source of truth for protocol shape, failure modes, and the recovery model — code comments link here instead of repeating the rationale.

## References

- **GH [#1088](https://github.com/enricoros/big-AGI/issues/1088)** — Auto-resume for Deep Research; Recover button
- **GH [#1095](https://github.com/enricoros/big-AGI/issues/1095)** — Visualizations toggle (`agent_config.visualization`)
- **Google forum [143098](https://discuss.ai.google.dev/t/interactions-api-connection-breaks-at-the-10-minutes-mark/143098)** — 10-min SSE cut
- **Google forum [143099](https://discuss.ai.google.dev/t/streaming-resume-broken-on-interactions-api-deep-research-often-cannot-resume/143099)** — Streaming resume re-cuts
- **Upstream specs** — `_upstream/gemini.interactions.spec.md`, `gemini.interactions.guide.md`, `gemini.deep-research.guide.md`

## Endpoints

| Verb   | Path                                      | Purpose                                                           |
|--------|-------------------------------------------|-------------------------------------------------------------------|
| POST   | `/v1beta/interactions`                    | Start a run. We always send `stream:true, background:true, store:true` |
| GET    | `/v1beta/interactions/{id}?stream=true`   | Reattach via SSE replay (full event sequence from start)          |
| GET    | `/v1beta/interactions/{id}`               | Fetch the resource as JSON (one-shot)                             |
| POST   | `/v1beta/interactions/{id}/cancel`        | Stop a background run                                             |
| DELETE | `/v1beta/interactions/{id}`               | Remove the stored record (does NOT cancel an in-flight run)       |

Retention: 1 day free, 55 days paid.

## Status taxonomy

| Status            | Meaning                                       | Handling                                              |
|-------------------|-----------------------------------------------|-------------------------------------------------------|
| `in_progress`     | Live run **or** zombie (see C)                | Surface diagnostics; offer Resume/Recover/Stop        |
| `completed`       | Done with content in `outputs[]`              | Emit fragments, `tokenStopReason='ok'`                |
| `failed`          | Server-side failure                           | Terminating issue                                     |
| `cancelled`       | We or another client cancelled                | Close as `cg-issue`                                   |
| `incomplete`      | Stopped early (token limit) — partial outputs | Note + `tokenStopReason='out-of-tokens'`              |
| `requires_action` | Not expected for Deep Research                | Fail loudly so we notice                              |

## Two retrieval paths

| Path                  | Endpoint                          | Parser                                    | Use case                          |
|-----------------------|-----------------------------------|-------------------------------------------|-----------------------------------|
| SSE replay            | `GET ?stream=true`                | `createGeminiInteractionsParserSSE`       | Canonical resume; live deltas     |
| JSON GET (recovery)   | `GET` (no `stream`)               | `createGeminiInteractionsParserNS`        | Recover when SSE is broken        |

Both replay from the start — `ContentReassembler` REPLACES content on reattach, so partial replay (`last_event_id`) is intentionally NOT used. The NS parser walks `outputs[]` (thoughts, text, images, audio) and emits the same particles the SSE parser would, in one batch.

## Failure modes

### A. 10-minute SSE cut (forum 143098)

The SSE connection gets cut at exactly 600 s, regardless of activity. The cut is malformed (JSON error array instead of clean SSE close) and we treat it as stream-closed-early. The run typically **continues** server-side and reaches `completed`. **Recover (JSON GET)** retrieves the full report.

### B. Streaming resume re-cuts (forum 143099)

A fresh SSE replay can re-cut at the same 10-minute boundary on long runs, so Resume alone never reaches `interaction.complete`. **Recover** is the fallback.

### C. Zombie interactions (#1088)

Resource sits in `status: in_progress` for **days** with `outputs: []` — the generator crashed but the status never transitioned. **Not recoverable** (no data was ever produced). The NS parser surfaces `created`, `updated`, output count, and a "stuck for over an hour" hint so the user can decide to delete and retry.

### D. Connection drop mid-run

Network blip; resource is fine. **Resume (SSE replay)** picks up cleanly.

## UI

`BlockOpUpstreamResume` renders up to three buttons:

| Button   | Action                            | Shown when                                              |
|----------|-----------------------------------|---------------------------------------------------------|
| Resume   | SSE replay                        | `onResume` provided                                     |
| Recover  | JSON GET (one-shot)               | `upstreamHandle.uht` ∈ `_NS_RECOVER_UHTS`               |
| Stop     | Cancel + delete upstream resource | `onDelete` provided                                     |

The Recover gate is an inline `uht === 'vnd.gem.interactions'` check in `BlockOpUpstreamResume.tsx` — extend when another vendor needs the same fallback. Stop is intentionally NOT gated by Resume/Recover busy state — it's the escape hatch for hung resumes.

## Visualization control (#1095)

Deep Research accepts `agent_config.visualization: 'auto' | 'off'`. Exposed as `llmVndGeminiAgentViz` (label "Visualizations"). Forwarded only when explicitly `'off'` so the upstream `'auto'` default stays untouched. Useful when merging multiple reports — image fragments break Beam fusion.

## Code map

| File                                                                                 | Role                                                  |
|--------------------------------------------------------------------------------------|-------------------------------------------------------|
| `aix/server/dispatch/wiretypes/gemini.interactions.wiretypes.ts`                     | Zod schemas (RequestBody, Interaction, StreamEvent)   |
| `aix/server/dispatch/chatGenerate/adapters/gemini.interactionsCreate.ts`             | POST body (input + agent_config)                      |
| `aix/server/dispatch/chatGenerate/parsers/gemini.interactions.parser.ts`             | SSE parser + NS parser                                |
| `aix/server/dispatch/chatGenerate/chatGenerate.dispatch.ts` (`gemini` case)          | Resume dispatch: SSE vs JSON branch                   |
| `apps/chat/components/message/BlockOpUpstreamResume.tsx`                             | Resume / Recover / Stop UI                            |
| `apps/chat/components/ChatMessageList.tsx` (`handleMessageUpstreamResume`)           | Wires click handler to `aixReattachContent_DMessage_orThrow` |
