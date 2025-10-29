import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';
import { getElevenLabsData } from '~/modules/elevenlabs/store-module-elevenlabs';
import { useModelsStore } from '~/common/stores/llms/store-llms';

import { findTTSVendor } from './vendors.registry';
import { useTTSStore } from './store-tts';
import type { TTSVendorId } from './tts.types';


/**
 * Migrates existing TTS configurations to the new TTS store
 * This should be called once on app initialization
 */
export function migrateTTSServices() {
  const { services, activeServiceId } = useTTSStore.getState();

  // Skip if already migrated (has existing services)
  if (services.length > 0) {
    return;
  }

  // 1. Migrate from existing ElevenLabs configuration
  const { elevenLabsApiKey, elevenLabsVoiceId } = getElevenLabsData();
  const { hasVoiceElevenLabs } = getBackendCapabilities();

  if (elevenLabsApiKey || hasVoiceElevenLabs) {
    const elevenLabsVendor = findTTSVendor('elevenlabs');
    if (elevenLabsVendor) {
      const service = useTTSStore.getState().createService(elevenLabsVendor);

      // Set up with existing credentials
      if (elevenLabsApiKey) {
        useTTSStore.getState().updateServiceSettings(service.id, {
          elevenKey: elevenLabsApiKey,
        });
      }

      // Set as active service
      useTTSStore.getState().setActiveServiceId(service.id);

      // Set default voice if available
      if (elevenLabsVoiceId) {
        useTTSStore.getState().setActiveVoiceId(elevenLabsVoiceId);
      }

      console.log('TTS: Migrated ElevenLabs configuration to new TTS store');
    }
  }

  // 2. Auto-import from OpenAI LLM configuration
  autoImportTTSFromLLMs();
}


/**
 * Auto-imports TTS services from configured LLM services
 * Creates TTS services when compatible LLM credentials are found
 */
export function autoImportTTSFromLLMs() {
  const { sources } = useModelsStore.getState();
  const { services } = useTTSStore.getState();

  // Check for OpenAI LLM service
  const openaiLLMService = sources.find(s => s.vId === 'openai');
  if (openaiLLMService && openaiLLMService.setup?.oaiKey) {
    // Check if we already have an OpenAI TTS service with this key
    const existingOpenAITTS = services.find(
      s => s.vId === 'openai' && s.setup.oaiKey === openaiLLMService.setup.oaiKey,
    );

    if (!existingOpenAITTS) {
      const openaiTTSVendor = findTTSVendor('openai');
      if (openaiTTSVendor) {
        const service = useTTSStore.getState().createService(openaiTTSVendor);

        // Copy credentials from LLM service
        useTTSStore.getState().updateServiceSettings(service.id, {
          oaiKey: openaiLLMService.setup.oaiKey,
          oaiHost: openaiLLMService.setup.oaiHost,
          oaiOrgId: openaiLLMService.setup.oaiOrgId,
        });

        console.log('TTS: Auto-imported OpenAI TTS service from LLM configuration');
      }
    }
  }
}
