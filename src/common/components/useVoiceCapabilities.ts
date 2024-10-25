import { getTTSEngine } from 'src/apps/chat/store-app-chat';
import { CapabilitySpeechSynthesis } from '~/common/components/useCapabilities';

import { useCapability as useElevenlabsCapability } from '~/modules/elevenlabs/elevenlabs.client';
import { speakText as elevenlabsSpeakText } from '~/modules/elevenlabs/elevenlabs.client';
import { EXPERIMENTAL_speakTextStream as EXPERIMENTAL_elevenlabsSpeakTextStream } from '~/modules/elevenlabs/elevenlabs.client';

import { useCapability as useBrowserSpeechSynthesisCapability } from '~/modules/browser/speech-synthesis/browser.speechSynthesis.client';
import { speakText as browserSpeechSynthesisSpeakText } from '~/modules/browser/speech-synthesis/browser.speechSynthesis.client';
import { EXPERIMENTAL_speakTextStream as EXPERIMENTAL_browserSpeechSynthesisSpeakTextStream } from '~/modules/browser/speech-synthesis/browser.speechSynthesis.client';

import { useElevenLabsVoices } from '~/modules/elevenlabs/useElevenLabsVoiceDropdown';
import { useBrowserSpeechVoices } from '~/modules/browser/speech-synthesis/useBrowserSpeechVoiceDropdown';

export type TTSEngineKey = 'elevenlabs' | 'webspeech';
export type ASREngineKey = 'webspeech';

export const TTSEngineList: { key: TTSEngineKey; label: string }[] = [
  {
    key: 'elevenlabs',
    label: 'ElevenLabs',
  },
  {
    key: 'webspeech',
    label: 'Web Speech API',
  },
];

export const ASREngineList: { key: ASREngineKey; label: string }[] = [
  {
    key: 'webspeech',
    label: 'Web Speech API',
  },
];

export function getConditionalVoices() {
  const TTSEngine = getTTSEngine();
  if (TTSEngine === 'elevenlabs') {
    return useElevenLabsVoices;
  }
  if (TTSEngine === 'webspeech') {
    return useBrowserSpeechVoices;
  }
}

export function hasVoices(): boolean {
  console.log('getConditionalVoices', getConditionalVoices()().hasVoices);
  return getConditionalVoices()().hasVoices;
}

export function getConditionalCapability(): () => CapabilitySpeechSynthesis {
  const TTSEngine = getTTSEngine();
  if (TTSEngine === 'elevenlabs') {
    return useElevenlabsCapability;
  }
  if (TTSEngine === 'webspeech') {
    return useBrowserSpeechSynthesisCapability;
  }
  throw new Error('TTSEngine is not found');
}

export function useCapability(): CapabilitySpeechSynthesis {
  return getConditionalCapability()();
}

export async function speakText(text: string, voiceId?: string) {
  const TTSEngine = getTTSEngine();
  if (TTSEngine === 'elevenlabs') {
    return await elevenlabsSpeakText(text, voiceId);
  } 
  if (TTSEngine === 'webspeech') {
    return await browserSpeechSynthesisSpeakText(text, voiceId);
  }
}

// let liveAudioPlayer: LiveAudioPlayer | undefined = undefined;

export async function EXPERIMENTAL_speakTextStream(text: string, voiceId?: string) {
  const TTSEngine = getTTSEngine();
  if (TTSEngine === 'elevenlabs') {
    return await EXPERIMENTAL_elevenlabsSpeakTextStream(text, voiceId);
  }
  if (TTSEngine === 'webspeech') {
    return await EXPERIMENTAL_browserSpeechSynthesisSpeakTextStream(text, voiceId);
  }
  throw new Error('TTSEngine is not found');
}
