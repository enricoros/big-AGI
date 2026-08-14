//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

/**
 * Models Service - configured to be a unique origin of models (data object, stored)
 */
export interface DModelsService<TServiceSettings extends Record<string, any> = {}> {
  id: DModelsServiceId;
  label: string;

  // service -> vendor of that service
  vId: ModelVendorId;

  // service-specific
  setup: Partial<TServiceSettings>;

  // model-defs version this service was last auto-refreshed at (see llm.client.defs.ts);
  // absent on new/imported/legacy services, which makes them auto-refresh candidates
  defsV?: string;
}

export type DModelsServiceId = string;