# Azure OpenAI "Resource Not Found" Issue #828 - Corrected Analysis

## Executive Summary

GitHub issue #828 reports that newly added Azure OpenAI model endpoints (GPT-5, o3 Pro) are failing with "Resource Not Found" errors. The root cause is that the big-AGI codebase incorrectly constructs Azure OpenAI Responses API URLs by treating them like deployment-based endpoints when they should use a different path structure.

## Key Facts

1. **Azure DOES support the Responses API** - Documented at:
   - https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses
   - https://learn.microsoft.com/en-us/azure/ai-foundry/openai/api-version-lifecycle#api-evolution
   - https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference-preview-latest#create-response

2. **User configuration is correct** - The base endpoint `https://grid4openai.openai.azure.com/` is properly configured in Vercel

3. **Models work in Azure AI Foundry** - The deployments function correctly in Azure's playground and other compatible applications

## Root Cause Analysis

### The URL Construction Bug

In `src/modules/llms/server/openai/openai.router.ts` (lines 539-542), the code incorrectly handles the Azure Responses API endpoint:

```typescript
if (apiPath.startsWith('/v1/')) {
  if (!modelRefId)
    throw new Error('Azure OpenAI API needs a deployment id');
  url += `/openai/deployments/${modelRefId}/${apiPath.replace('/v1/', '')}?api-version=2025-02-01-preview`;
}
```

This code treats ALL `/v1/` paths identically, resulting in:

**For `/v1/responses`:**
- **Current (WRONG)**: `https://grid4openai.openai.azure.com/openai/deployments/{model-id}/responses?api-version=2025-02-01-preview`
- **Expected (CORRECT)**: `https://grid4openai.openai.azure.com/openai/v1/responses?api-version=preview`

### Why This Happens

1. When GPT-5 and o-series models use the Responses API (due to having `LLM_IF_OAI_Responses` interface), the system calls `openAIAccess(access, model.id, '/v1/responses')`

2. The Azure case in `openAIAccess` doesn't distinguish between different `/v1/` endpoints

3. The Responses API in Azure doesn't use the `/deployments/{deployment-id}/` path structure - it's a direct endpoint at `/openai/v1/responses`

### Historical Context

Interestingly, commit `1d0a76cd` by Paul Short on Aug 8, 2025 actually attempted to fix this with special handling for GPT-5:

```typescript
if (apiPath === '/v1/responses' && modelRefId?.toLowerCase().includes('gpt-5')) {
  url += `/openai/v1/responses?api-version=preview`;
}
```

However, this fix either:
- Was never merged to the main branch
- Was reverted
- Exists in a different branch

The current v2-dev branch doesn't include this fix.

## The Solution

### Primary Fix: Correct URL Construction for Responses API

**File**: `src/modules/llms/server/openai/openai.router.ts` (around line 538)

**Current Code:**
```typescript
let url = azureHost;
if (apiPath.startsWith('/v1/')) {
  if (!modelRefId)
    throw new Error('Azure OpenAI API needs a deployment id');
  url += `/openai/deployments/${modelRefId}/${apiPath.replace('/v1/', '')}?api-version=2025-02-01-preview`;
} else if (apiPath.startsWith('/openai/deployments'))
  url += apiPath;
else
  throw new Error('Azure OpenAI API path not supported: ' + apiPath);
```

**Fixed Code:**
```typescript
let url = azureHost;
// Special handling for Azure Responses API which doesn't use deployment paths
if (apiPath === '/v1/responses') {
  url += `/openai/v1/responses?api-version=preview`;
} else if (apiPath.startsWith('/v1/')) {
  if (!modelRefId)
    throw new Error('Azure OpenAI API needs a deployment id');
  url += `/openai/deployments/${modelRefId}/${apiPath.replace('/v1/', '')}?api-version=2025-02-01-preview`;
} else if (apiPath.startsWith('/openai/deployments'))
  url += apiPath;
else
  throw new Error('Azure OpenAI API path not supported: ' + apiPath);
```

### Alternative Solution: More Robust Pattern

For better maintainability, consider defining Azure API patterns explicitly:

```typescript
let url = azureHost;

// Define Azure-specific endpoint patterns
const azureDirectEndpoints = {
  '/v1/responses': '/openai/v1/responses?api-version=preview',
  // Add other direct endpoints here as needed
};

// Check for direct endpoints first
if (azureDirectEndpoints[apiPath]) {
  url += azureDirectEndpoints[apiPath];
} else if (apiPath.startsWith('/v1/')) {
  // Deployment-based endpoints
  if (!modelRefId)
    throw new Error('Azure OpenAI API needs a deployment id');
  url += `/openai/deployments/${modelRefId}/${apiPath.replace('/v1/', '')}?api-version=2025-02-01-preview`;
} else if (apiPath.startsWith('/openai/deployments')) {
  url += apiPath;
} else {
  throw new Error('Azure OpenAI API path not supported: ' + apiPath);
}
```

## Secondary Issues to Address

### 1. API Version Consistency

The code uses different API versions in different places:
- Model listing: `2023-03-15-preview` (line 166)
- Chat completions: `2025-02-01-preview`
- Responses API: Should use `preview` or `2025-04-01-preview`

Consider updating the model listing to use a more recent API version:
```typescript
// Line 166
const azureOpenAIDeploymentsResponse = await openaiGETOrThrow(access, `/openai/deployments?api-version=2025-02-01-preview`);
```

### 2. Request Body Compatibility

Ensure that the request body generated by `aixToOpenAIResponses` is compatible with Azure's Responses API implementation, which may have slight differences from OpenAI's native implementation.

## Testing Requirements

1. **Test with GPT-5 models** on Azure to verify Responses API works
2. **Test with o3 Pro models** on Azure 
3. **Verify existing models** (o4 Mini, GPT-4.1) continue working
4. **Test both streaming and non-streaming** responses
5. **Verify model listing** still works with updated API version

## Implementation Steps

1. **Immediate Fix**:
   - Apply the primary fix to correctly construct Responses API URLs
   - Test with affected models

2. **Follow-up**:
   - Update API versions for consistency
   - Add logging to track which API endpoints are being used
   - Consider adding configuration to toggle between APIs if needed

3. **Long-term**:
   - Monitor Azure OpenAI documentation for API changes
   - Consider abstracting Azure-specific logic into a separate module
   - Add integration tests for Azure endpoints

## Conclusion

The issue is a straightforward URL construction bug where the Azure Responses API endpoint is being incorrectly formatted as a deployment-based endpoint. The fix is simple: add special handling for the `/v1/responses` path to use the direct endpoint format instead of the deployment-based format. This aligns with Azure's documented API structure and will resolve the "Resource Not Found" errors users are experiencing with GPT-5 and o-series models.