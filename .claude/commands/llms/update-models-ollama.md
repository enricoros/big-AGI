---
description: Update Ollama model definitions with latest featured models
---

Update `src/modules/llms/server/ollama/ollama.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Automated Workflow:**
```bash
# 1. Fetch the HTML (sorted by newest for stable ordering)
curl -s "https://ollama.com/library?sort=newest" -o /tmp/ollama-newest.html

# 2. Parse it with the script
node .claude/scripts/parse-ollama-models.js > /tmp/ollama-parsed.txt 2>&1

# 3. Review the parsed output
cat /tmp/ollama-parsed.txt
```

The parser outputs: `modelName|pulls|capabilities|sizes`
- Example: `deepseek-r1|66200000|tools,thinking|1.5b,7b,8b,14b,32b,70b,671b`

**Primary Sources:**
- Model Library: https://ollama.com/library?sort=newest
- Parser script: `.claude/scripts/parse-ollama-models.js`

**Fallbacks if blocked:** Check https://github.com/ollama/ollama, search "ollama featured models", "ollama latest models", or search GitHub for latest model info

**Important:**
- Parser filtering rules:
  - Top 30 newest models are always included (regardless of pull count)
  - After top 30, only models with 50K+ pulls are included
  - Models with 'cloud' capability are automatically excluded
  - Models with 'embedding' capability are automatically excluded
- Sort them in the EXACT same order as the source (newest first, for stable ordering)
- Extract tags: 'tools' → hasTools, 'vision' → hasVision, 'embedding' → isEmbeddings (note the 's'), 'thinking' → tags only
- Extract 'b' tags (1.5b, 7b, 32b) to tags field
- Set today's date (YYYYMMDD format) for newly added models only
- Update OLLAMA_LAST_UPDATE constant to today's date
- Do NOT change dates of existing models
- Review the full model list for additions, removals, and changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments and newlines to make diffs easy to review
