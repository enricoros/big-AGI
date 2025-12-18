/*
 * This file contains code to detect features on the client and server side,
 * and exposes hooks to list the availabilities of those features.
 *
 * Client features include:
 *  - speech recognition: availability and correctness of configuration
 *
 * Server features include:
 *  - tba
 */

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';
import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';


/// Speech Recognition (browser)

export interface CapabilityBrowserSpeechRecognition {
  mayWork: boolean; // Is the SpeechRecognition API available in the user's browser and device
  isApiAvailable: boolean; // Is the SpeechRecognition API available in the user's browser
  isDeviceNotSupported: boolean; // Is the user's device not supported (e.g., iPhone)
  warnings: string[];
}

export { browserSpeechRecognitionCapability as useCapabilityBrowserSpeechRecognition } from './speechrecognition/useSpeechRecognition';


/// Image Generation

export interface TextToImageProvider {
  providerId: string;                 // unique ID of this provider, used for selecting in a list (e.g. 'openai-2' or 'localai')
  modelServiceId?: DModelsServiceId;  // if auto-created from a model service, the service ID
  vendor: TextToImageVendor;
  priority: number; // lower is higher priority
  // UI attributes
  label: string;              // e.g. 'OpenAI #2'
  painter: string;            // e.g. 'GPT Image', 'DALL·E', 'Grok', ...
  description: string;
  configured: boolean;
}

type TextToImageVendor = Extract<ModelVendorId, 'azure' | 'openai' | 'localai' | 'googleai' | 'xai'>;

export interface CapabilityTextToImage {
  mayWork: boolean;
  mayEdit: boolean;
  providers: TextToImageProvider[],
  activeProviderId: string | null;
  setActiveProviderId: (providerId: string | null) => void;
}

export { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';


/// Browsing

export interface CapabilityBrowsing {
  mayWork: boolean;
  isServerConfig: boolean;
  isClientConfig: boolean;
  isClientValid: boolean;
  inComposer: boolean;
  inReact: boolean;
  inPersonas: boolean;
}

// export { useBrowseCapability as useCapabilityBrowse } from '~/modules/browse/store-module-browsing';