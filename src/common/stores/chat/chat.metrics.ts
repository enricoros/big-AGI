/**
 * Extensible Cost Metrics System
 *
 * Tracks costs and usage across conversations with support for:
 * - Multiple charge types (tokens, search, images, traffic, etc.)
 * - Operation-level breakdown (chat, beam, auto-title, etc.)
 * - Per-model breakdown within operations
 * - Forward compatibility for distributed systems
 *
 * Design: See DESIGN_METRICS.md for full specification
 */

import type { DLLMId } from '~/common/stores/llms/llms.types';


//
// Charge Types (Type Discriminated)
//

/**
 * Token-based charges (most common)
 * Used by: most LLM providers
 */
export interface DChargeMetrics_Tokens {
  ct: 'tok';                // charge type discriminator
  $c: number;               // cost in cents
  tIn?: number;             // input tokens
  tOut?: number;            // output tokens
  tCR?: number;             // cache read tokens
  tCW?: number;             // cache write tokens
  tOutR?: number;           // reasoning tokens (e.g., o1)
}

/**
 * Search-based charges
 * Used by: Perplexity (search_results), future providers
 */
export interface DChargeMetrics_Search {
  ct: 'search';             // charge type discriminator
  $c: number;               // cost in cents
  n: number;                // number of searches performed
}

/**
 * Image generation charges
 * Used by: DALL-E, Prodia, Midjourney, etc.
 */
export interface DChargeMetrics_ImageGen {
  ct: 'img';                // charge type discriminator
  $c: number;               // cost in cents
  n: number;                // number of images generated
  res?: string;             // resolution (e.g., '1024x1024', '512x512')
}

/**
 * Traffic/bandwidth charges
 * Used by: providers charging per GB of data transfer
 */
export interface DChargeMetrics_Traffic {
  ct: 'traffic';            // charge type discriminator
  $c: number;               // cost in cents
  gb: number;               // gigabytes transferred
}

/**
 * Generic extensible charges
 * Used by: future vendor-specific charge types
 */
export interface DChargeMetrics_Generic {
  ct: string;               // charge type discriminator (vendor-specific)
  $c: number;               // cost in cents
  meta?: Record<string, number | string>;  // extensible metadata
}

/**
 * Union of all charge types
 * Extensible: new types can be added without breaking old code
 */
export type DChargeMetrics =
  | DChargeMetrics_Tokens
  | DChargeMetrics_Search
  | DChargeMetrics_ImageGen
  | DChargeMetrics_Traffic
  | DChargeMetrics_Generic;


//
// Hierarchical Metrics
//

/**
 * Per-model metrics within an operation
 * Accumulates costs and usage for a specific model
 */
export interface DModelMetrics {
  $c?: number;              // total cost for this model (cents)
  tIn?: number;             // total input tokens
  tOut?: number;            // total output tokens
  n?: number;               // usage count (number of calls)

  // Optional detailed charge breakdown (for analysis)
  // NOTE: Usually omitted to save space, only totals are tracked
  ch?: DChargeMetrics[];    // detailed charge history
}

/**
 * Per-operation metrics
 * Tracks costs for a specific operation type (chat, beam, auto-title, etc.)
 */
export interface DOperationMetrics {
  $c?: number;              // total cost for this operation (cents)
  tIn?: number;             // total input tokens
  tOut?: number;            // total output tokens
  n?: number;               // usage count (number of operations)

  // Optional model breakdown (for detailed analysis)
  m?: {
    [llmId: DLLMId]: DModelMetrics;
  };
}

/**
 * Conversation-level metrics
 * Root accumulator for all costs and usage in a conversation
 *
 * Hierarchy:
 * - Root totals (quick access without tree traversal)
 * - Operations breakdown (chat, beam, auto-title, etc.)
 *   - Models breakdown (per LLM within each operation)
 *     - Charge breakdown (detailed charge types)
 */
export interface DConversationMetrics {
  // Root totals (for quick display, sum of all operations)
  $c?: number;              // total cost in cents
  tIn?: number;             // total input tokens
  tOut?: number;            // total output tokens

  // Operation breakdown (optional, for detailed view)
  ops?: {
    [opType: string]: DOperationMetrics;  // 'chat', 'beam', 'auto-title', etc.
  };

  // Version for future migrations
  v?: number;               // default: 1 (implicit)
}


//
// Accumulation Functions
//

/**
 * Accumulate a charge into conversation metrics
 *
 * Updates:
 * - Root totals
 * - Operation totals
 * - Model totals within operation
 *
 * @param existing - Existing conversation metrics (or undefined)
 * @param opType - Operation type ('chat', 'beam', 'auto-title', etc.)
 * @param llmId - Model ID
 * @param charge - Charge to accumulate
 * @returns Updated metrics
 */
export function accumulateConversationMetrics(
  existing: DConversationMetrics | undefined,
  opType: string,
  llmId: DLLMId,
  charge: DChargeMetrics,
): DConversationMetrics {
  const metrics: DConversationMetrics = existing || {};

  // Accumulate root totals
  metrics.$c = (metrics.$c || 0) + charge.$c;
  if ('tIn' in charge && charge.tIn !== undefined)
    metrics.tIn = (metrics.tIn || 0) + charge.tIn;
  if ('tOut' in charge && charge.tOut !== undefined)
    metrics.tOut = (metrics.tOut || 0) + charge.tOut;

  // Accumulate operation level
  const ops = metrics.ops = metrics.ops || {};
  const op = ops[opType] = ops[opType] || {};
  op.$c = (op.$c || 0) + charge.$c;
  if ('tIn' in charge && charge.tIn !== undefined)
    op.tIn = (op.tIn || 0) + charge.tIn;
  if ('tOut' in charge && charge.tOut !== undefined)
    op.tOut = (op.tOut || 0) + charge.tOut;
  op.n = (op.n || 0) + 1;

  // Accumulate model level
  const models = op.m = op.m || {};
  const model = models[llmId] = models[llmId] || {};
  model.$c = (model.$c || 0) + charge.$c;
  if ('tIn' in charge && charge.tIn !== undefined)
    model.tIn = (model.tIn || 0) + charge.tIn;
  if ('tOut' in charge && charge.tOut !== undefined)
    model.tOut = (model.tOut || 0) + charge.tOut;
  model.n = (model.n || 0) + 1;

  // Optional: Store detailed charge breakdown
  // NOTE: Disabled by default to save space, only totals are tracked
  // model.ch = model.ch || [];
  // model.ch.push(charge);

  return metrics;
}

/**
 * Convert per-message metrics to a charge entry
 *
 * Bridges existing `DMetricsChatGenerate_Md` to new charge system
 *
 * @param messageMetrics - Existing message metrics
 * @returns Charge entry for accumulation
 */
export function messageMetricsToCharge(
  messageMetrics: {
    $c?: number;
    TIn?: number;
    TOut?: number;
    TCacheRead?: number;
    TCacheWrite?: number;
    TOutR?: number;
  },
): DChargeMetrics_Tokens | null {
  if (messageMetrics.$c === undefined)
    return null;

  const charge: DChargeMetrics_Tokens = {
    ct: 'tok',
    $c: messageMetrics.$c,
  };

  if (messageMetrics.TIn !== undefined)
    charge.tIn = messageMetrics.TIn;
  if (messageMetrics.TOut !== undefined)
    charge.tOut = messageMetrics.TOut;
  if (messageMetrics.TCacheRead !== undefined)
    charge.tCR = messageMetrics.TCacheRead;
  if (messageMetrics.TCacheWrite !== undefined)
    charge.tCW = messageMetrics.TCacheWrite;
  if (messageMetrics.TOutR !== undefined)
    charge.tOutR = messageMetrics.TOutR;

  return charge;
}

/**
 * Merge two conversation metrics
 *
 * Used for:
 * - Combining metrics from multiple sources
 * - Rehydration with partial data
 *
 * @param a - First metrics
 * @param b - Second metrics
 * @returns Merged metrics
 */
export function mergeConversationMetrics(
  a: DConversationMetrics | undefined,
  b: DConversationMetrics | undefined,
): DConversationMetrics | undefined {
  if (!a) return b;
  if (!b) return a;

  const merged: DConversationMetrics = {
    $c: (a.$c || 0) + (b.$c || 0),
    tIn: (a.tIn || 0) + (b.tIn || 0),
    tOut: (a.tOut || 0) + (b.tOut || 0),
  };

  // Merge operations
  if (a.ops || b.ops) {
    merged.ops = {};
    const allOpTypes = new Set([
      ...Object.keys(a.ops || {}),
      ...Object.keys(b.ops || {}),
    ]);

    for (const opType of allOpTypes) {
      const opA = a.ops?.[opType];
      const opB = b.ops?.[opType];

      if (opA && opB) {
        // Merge both
        merged.ops[opType] = {
          $c: (opA.$c || 0) + (opB.$c || 0),
          tIn: (opA.tIn || 0) + (opB.tIn || 0),
          tOut: (opA.tOut || 0) + (opB.tOut || 0),
          n: (opA.n || 0) + (opB.n || 0),
        };

        // Merge models within operation
        if (opA.m || opB.m) {
          merged.ops[opType].m = {};
          const allModelIds = new Set([
            ...Object.keys(opA.m || {}),
            ...Object.keys(opB.m || {}),
          ]);

          for (const modelId of allModelIds) {
            const modelA = opA.m?.[modelId];
            const modelB = opB.m?.[modelId];

            if (modelA && modelB) {
              merged.ops[opType].m![modelId] = {
                $c: (modelA.$c || 0) + (modelB.$c || 0),
                tIn: (modelA.tIn || 0) + (modelB.tIn || 0),
                tOut: (modelA.tOut || 0) + (modelB.tOut || 0),
                n: (modelA.n || 0) + (modelB.n || 0),
              };
            } else {
              merged.ops[opType].m![modelId] = modelA || modelB!;
            }
          }
        }
      } else {
        // Only one side has this operation
        merged.ops[opType] = opA || opB!;
      }
    }
  }

  return merged;
}
