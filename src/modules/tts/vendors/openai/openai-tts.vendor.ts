import type { BackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { apiStream } from '~/common/util/trpc.client';

import type { ITTSVendor } from '../../ITTSVendor';
import type { TTSGenerationOptions, TTSVoice } from '../../tts.types';


// OpenAI TTS Service Settings
export interface OpenAITTSServiceSettings {
  oaiKey?: string;
  oaiHost?: string;
  oaiOrgId?: string;
}

// OpenAI TTS Access (for RPC calls)
export interface OpenAITTSAccess {
  oaiKey?: string;
  oaiHost?: string;
  oaiOrgId?: string;
}

// OpenAI TTS voices (fixed list)
export const OPENAI_TTS_VOICES: TTSVoice[] = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
  { id: 'echo', name: 'Echo', description: 'Clear and articulate' },
  { id: 'fable', name: 'Fable', description: 'Expressive and warm' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
  { id: 'nova', name: 'Nova', description: 'Friendly and conversational' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft and gentle' },
];


export const TTSVendorOpenAI: ITTSVendor<OpenAITTSServiceSettings, OpenAITTSAccess> = {
  id: 'openai',
  name: 'OpenAI TTS',
  displayRank: 20,
  location: 'cloud',
  brandColor: '#10a37f',

  hasServerConfigKey: 'hasLlmOpenAI',

  capabilities: {
    streaming: true,
    voiceCloning: false,
    speedControl: true,
    listVoices: true,
  },

  initializeSetup(): OpenAITTSServiceSettings {
    return {
      oaiKey: '',
      oaiHost: '',
      oaiOrgId: '',
    };
  },

  validateSetup(setup: OpenAITTSServiceSettings): boolean {
    return !setup.oaiKey || setup.oaiKey.trim().startsWith('sk-');
  },

  getTransportAccess(setup?: Partial<OpenAITTSServiceSettings>): OpenAITTSAccess {
    return {
      oaiKey: setup?.oaiKey,
      oaiHost: setup?.oaiHost,
      oaiOrgId: setup?.oaiOrgId,
    };
  },

  async rpcSpeak(access: OpenAITTSAccess, options: TTSGenerationOptions): Promise<AsyncIterable<any>> {
    return apiStream.tts.openai.speech.mutate({
      access,
      text: options.text,
      voice: options.voiceId || 'alloy',
      model: 'tts-1',
      speed: options.speed,
      format: options.format,
      streaming: options.streaming ?? false,
    });
  },

  async rpcListVoices(access: OpenAITTSAccess): Promise<{ voices: TTSVoice[] }> {
    // OpenAI has a fixed set of voices
    return { voices: OPENAI_TTS_VOICES };
  },
};
