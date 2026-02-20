//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

/**
 * Models Service - configured to be a unique origin of models (data object, stored)
 */
export interface DModelsService<TServiceSettings extends object = {}> {
  id: DModelsServiceId;
  label: string;

  // service -> vendor of that service
  vId: ModelVendorId;

  // service-specific
  setup: Partial<TServiceSettings>;

  // Common rate limiting — applies as defaults to all models in this service.
  // Per-model parameters (llmRateLimitRPM/TPM) take priority when set.
  rateLimitRPM?: number | null; // max requests per minute
  rateLimitTPM?: number | null; // max input tokens per minute
}

export type DModelsServiceId = string;