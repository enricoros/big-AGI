import { CapabilitySpeechSynthesis } from "~/common/components/useCapabilities";
import { getBrowseVoiceId } from "./store-module-browser";

export function useCapability(): CapabilitySpeechSynthesis {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  const isConfiguredServerSide = false;
  const isConfiguredClientSide = true;
  const mayWork = voices.length > 0;
  return { mayWork, isConfiguredServerSide, isConfiguredClientSide };
}


export async function speakText(text: string, voiceId?: string) {
  if (!(text?.trim())) return;
  
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
}

export async function cancel() {
  const synth = window.speechSynthesis;
  synth.cancel();
}

export async function EXPERIMENTAL_speakTextStream(text: string, voiceId?: string) {
  if (!(text?.trim())) return;

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
}