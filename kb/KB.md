## Knowledge Base

Architecture and system documentation is available in the `/kb/` knowledge base, for use by AI agents and developers.

**Structure:**
- `/kb/KB.md` - Already in context: this text
- `/kb/vision-inlined.md` - Already in context (next section): long-term vision and north stars
- `/kb/modules/` - Core business logic (e.g. AIX)
- `/kb/systems/` - Infrastructure (routing, startup)

### Modules Documentation

#### AIX - AI Communication Framework
- **[AIX.md](modules/AIX.md)** - AIX streaming architecture documentation
- **[AIX-callers-analysis.md](modules/AIX-callers-analysis.md)** - Analysis of AIX entry points, call chains, common and different rendering, error handling, etc.

#### CSF - Client-Side Fetch
- **[CSF.md](systems/client-side-fetch.md)** - Direct browser-to-API communication for LLM requests

#### LLM - Language Model Metadata
- **[LLM-editorial-control.md](modules/LLM-editorial-pubdate.md)** - Where we have editorial control over per-model metadata vs dynamic discovery; `pubDate` field semantics, propagation chain, resolution rules, per-vendor matrix
- **[LLM-editorial-auto-picks.md](modules/LLM-editorial-auto-picks.md)** - Per-domain Auto model resolution: 3-layer fallback (pin, editorial pick, ELO/cost heuristic), editorial table shape, tolerant matching, compile-time type-safety chain
- **[LLM-models-catalog-pipeline.md](modules/LLM-models-catalog-pipeline.md)** - Forward-looking pipeline: extraction script, snapshot artifact, website consumption, future schema extensions

#### LLM - Vendor APIs
- **[LLM-gemini-interactions.md](modules/LLM-gemini-interactions.md)** - Gemini Interactions API (Deep Research): endpoints, status taxonomy, two retrieval paths (SSE replay vs JSON GET), known failure modes (10-min cuts, zombies), UI surface

### Systems Documentation

#### Core Platform Systems
- **[app-routing.md](systems/app-routing.md)** - Next.js routing, provider stack, and display state hierarchy
- **[LLM-parameters-system.md](systems/LLM-parameters-system.md)** - Language model parameter flow across the system
- **[LLM-vendor-integration.md](modules/LLM-vendor-integration.md)** - Adding new LLM providers

### KB Guidelines

#### Writing Style

- **Direct and factual** - No marketing language
- **Present tense** - "AIX handles streaming" not "AIX will handle"
- **Active voice** - "The system processes" not "Processing is done by"
- **Concrete examples** - Show actual code/config when helpful, briefly

#### Maintenance

- Remove outdated knowledge base information when detected
- Keep cross-references current when files move
