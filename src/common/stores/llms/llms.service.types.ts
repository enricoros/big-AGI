//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

/**
 * Models Service - configured to be a unique origin of models (data object, stored)
 */
export interface DModelsService<TServiceSettings extends Record<string, any> = {}> {
  readonly id: DModelsServiceId;
  label: string;

  // service -> vendor of that service
  readonly vId: ModelVendorId;

  // service-specific
  setup: Partial<TServiceSettings>;

  // model-defs version this service was last auto-refreshed at (see llm.client.defs.ts);
  // absent on new/imported/legacy services, which makes them auto-refresh candidates
  defsV?: string;

  // what the vendor told the last listing about the key and its account, stored with the service as its models are;
  // absent when it told nothing, and replaced by every listing
  accessStatus?: DModelsServiceAccessStatus;
}

/** Facts, worded where shown. Values are append-only: a reader ignores one it does not know (a newer build wrote it). */
export type DModelsServiceAccessStatus = {
  freeModelsOnly?: 'free-tier' | 'key-limit-zero'; // the key can call the free models only, and why
  freeRequestsPerDay?: number; // what the free models allow this key
};

export type DModelsServiceId = string;