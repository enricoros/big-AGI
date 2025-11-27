import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DSpeexCredentials, DSpeexVoice, DSpeexVendorType } from './speex.types';


/**
 * Descriptions for each Speex TTS Engine Vendor
 * - used for DSpeexEngine instances creation, mainly
 *
 * Configuration including credentials and default voices are in DSpeexEngine instances
 * in the speex store.
 */
export interface ISpeexVendor<TVt extends DSpeexVendorType> {
  readonly vendorType: TVt;
  readonly name: string;
  readonly protocol: 'rpc' | 'webspeech';
  readonly location: 'browser' | 'local' | 'cloud';
  readonly priority: number;  // display priority (lower = higher priority): elevenlabs=10, localai=20, openai=30, webspeech=100

  // auto-detection info
  readonly autoFromLlmVendorIds?: ModelVendorId[];

  // capabilities
  readonly capabilities: {
    streaming: boolean;
    voiceListing: boolean;  // can list voices via API (vs hardcoded)
    speedControl: boolean;
    pitchControl: boolean;
  };

  // defaults for creating new engines

  getDefaultCredentials(): DSpeexCredentials<TVt>;

  getDefaultVoice(): DSpeexVoice<TVt>;
}

export type ISpeexVendorAny = { [TVt in DSpeexVendorType]: ISpeexVendor<TVt> }[DSpeexVendorType];
