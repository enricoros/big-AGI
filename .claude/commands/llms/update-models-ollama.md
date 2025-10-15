---
description: Update Ollama model definitions with latest featured models
---

Update `src/modules/llms/server/ollama/ollama.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.data.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Model Library: https://ollama.com/library?sort=featured

**Fallbacks if blocked:** Check https://github.com/ollama/ollama, search "ollama featured models", "ollama latest models", or search GitHub for latest model info

**Important:**
- Skip models below 50,000 pulls
- Sort them in the EXACT same order as the source (featured models)
- Extract tags: 'tools' → hasTools, 'vision' → hasVision, 'embedding' → isEmbedding
- Extract 'b' tags (1.5b, 7b, 32b) to tags field
- Set today's date (YYYYMMDD format) for newly added models only
- Update OLLAMA_LAST_UPDATE constant to today's date
- Do NOT change dates of existing models
- Review the full model list for additions, removals, and changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments and newlines to make diffs easy to review
- Sort them in the EXACT same order as the source (featured models)
