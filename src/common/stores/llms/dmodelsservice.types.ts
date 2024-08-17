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
}

export type DModelsServiceId = string;