---
description: Update Meta AI (Muse) model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/metaai.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code. The vendor's protocol facts live in `kb/modules/LLM-metaai-responses.md`; the adapter deviations are the `metaai` row of `_RSP_DIALECT_QUIRKS` in `src/modules/aix/server/dispatch/chatGenerate/adapters/openai.responsesCreate.ts`.

**Primary Sources:** dev.meta.ai/docs. Appending `.md` to any docs URL returns raw markdown that plain `curl` fetches (no auth, no browser needed).
- Doc index: https://dev.meta.ai/docs/llms.txt (92 pages; one `curl` loop mirrors the whole set when a deep read is needed)
- Models, tiers, modalities, context windows: https://dev.meta.ai/docs/models.md
- Pricing and rate limits: https://dev.meta.ai/docs/pricing-rate-limits.md - Standard vs Contributor per-token tables, the search-grounding surcharge, per-image and per-hour prices, RPM/TPM per tier (page carries an unresolved "confirm these numbers" editorial note - Standard limits are wire-verified, the rest provisional)
- Reasoning effort ladder: https://dev.meta.ai/docs/reasoning.md
- Responses API: https://dev.meta.ai/docs/protocols/responses.md; full schema https://dev.meta.ai/docs/api-reference/responses/schemas.md (5,300 lines - grep it, don't read it)
- Capability pages to diff against `interfaces` / `parameterSpecs`: tool-calling.md, tool-search.md, search-grounding.md, structured-output.md, image-understanding.md, video-understanding.md, file-handling.md, image-generation.md, prompt-caching.md
- Release dates (the API carries none): the announcement posts on ai.meta.com/blog and research.meta.ai/blog, and the release table on Wikipedia's "Muse Spark" page. Known: Spark 1.1 2026-07-09, Muse Image 2026-07-07, Spark 1.2 2026-08-05, Spark 1.3 2026-09-02.
- There is NO Model API changelog (`muse-code/changelog.md` is the CLI's). Third-party trackers (llm-stats.com/models/muse-spark-1.3, openrouter.ai/meta/muse-spark-1.3) are fallbacks for dates and benchmarks only.

**Do NOT use web search for facts.** Fetch the URLs directly; search only to locate release announcements.

**Known gaps and traps (verified 2026-09-02):**
- `GET /v1/models` and `GET /v1/models/{id}` return only `{id, object, created: 0, owned_by: 'meta'}`: `created` is a constant 0 (useless for pubDate or ordering, despite models.md claiming otherwise) and there is no type/modality field. The list does not establish what a model IS - cross-check every id against models.md before curating it as chat.
- The list mixes families: `muse-image-1.0` (image output over Responses; curated with `LLM_IF_Outputs_Image` + `LLM_IF_HOTFIX_NoStream`) and `muse-voice-transcribe-1.0` (ASR on `/v1/asr`, 404 on `/v1/responses`; dropped via `_METAAI_NON_CHAT_PREFIXES`). A new non-chat family goes in that deny-list or gets curated with the right output interfaces.
- `-contributor` ids are the same model at ~12x/21x lower rates and Meta trains on prompts and completions: keep them `hidden: true` with the tradeoff in `description`; never a default pick.
- `maxCompletionTokens` is undocumented: 131072 is Meta's advertised figure (quickstart / coding-agents configs); the server accepts `max_output_tokens` up to 1M, so do not derive it from probes.
- Docs print keys as `LLM|...` while served keys are `LLM_...`: `validateSetup` accepts both, do not tighten.

**Live endpoint (extra signal):** If `.env.api-keys` has `METAAI_API_KEY`, scan the served list for new ids: `curl https://api.meta.ai/v1/models -H "Authorization: Bearer $METAAI_API_KEY"`. Never commit or echo the key.

**Probing tips:**
- Effort domain: `POST /v1/responses` with `{"model":"<id>","input":"pong","max_output_tokens":64,"reasoning":{"effort":"<v>"}}`. A bad value 400s with `unknown variant X, expected one of ...` (the full server enum); a value the model rejects 400s with `does not support "<v>" with this model`. As of 2026-09-02 the enum is `none|minimal|low|medium|high|xhigh`, `none` is rejected on every Spark, `max` is not served yet (Meta announced it for 1.3 - re-probe). Omitted effort runs as `high`.
- Unknown TOP-LEVEL request params 400 with `unknown parameter X` - cheap discovery of new fields; unknown nested keys are silently ignored.
- `tool_choice` accepts only `auto`; `truncation` only `disabled`; logprobs are unreachable while reasoning is on.
- Temperature 2.0 is accepted but degenerate (rambling `incomplete` replies, occasional HTTP 500) - the sweep records 0..1.5; do not read a 500 there as an outage.
- End-to-end ablations through the real pipeline (tools, search, reasoning, image output): `npx tsx tools/develop/aix-protocol-lab/lab.ts capture metaai-responses <hello|reason|fc|search|interleave> [--model <id>] [--no-stream]`
- Parameter acceptance sweep: `tools/develop/llm-parameter-sweep/sweep.sh --dialect metaai --key $METAAI_API_KEY --model-filter muse-spark` writes `llm-metaai-parameters-sweep.json`; then `/llms:verify-parameters metaai` diffs it against the definitions.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content
