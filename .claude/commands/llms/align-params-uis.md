---
description: Sync LLM parameter options between full model dialog and chat side panel
---

Audit and sync LLM parameter configurations between the two UI editors. Goal: identical `value` fields in option arrays + equivalent onChange logic. Labels/descriptions can differ for UI space.

**Files to Compare:**
1. **Full Model Dialog**: `src/modules/llms/models-modal/LLMParametersEditor.tsx` (main branch)
2. **Chat Side Panel**: `src/apps/chat/components/layout-panel/ChatPanelModelParameters.tsx` (main derived branches only)

**Reference Documentation:**
- Parameter system: `kb/systems/LLM-parameters-system.md`
- Parameter registry: `src/common/stores/llms/llms.parameters.ts`

**Task: Perform a comprehensive audit**

1. **Read both files** and extract all option arrays (e.g., `_reasoningEffortOptions`, `_antEffortOptions`, `_geminiThinkingLevelOptions`, etc.)

2. **Check for missing parameters:**
   - Parameters handled in `LLMParametersEditor.tsx` but NOT in `ChatPanelModelParameters.tsx`
   - Parameters in `ChatPanelModelParameters.tsx`'s `_interestingParameters` array but missing UI controls
   - Note: The side panel intentionally shows only "interesting" parameters - focus on those listed in `_interestingParameters`

3. **Check for value mismatches** between corresponding option arrays:
   - Different number of options (e.g., 3 vs 4 options)
   - Same label but different `value` (this causes the bug in issue #926)
   - Different labels for the same `value`
   - Missing `_UNSPECIFIED`/Default option in one but not the other

4. **Check onChange handler consistency:**
   - Both should remove parameter on `_UNSPECIFIED` selection
   - Both should set explicit values the same way
   - Watch for conditions like `value === 'high'` that may differ

**Output Format:**

```
## Parameter Sync Audit Report

### Missing Parameters
- [ ] `llmVndXyz` - In full dialog, missing from side panel

### Value Mismatches
- [ ] `_xyzOptions`:
  - Full dialog: [values...]
  - Side panel: [values...]
  - Issue: [description]

### Handler Inconsistencies
- [ ] `llmVndXyz` onChange differs: [explanation]

### Recommended Fixes
1. [Specific fix with code snippet if needed]
```

**Fix Direction:** Full dialog is source of truth. Update side panel to match its values when mismatched.

**Notes:**
- Side panel uses shorter descriptions (space-constrained) - that's fine
- Variable names may differ (e.g., `_anthropicEffortOptions` vs `_antEffortOptions`) - that's fine, but same is better
- `value` fields must be identical sets
- `_UNSPECIFIED` must mean the same thing in both
- onChange: remove on `_UNSPECIFIED`, set explicit value otherwise
