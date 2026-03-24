# LLM Vendor Integration Guide

How to add support for new LLM providers in Big-AGI. There are two integration paths, and
the dynamic backend path is strongly preferred for new vendors.

## Integration Paths

### Path 1: Dynamic Backend (preferred)

For any provider with an **OpenAI-compatible API** (which is nearly all new providers).

**Surface area**: 1-2 files, no UI changes, no registry changes.

A dynamic backend provides:
- Hostname-based auto-detection when the user adds the provider's API URL
- Automatic model list parsing with vendor-specific metadata (pricing, context windows, capabilities)
- Zero UI code - uses the existing "Custom OpenAI-compatible" service setup

**Files touched**:
- `src/modules/llms/server/openai/models/{vendor}.models.ts` (required) - model definitions + hostname heuristic
- `src/modules/llms/server/openai/wiretypes/{vendor}.wiretypes.ts` (optional) - Zod schemas for vendor-specific wire format
- `src/modules/llms/server/listModels.dispatch.ts` - add heuristic to the detection chain (2 lines)

**What the model file must export**:
```typescript
// 1. Hostname heuristic - returns true when the user's API URL matches this vendor
export function vendorHeuristic(hostname: string): boolean {
  return hostname.includes('.vendor-domain.com');
}

// 2. Model converter - transforms vendor's /v1/models response to ModelDescriptionSchema[]
export function vendorModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  // Parse wire format, map to ModelDescriptionSchema with:
  // - id, label, description
  // - contextWindow, maxCompletionTokens
  // - interfaces (Chat, Vision, Fn, Reasoning, etc.)
  // - chatPrice (input/output per token)
  // - parameterSpecs (temperature, etc.)
}
```

**Existing examples**: `novita.models.ts`, `chutesai.models.ts`, `fireworksai.models.ts`

MUST also provide the updated vendor icon like other icons in `src/common/components/icons/vendors/`.
Make sure all the information is available if in the future we want to promote those to full registered vendors.

### Path 2: Registered Vendor (heavyweight, discouraged for new providers)

Full first-class integration with dedicated UI, own dialect, and registry entry. Reserved for
providers with **non-OpenAI protocols** (Anthropic, Gemini, Ollama) or providers with enough
user demand to warrant a dedicated setup flow.

**Surface area**: 5+ files across 3 directories.

**Files touched**:
- `src/modules/llms/vendors/{vendor}/{vendor}.vendor.ts` - IModelVendor implementation
- `src/modules/llms/vendors/{vendor}/{VendorName}ServiceSetup.tsx` - React UI setup component
- `src/modules/llms/vendors/vendors.registry.ts` - registry entry + ModelVendorId union
- `src/modules/llms/server/openai/models/{vendor}.models.ts` - model definitions
- `src/modules/llms/server/listModels.dispatch.ts` - dispatch case
- Possibly server protocol adapter if not OpenAI-compatible
- Possibly more files, e.g. wires, etc.
- See existing providers and commits that added them for full scope

**When to use this path**: Only when the provider has a meaningfully different API protocol
(not OpenAI-compatible), or when there is significant user demand AND the provider offers
unique capabilities that benefit from dedicated UI (e.g., Ollama's local model management).

When using this path, please add links to upstream documentation. Make sure all constants
are correctly handled everywhere, especially for provider-based switches.

## Decision Criteria

| Question | Dynamic | Registered |
|----------|---------|------------|
| OpenAI-compatible API? | Yes - use dynamic | Only if not OAI-compatible |
| Needs custom auth UI? | No - uses generic fields | Yes - custom setup form |
| Unique protocol? | No | Yes (Anthropic, Gemini, Ollama) |
| User demand level | Any | High + sustained |
| Maintenance burden | Minimal | Significant (5+ files) |

## For External Contributors / Vendor Requests

When vendors or community members request integration via GitHub issues:

1. **Point them to the dynamic backend path** - it's faster to implement, review, and maintain
2. **Requirements for a dynamic backend PR**:
   - Model file with heuristic + converter exporting `ModelDescriptionSchema[]`
   - Wire types if the vendor's `/v1/models` response has non-standard fields
   - Vendor icon (SVG preferred) in `src/common/components/icons/vendors/`
   - Two-line addition to the heuristic chain in `listModels.dispatch.ts`
3. **Do not accept**: New registered vendors for OpenAI-compatible providers. The maintenance
   cost of a full vendor (UI component, registry entry, dispatch case) is not justified when
   dynamic detection achieves the same result with a fraction of the code.

## Architecture Notes

### How Dynamic Detection Works

In `listModels.dispatch.ts`, the `case 'openai':` handler:
1. Fetches `/v1/models` from the user-provided API host
2. Runs the hostname through a chain of heuristics (in order)
3. First matching heuristic's converter is used to parse models
4. Falls back to stock OpenAI parsing if no heuristic matches

### Hostname Security

Hostname matching uses `llmsHostnameMatches()` from `openai.access.ts` which parses the
URL properly to prevent DNS spoofing. Always use `.includes()` on the parsed hostname,
never on the raw URL string.

### Key Types

- `ModelDescriptionSchema` (`llm.server.types.ts`) - output type for all model converters
- `DModelInterfaceV1` (`llms.types.ts`) - capability flags (Chat, Vision, Fn, Reasoning, etc.)
- `IModelVendor` (`vendors/IModelVendor.ts`) - interface for registered vendors only
- `ManualMappings` / `KnownModel` (`models.mappings.ts`) - server-side model patches

### File Locations

- Dynamic backends: `src/modules/llms/server/openai/models/`
- Wire types: `src/modules/llms/server/openai/wiretypes/`
- Dispatch: `src/modules/llms/server/listModels.dispatch.ts`
- Registered vendors: `src/modules/llms/vendors/*/`
- Vendor icons: `src/common/components/icons/vendors/`
- Type definitions: `src/modules/llms/server/llm.server.types.ts`
