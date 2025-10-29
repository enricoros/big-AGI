import type { BackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { apiStream } from '~/common/util/trpc.client';

import type { ITTSVendor } from '../../ITTSVendor';
import type { TTSGenerationOptions, TTSVoice } from '../../tts.types';


// ElevenLabs Service Settings
export interface ElevenLabsServiceSettings {
  elevenKey?: string;
  elevenHost?: string;
}

// ElevenLabs Access (for RPC calls)
export interface ElevenLabsAccess {
  elevenKey?: string;
  elevenHost?: string;
}


export const TTSVendorElevenLabs: ITTSVendor<ElevenLabsServiceSettings, ElevenLabsAccess> = {
  id: 'elevenlabs',
  name: 'ElevenLabs',
  displayRank: 10,
  location: 'cloud',
  brandColor: undefined,

  hasServerConfigKey: 'hasVoiceElevenLabs',

  capabilities: {
    streaming: true,
    voiceCloning: true,
    speedControl: false,
    listVoices: true,
  },

  initializeSetup(): ElevenLabsServiceSettings {
    return {
      elevenKey: '',
      elevenHost: '',
    };
  },

  validateSetup(setup: ElevenLabsServiceSettings): boolean {
    return !setup.elevenKey || setup.elevenKey.trim().length >= 32;
  },

  getTransportAccess(setup?: Partial<ElevenLabsServiceSettings>): ElevenLabsAccess {
    return {
      elevenKey: setup?.elevenKey,
      elevenHost: setup?.elevenHost,
    };
  },

  async rpcSpeak(access: ElevenLabsAccess, options: TTSGenerationOptions): Promise<AsyncIterable<any>> {
    return apiStream.elevenlabs.speech.mutate({
      xiKey: access.elevenKey,
      voiceId: options.voiceId,
      text: options.text,
      nonEnglish: options.nonEnglish ?? false,
      audioStreaming: options.streaming ?? false,
      audioTurbo: options.turbo ?? false,
    });
  },

  async rpcListVoices(access: ElevenLabsAccess): Promise<{ voices: TTSVoice[] }> {
    const result = await (apiStream as any).elevenlabs.listVoices.query({
      elevenKey: access.elevenKey,
    });

    return {
      voices: result.voices.map((v: any) => ({
        id: v.id,
        name: v.name,
        description: v.description || undefined,
        previewUrl: v.previewUrl || undefined,
        category: v.category,
      })),
    };
  },
};
