---
description: Update Ollama model definitions with latest featured models
---

Update `src/modules/llms/server/ollama/ollama.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Automated Workflow:**
```bash
# 1. Fetch the HTML to a cross-platform temp path (sorted by newest for stable ordering)
curl -s "https://ollama.com/library?sort=newest" -o "$(node -p "require('os').tmpdir()")/ollama-newest.html"

# 2. Parse it with the script (auto-finds the file in os.tmpdir())
node .claude/scripts/parse-ollama-models.js 2>&1
```

The parser outputs 5 pipe-delimited fields: `modelName|pulls|capabilities|sizes|cloud`
- `deepseek-r1|91500000|tools,thinking|1.5b,7b,8b,14b,32b,70b,671b|`
- `kimi-k3|39000|vision,tools,thinking||cloud` - cloud-only, so no sizes

**Primary Sources:**
- Model Library: https://ollama.com/library?sort=newest
- Parser script: `.claude/scripts/parse-ollama-models.js`

**Fallbacks if blocked:** Check https://github.com/ollama/ollama, search "ollama featured models", "ollama latest models", or search GitHub for latest model info

**What the file is:** a full mirror of the library index minus embedding models, in page order (newest first). ~222 entries as of 2026-08-17. The parser applies no pull threshold and no top-N cut: every line it prints belongs in the file, and every file entry should be a printed line.

**Cloud models:** cloud-only entries ARE carried (`kimi-k3`, `glm-5.2`, `minimax-m3`, ...). The 5th field is informational only - the file has no cloud marker. Empty sizes on a cloud line is expected, not a parse failure.

**Removals:** remove an entry only when its name is absent from the library index. Do NOT probe `https://ollama.com/library/<id>`: delisted models keep returning 200 there (verified: `glm-5`, `glm-4.7` return 200 while absent from the index), so a 404 test never fires.

**Sanity check the parse before editing:** 200+ lines, non-zero pulls, capabilities present. All-zero pulls or empty capabilities means the page markup changed - fix the regexes in the parser (it warns on this), never write a stripped list into the file.

**Field mapping:**
- `tools` -> `hasTools: true`, `vision` -> `hasVision: true`, `embedding` -> `isEmbeddings: true` (note the 's'; the parser drops embedding models, so this should not come up)
- `thinking` and `audio` -> `tags`, followed by the size chips (`1.5b`, `7b`, `32b`, ...) in page order

**Important:**
- Sort them in the EXACT same order as the source (newest first, for stable ordering)
- Set today's date (YYYYMMDD format) for newly added models only
- Set OLLAMA_PREV_UPDATE to the previous OLLAMA_LAST_UPDATE, then OLLAMA_LAST_UPDATE to today (PREV drives the `isNew` badge)
- Do NOT change dates of existing models
- Review the full model list for additions, removals, and changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments and newlines to make diffs easy to review
