# Azure OpenAI Fix Implementation - Issue #828

## Summary

This implementation fixes the Azure OpenAI "Resource Not Found" errors for newly added models (GPT-5, o3 Pro) by addressing two critical issues:

1. **Host Normalization**: Prevents malformed URLs when client configuration includes paths/queries
2. **API Paradigm Support**: Properly handles Azure's next-generation v1 Responses API

## Changes Made

### 1. Core Router Fix (`src/modules/llms/server/openai/openai.router.ts`)

#### Host Normalization
- **Precedence Change**: Server environment variable (`AZURE_OPENAI_API_ENDPOINT`) now takes precedence over client-provided host
- **URL Sanitization**: Strips any path/query from the host URL to prevent malformed concatenations
- **Error Handling**: Added proper URL validation with clear error messages

#### API Paradigm Support
- **Dual Mode Support**: Implemented support for both traditional (deployment-based) and next-gen v1 APIs
- **Smart Routing**: Special handling for `/v1/responses` endpoint based on configuration
- **Configurable**: Can switch between paradigms via environment variables

#### API Version Management
- Centralized API version constants with environment variable overrides:
  - `AZURE_RESPONSES_API_VERSION` (default: 'preview' for v1 API)
  - `AZURE_CHAT_API_VERSION` (default: '2025-02-01-preview')
  - `AZURE_DEPLOYMENTS_API_VERSION` (default: '2023-03-15-preview')
- Added `AZURE_API_V1` flag to explicitly enable next-gen v1 API

### 2. Environment Configuration (`src/server/env.ts`)

Added new optional environment variables:
```typescript
AZURE_API_V1: z.string().optional(), // 'true' to enable next-gen v1 API
AZURE_RESPONSES_API_VERSION: z.string().optional(), // 'preview' for v1
AZURE_CHAT_API_VERSION: z.string().optional(), 
AZURE_DEPLOYMENTS_API_VERSION: z.string().optional(),
```

## How It Works

### URL Construction Logic

The fixed Azure case now follows this logic:

1. **Get and normalize the base URL**:
   ```typescript
   const azureHostRaw = env.AZURE_OPENAI_API_ENDPOINT || access.oaiHost || '';
   const azureBase = new URL(fixupHost(azureHostRaw, apiPath)).origin;
   ```

2. **Determine API paradigm**:
   ```typescript
   const useV1API = AZURE_API_V1_ENABLED || AZURE_RESPONSES_API_VERSION === 'preview';
   ```

3. **Route based on endpoint and paradigm**:
   - **Responses API (v1)**: `/openai/v1/responses?api-version=preview`
   - **Responses API (traditional)**: `/openai/deployments/{deployment}/responses?api-version=2025-04-01-preview`
   - **Chat Completions**: `/openai/deployments/{deployment}/chat/completions?api-version=2025-02-01-preview`
   - **Model Listing**: `/openai/deployments?api-version=2023-03-15-preview`

### Configuration Options

#### Default Configuration (Recommended)
Uses next-gen v1 API for Responses (Azure's recommended approach):
```env
# No additional configuration needed - defaults to v1 for Responses
```

#### Traditional API Mode
Force traditional deployment-based API for all endpoints:
```env
AZURE_RESPONSES_API_VERSION=2025-04-01-preview
```

#### Explicit v1 Mode
Enable v1 API explicitly:
```env
AZURE_API_V1=true
```

#### Custom API Versions
Override specific API versions:
```env
AZURE_CHAT_API_VERSION=2025-02-01-preview
AZURE_DEPLOYMENTS_API_VERSION=2025-02-01-preview
```

## Testing Results

Tested with Azure OpenAI endpoint `https://grid4openai.openai.azure.com`:

| Endpoint | Status | Notes |
|----------|--------|-------|
| List Deployments | ✅ Success | Found 21 deployments |
| Chat Completions (Traditional) | ✅ Success* | *GPT-5 requires `max_completion_tokens` instead of `max_tokens` |
| Responses API (v1) | ✅ Success | Works with `/openai/v1/responses?api-version=preview` |
| Responses API (Traditional) | ❌ 404 | Azure doesn't support deployment-based Responses API |

## Migration Guide

### For Users

1. **No action required** if using server environment variables (Vercel, etc.)
2. **If using client configuration**: Ensure the Azure endpoint field contains only the base URL (e.g., `https://yourinstance.openai.azure.com`) without any paths or query parameters

### For Developers

1. The fix defaults to using the next-gen v1 API for Responses
2. Traditional chat/completions continue to use deployment-based endpoints
3. Add console logging is included to debug which API paradigm is being used
4. Environment variables provide full control over API versions and paradigms

## Known Limitations

### Azure OpenAI Specific Limitations

1. **Web Search Tool**: Azure OpenAI doesn't currently support the `web_search_preview` tool
   - The fix automatically disables web search for Azure deployments
   - Logs when web search is skipped: `[Azure] Skipping web_search_preview tool - not supported on Azure OpenAI`
   - This affects all Azure models using the Responses API (GPT-5, o-series)

2. **GPT-5 Model Constraints**:
   - No temperature control (only default value of 1.0 supported)
   - Must use `max_completion_tokens` instead of `max_tokens`
   - These constraints are already handled in the existing code

3. **Image Generation**: Multi-turn editing and streaming not yet supported on Azure

4. **File Upload**: Images can't be uploaded as files and referenced as input (coming soon)

## Benefits

1. **Fixes Issue #828**: Resolves "Resource Not Found" errors for GPT-5 and o3 Pro models
2. **Handles Azure Limitations**: Automatically disables unsupported features like web search
3. **Future-Proof**: Supports Azure's next-generation v1 API
4. **Backward Compatible**: Maintains support for existing deployments
5. **Robust**: Prevents malformed URLs from client misconfigurations
6. **Configurable**: Full control over API paradigms and versions
7. **Debuggable**: Includes logging for troubleshooting

## Technical Details

### Why Two API Paradigms?

Azure OpenAI offers two API styles:

1. **Traditional (Deployment-based)**:
   - Path: `/openai/deployments/{deployment-name}/{operation}`
   - Used for: Chat completions, embeddings, etc.
   - API Version: Dated versions like `2025-02-01-preview`

2. **Next-Generation v1**:
   - Path: `/openai/v1/{operation}`
   - Used for: Responses API (new)
   - API Version: `preview` (always latest)
   - Benefits: Simpler, more OpenAI-compatible

### The Root Cause

The original code treated all `/v1/*` endpoints identically, converting:
- `/v1/responses` → `/openai/deployments/{model}/responses`

But Azure's Responses API requires:
- `/v1/responses` → `/openai/v1/responses` (no deployment in path)

### The Solution

1. **Detect Responses API**: Check if `apiPath === '/v1/responses'`
2. **Apply correct routing**: Use v1 pattern for Responses, traditional for others
3. **Normalize hosts**: Prevent path/query pollution in base URLs
4. **Prioritize server config**: Trust server environment over client input

## Related Files

- `src/modules/llms/server/openai/openai.router.ts`: Main fix implementation
- `src/server/env.ts`: Environment variable definitions
- `test-azure-api.js`: Validation test script
- `docs/azure-openai-issue-828-corrected-analysis.md`: Detailed analysis
- `docs/azure-openai-fix-implementation.md`: This document

## References

- GitHub Issue: https://github.com/enricoros/big-AGI/issues/828
- Azure Responses API: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses
- Azure API Evolution: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/api-version-lifecycle