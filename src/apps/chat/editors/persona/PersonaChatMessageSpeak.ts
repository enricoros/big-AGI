import { speakText } from '~/modules/elevenlabs/elevenlabs.client';

import { isContentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';

import type { AixChatGenerateContent_DMessage } from '~/modules/aix/client/aix.client';

import type { PersonaProcessorInterface } from '../chat-persona';


export type AutoSpeakType = 'off' | 'firstLine' | 'all';


export class PersonaChatMessageSpeak implements PersonaProcessorInterface {
  private spokenLine: boolean = false;

  constructor(private autoSpeakType: AutoSpeakType) {
  }

  handleMessage(accumulatedMessage: Partial<AixChatGenerateContent_DMessage>, messageComplete: boolean) {
    if (this.autoSpeakType === 'off' || this.spokenLine) return;

    // Require a Content.Text first fragment
    if (!accumulatedMessage.fragments?.length || !isContentFragment(accumulatedMessage.fragments[0]) || !isTextPart(accumulatedMessage.fragments[0].part))
      return;
    const text = accumulatedMessage.fragments[0].part.text;

    if (!messageComplete)
      this.#handleTextSoFar(text);
    else
      this.#finalizeText(text);
  }


  #handleTextSoFar(textSoFar: string): void {
    // 📢 TTS: first-line
    if (this.autoSpeakType === 'firstLine') {
      const cutPoint = this.#findLastCutPoint(textSoFar);
      if (cutPoint > 100 && cutPoint < 400) {
        const firstParagraph = textSoFar.substring(0, cutPoint);
        this.#speak(firstParagraph);
      }
    }
  }

  #finalizeText(fullText: string): void {
    if (fullText.length > 0) {
      this.#speak(fullText);
    }
  }

  #findLastCutPoint(text: string): number {
    let cutPoint = text.lastIndexOf('\n');
    if (cutPoint < 0)
      cutPoint = text.lastIndexOf('. ');
    return cutPoint;
  }

  #speak(text: string) {
    console.log('📢 TTS:', text);
    this.spokenLine = true;
    // fire/forget: we don't want to stall this loop
    void speakText(text);
  }
}
