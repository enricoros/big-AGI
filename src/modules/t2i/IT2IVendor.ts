import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DModelsService } from '~/common/stores/llms/llms.service.types';

import type { DT2ICredentials, DT2IProfile, DT2IVendorType } from './t2i.types';


/**
 * Descriptions for each T2I Image Generation Vendor.
 * - used for DT2IEngine instances creation, mainly
 *
 * Configuration including credentials and profile are in DT2IEngine instances
 * in the t2i store.
 */
export interface IT2IVendor<TVt extends DT2IVendorType> {
  readonly vendorType: TVt;
  readonly name: string;
  readonly description: string; // provider description for the UI
  readonly priority: number;  // display/auto-selection priority (lower = higher): localai=20, azure=28, openai=30, openrouter=40

  // auto-detection info: if a configured LLM service matches one of these vendor ids,
  // an auto-linked T2I engine is created using that service's credentials
  readonly autoFromLlmVendorIds?: ModelVendorId[];

  // optional secondary qualifier: after vendor-id match, return false to skip
  // auto-linking for this specific service. Used e.g. by OpenAI to avoid
  // auto-linking proxies (custom oaiHost) that may not implement /v1/images/generations.
  readonly shouldAutoLinkFromLLMSource?: (source: DModelsService) => boolean;

  // capabilities (informational - for UI rendering and feature gating)
  readonly capabilities: {
    imageEditing: boolean;  // supports image-to-image / editing inputs
    multiImage: boolean;    // supports n > 1 per request
  };

  // defaults for creating new engines

  getDefaultCredentials(): DT2ICredentials<TVt>;

  getDefaultProfile(): DT2IProfile<TVt>;

  // UI: generator (painter) display name for a given profile
  generatorName(profile: DT2IProfile<TVt>): string;
}

export type IT2IVendorAny = { [TVt in DT2IVendorType]: IT2IVendor<TVt> }[DT2IVendorType];
