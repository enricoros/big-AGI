# LLM Editorial Auto-Picks (Domain Resolution)

When a model domain (e.g. `primaryChat`, `codeApply`) needs a model and the user has not pinned one, the system resolves an LLM automatically through a 3-layer fallback chain. The editorial layer - the middle layer - is a hand-curated table of per-domain model preferences that gives predictable, cross-vendor defaults without relying solely on ELO or cost heuristics.

For the separate editorial axis covering per-model metadata (`pubDate`, pricing, benchmarks), see [LLM-editorial-pubdate.md](LLM-editorial-pubdate.md).


## Resolution layers

`llmsAuto_ModelIdForDomain_SLOW()` in `src/common/stores/llms/store-llms-domains_slice.ts` resolves a domain's model through three layers, tried in order:

### 1. Pin

`modelAssignments[domainId]` holds an explicit user pin. If it exists and points to a valid LLM, use it. A pinned `null` means the user explicitly chose "no model" for that domain.

Absent entry = Auto mode (proceed to layer 2).

### 2. Editorial pick

`llmsEditorial_ModelIdForDomain_SLOW(domainIds, universe)` walks the editorial table for the domain, then for its registry `editorialFallbackDomain` when set, and returns the first `(vendor, modelId)` pair that matches a model in the user's local LLM list.

See [Editorial table](#editorial-table) below.

### 3. ELO/cost heuristic

When no editorial entry matches, the system falls back to one of two strategies (configured per domain in `ModelDomainsRegistry`):

- `topVendorTopLlm` - picks the highest-ELO model from the highest-ELO vendor. Used by `primaryChat`, `codeApply`, `imageCaption`.
- `topVendorLowestCost` - picks the cheapest rated model from the top vendor, else its cheapest priced one (free counts as unpriced). Used by `fastUtil` and `scratchChat`. When the top vendor has nothing rated or priced, its list order is no basis: hosts whose ids carry no data were measured listing an image or a speech model first. There it takes the user's pinned chat model if that is one of the vendor's candidates (for `fastUtil`, models with function calling), else the first listed.

Both strategies group visible LLMs by vendor, rank vendors by their top ELO, then select within the winning vendor.


## Editorial table

Located in `src/common/stores/llms/model.domains.editorial.ts`.

### Shape

Each domain maps to an ordered array of `{ vendor, modelId }` picks:

```ts
export const EditorialDefaults = {
  primaryChat: [
    { vendor: 'anthropic',  modelId: 'claude-opus-5-5' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.8-flash' },
    { vendor: 'openai',     modelId: 'gpt-6.1-sol' },
    // ...
  ],
  codeApply: [ /* ... */ ],
  // ...
} as const satisfies _EditorialDefaultsTable;
```

### Key properties

- **Array order is cross-vendor precedence.** The picker returns the first match - no external ELO ranking is consulted. A Gemini model can sit between two Anthropic picks or vice versa.
- **Per-domain lists.** Each domain (`primaryChat`, `codeApply`, `fastUtil`, `imageCaption`) has its own ordered preferences reflecting the domain's purpose (e.g. `codeApply` favors code-optimized models).
- **Domains without an entry** fall through directly to layer 3 (ELO/cost heuristic).

### Curation rules

- **One pick per service and domain**: the current model at the domain's service level that every user of the service can call. Older generations are not kept as fallbacks: a pick missing from the user's list falls through to layer 3, which already takes the best of what the user has.
- **Service levels**: `primaryChat` is the flagship; `codeApply` a workhorse coder with function calling; `fastUtil` the fast, cheap tier; `imageCaption` quick vision.
- **Order across vendors** follows quality at that level: arena score first, then price and speed.
- **Bedrock** is the exception to one pick: access is per account and region. The newest model comes first, followed by the newest that an account without the enablement can invoke. The picker cannot see access, so the second applies only where the first is not listed; an account without the enablement gets a 403 on the first.
- **OpenRouter** serves every upstream, so it gets a single pick per domain, the best across vendors.
- **NVIDIA NIM** is a free trial catalog: its picks come last, so a configured paid service always wins.

### Matching logic

For each pick, `llmsEditorial_ModelIdForDomain_SLOW` scans the candidates once: an exact `llm.initialParameters.llmRef` match wins, otherwise the first tolerant match in list order. Without the exact-first rule the prefix rule takes OpenRouter's `openai/gpt-6-luna-pro` (listed before the base on same-day releases) for the pick `openai/gpt-6-luna`.

Tolerant matches on `llmRef`:

1. Prefix (vendor-appended date suffixes like `-20250514`)
2. Dot/dash equivalence via `textEqualsDotDashInsensitive` (OpenRouter lists `anthropic/claude-fable-5.1`; the typed pick is `anthropic/claude-fable-5-1`)


## Type-safety chain

Each editorial entry's `modelId` is compile-time-validated against its vendor's literal union of known model IDs.

### How vendor model ID types are derived

Vendor model files export a const array via `llmsDefineManualMappings()` (from `src/modules/llms/server/models.mappings.ts`), then derive a literal union from it:

```ts
// in xai.models.ts
const _knownXAIChatModels = llmsDefineManualMappings([ /* ... */ ]);
export type LlmsXAIModelId = typeof _knownXAIChatModels[number]['idPrefix'];
```

The `llmsDefineModels<TElem>()` factory preserves the array's const type, so the union tracks every `idPrefix` (or `id`) literal in the array. Adding or removing a model in the vendor file automatically updates the union.

### The editorial discriminated union

`model.domains.editorial.ts` declares a discriminated union binding each vendor to its model ID type:

```ts
type _EditorialPick =
  | { vendor: 'anthropic',  modelId: LlmsAnthropicModelId }
  | { vendor: 'openai',     modelId: LlmsOpenAIModelId }
  | { vendor: 'bedrock',    modelId: `${'us.' | 'global.'}anthropic.${LlmsAnthropicModelId}${'' | '-v1:0'}` }
  | { vendor: 'openrouter', modelId: `anthropic/${LlmsAnthropicModelId}` | `google/${string}` | `openai/${LlmsOpenAIModelId}` }
  // ...
  ;
```

A compile-time assertion checks that every vendor literal in `_EditorialPick` is a valid `ModelVendorId`:

```ts
const _assertEditorialVendorsAreValid: [_EditorialPick['vendor']] extends [ModelVendorId] ? true : never = true;
```

### What the compiler catches

- **Typo in vendor literal** (e.g. `'oepnai'`) - fails the `_assertEditorialVendorsAreValid` check.
- **Wrong modelId under a vendor** (e.g. `{ vendor: 'anthropic', modelId: 'gpt-5.5' }`) - fails discriminated union narrowing.
- **Stale modelId after a vendor removes a model** - fails because `LlmsXxxModelId` updates automatically when the vendor's known-models array changes.

Dynamic vendors (`openrouter`, `bedrock`) list their models at runtime: their picks are templates over the native unions, so a native id that is removed also fails the picks that route to it. The picker matches them as a prefix or dot/dash equivalent of the listed id.

### Vendor coverage

Static vendors with rich literal unions: Anthropic, OpenAI, Gemini (`googleai`), xAI, Z.AI, Moonshot, DeepSeek, NVIDIA NIM (`nvidianim`). These provide the strongest compile-time guarantees.

All other registered vendors (Alibaba, ArceeAI, Azure, ChutesAI, FastAPI, FireworksAI, Groq, LLMAPI, Novita, TogetherAI) also export `LlmsXxxModelId` types via the same `llmsDefineManualMappings` pattern, but their known-model arrays may be empty today - the union degenerates to the base element type rather than `never`, keeping the mechanism ready for future editorial entries.

MiniMax and Perplexity use `ModelDescriptionSchema[]` arrays keyed by `id` instead of `idPrefix`, but the same const-tracking mechanism applies.


## File locations

| File | Role |
|---|---|
| `src/common/stores/llms/model.domains.editorial.ts` | Editorial table + picker function |
| `src/common/stores/llms/store-llms-domains_slice.ts` | 3-layer resolver (`llmsAuto_ModelIdForDomain_SLOW`) |
| `src/common/stores/llms/model.domains.types.ts` | `DModelDomainId` union |
| `src/common/stores/llms/model.domains.registry.ts` | Domain specs (`autoStrategy`, `requiredInterfaces`) |
| `src/modules/llms/server/models.mappings.ts` | `llmsDefineModels` / `llmsDefineManualMappings` helpers |
