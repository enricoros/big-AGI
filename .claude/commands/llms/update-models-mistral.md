---
description: Update Mistral model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/mistral.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models: https://docs.mistral.ai/models - also has the deprecated/retired table (model, version, API id, deprecation date, retirement date, replacement; an empty replacement means none)
- Pricing: per-model cards at https://docs.mistral.ai/models/<slug> (price, context, release date, status, deprecation). https://docs.mistral.ai/inference/pricing and https://mistral.ai/pricing are server-rendered too, but only the cards show both the sale and the original price. Slugs are doc names, not API ids (`mistral-medium-3-5-26-04`, `mistral-small-4-0-26-03`, `mistral-large-4-0`, `zai-glm-5-3`); guessing them 404s, so harvest with `curl -sL https://docs.mistral.ai/models | grep -o 'models/[a-z0-9._-]*' | sort -u` (ignore `overview`, `model-cards`, `model-selection-guide`, `page-*.js`)
- Changelog: https://docs.mistral.ai/resources/changelogs

**Reading cards:** pages are ~1MB, mostly embedded i18n JSON on very long lines. Strip tags first (`sed -e 's/<[^>]*>/ /g' | tr -s ' \n'`), then match short fixed anchors: the header reads `Models Models <Name> ... <Month D, YYYY> <Status> <License> v <version> <description>`; prices read `Original price: $X Sale price: $Y` when discounted, plain `$X Input /M Tokens` otherwise; deprecated cards carry `Deprecation date M/D/YYYY`. Avoid bounded-context regexes (`.{0,400}...`) on these files: they backtrack for minutes, and some `grep` builds (ugrep) reject them outright - use `python3` for anything beyond a fixed-string match.

**Fallbacks if blocked:**
- Search "mistral [model-name] latest pricing",  "mistral api latest pricing", "mistral latest models", or search GitHub for latest model prices and context windows
- Cross-reference: pricepertoken.com, artificialanalysis.ai
- Check Mistral API list models response
- As last resort: Use Chrome DevTools MCP to render pricing table

**Live endpoint (extra signal):** If `.env.api-keys` has `MISTRAL_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above: `curl https://api.mistral.ai/v1/models -H "Authorization: Bearer $MISTRAL_API_KEY" -o /tmp/mistral-models.json`. Write responses to files for `jq` (piping through `echo` can turn escaped newlines into raw control characters and break `jq`). Never commit or echo the key. Each entry carries `aliases`, `max_context_length`, `capabilities` (incl. `reasoning`, `vision`, `function_calling`), and `deprecation` / `deprecation_replacement_model`; retired models disappear from this list, which is the signal to drop their `_knownMistralModelDetails` entries. `deprecation` holds the *retirement* date (the earlier docs deprecation date is not in the API). Docs-retired models can stay served for days: keep them while listed, and note it. Where the card and the API disagree on context, the API's `max_context_length` wins (cards lag). `labs-*` models are listed but 403 unless an org admin enables Labs.

**reasoning_effort probe:** for every new model with `capabilities.reasoning`, probe the enum instead of copying a sibling's spec - Mistral-built and third-party models differ (Medium 3.5 / Small 4 / Large 4: `none|high`; GLM 5.2: `none|low|high|max`; GLM 5.3: `low|high|max`). A rejected value returns 400 with the supported list in the message. Also send one request without the field, to record whether the model reasons by default.
```bash
for e in none minimal low medium high xhigh max; do
  jq -nc --arg m "$MODEL" --arg e "$e" '{model:$m,max_tokens:400,reasoning_effort:$e,messages:[{role:"user",content:"What is 17*23?"}]}' > /tmp/body.json
  code=$(curl -s -o /tmp/probe.json -w '%{http_code}' https://api.mistral.ai/v1/chat/completions -H "Authorization: Bearer $MISTRAL_API_KEY" -H 'Content-Type: application/json' -d @/tmp/body.json)
  printf '%s %s -> %s ' "$MODEL" "$e" "$code"; jq -c 'if .choices then [.choices[0].message.content | if type=="array" then .[].type else "string" end] else (.message // .detail) end' /tmp/probe.json
done
```

**Pricing rules:**
- Cached input is 10% of input on every priced row (cards round it to 2 decimals: $0.136 shows as $0.14); model it as `cache.read`
- Sale/introductory prices: store the price actually charged, put the list price and the end date (or "undated") in a comment, and say to flip to list when it ends - as `gemini.models.ts` and `zai.models.ts` do
- Third-party hosted models (Z.ai GLM): take `pubDate` and lmarena score from that vendor's own model file, with the existing `- 2` yield to the native vendor

**Validation:** `npm run tscheck` runs `npm install` first (`pretscheck`), which can rewrite `package-lock.json`; run `npx --no-install tsc --noEmit --pretty` and `npx --no-install eslint <model file>` instead, or revert the lockfile churn. Check alias groups by hand: with no YYMM id, the second sorted id of a group is the visible one; the hide pass hides a model whose id minus its last 4 chars equals its sorted neighbour's (e.g. `zai-glm-5-3` hides `zai-glm-5-2`).

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review: add a new version's entries under the existing section header instead of rewriting the header for it, and put deprecation notes in the superseded entry's trailing comment
- Flag broken links or unexpected content
