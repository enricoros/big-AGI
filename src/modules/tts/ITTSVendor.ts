import type { BackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { DTTSService, TTSGenerationOptions, TTSSpeakResult, TTSVendorId, TTSVoice } from './tts.types';


/**
 * TTS Vendor Interface - abstraction for all TTS providers
 * Similar to IModelVendor but adapted for TTS services
 */
export interface ITTSVendor<TServiceSettings extends Record<string, any> = {}, TAccess = unknown> {
  readonly id: TTSVendorId;
  readonly name: string;
  readonly displayRank: number;       // Display order in UI
  readonly location: 'local' | 'cloud';
  readonly brandColor?: string;

  // Server configuration detection
  readonly hasServerConfigKey?: keyof BackendCapabilities;

  // Capability flags
  readonly capabilities: {
    streaming: boolean;
    voiceCloning?: boolean;
    speedControl?: boolean;
    listVoices: boolean;
  };

  /// Abstraction interface ///

  /**
   * Initialize default settings for a new service
   */
  initializeSetup?(): TServiceSettings;

  /**
   * Validate service setup (client-side)
   */
  validateSetup?(setup: TServiceSettings): boolean;

  /**
   * Get transport access configuration from setup
   */
  getTransportAccess(setup?: Partial<TServiceSettings>): TAccess;

  /**
   * RPC: Speak text using this vendor's TTS service
   */
  rpcSpeak(
    access: TAccess,
    options: TTSGenerationOptions,
  ): Promise<AsyncIterable<any>>;

  /**
   * RPC: List available voices (if supported)
   */
  rpcListVoices?(access: TAccess): Promise<{ voices: TTSVoice[] }>;
}
