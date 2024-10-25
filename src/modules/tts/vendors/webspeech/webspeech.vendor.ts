import { getBrowseVoiceId } from './store-module-webspeech';
import { CapabilitySpeechSynthesis, ISpeechSynthesis } from '../ISpeechSynthesis';
import { WebspeechSettings } from './WebspeechSettings';

export const webspeech: ISpeechSynthesis = {
  id: 'webspeech',
  name: 'Web Speech API',
  location: 'cloud',

  // components
  TTSSettingsComponent: WebspeechSettings,

  // functions

  getCapabilityInfo(): CapabilitySpeechSynthesis {
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const isConfiguredServerSide = false;
    const isConfiguredClientSide = true;
    const mayWork = voices.length > 0;
    return { mayWork, isConfiguredServerSide, isConfiguredClientSide };
  },

  hasVoices() {
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    return voices.length > 0;
  },

  async speakText(text: string, voiceId?: string) {
    if (!text?.trim()) return;

    try {
      const synth = window.speechSynthesis;
      const utterThis = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      voiceId = voiceId || getBrowseVoiceId();
      utterThis.voice = voices.find((voice) => voiceId === voice.name) || null;
      synth.speak(utterThis);
    } catch (error) {
      console.error('Error playing first text:', error);
    }
  },

  async cancel() {
    const synth = window.speechSynthesis;
    synth.cancel();
  },

  async EXPERIMENTAL_speakTextStream(text: string, voiceId?: string) {
    if (!text?.trim()) return;

    try {
      const synth = window.speechSynthesis;
      const utterThis = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      voiceId = voiceId || getBrowseVoiceId();
      utterThis.voice = voices.find((voice) => voiceId === voice.name) || null;
      synth.speak(utterThis);
    } catch (error) {
      // has happened once in months of testing, not sure what was the cause
      console.error('EXPERIMENTAL_speakTextStream:', error);
    }
  },
};
