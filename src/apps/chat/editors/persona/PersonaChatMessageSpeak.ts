import { speakText } from '~/modules/elevenlabs/elevenlabs.client';


export type AutoSpeakType = 'off' | 'firstLine' | 'all';


export class PersonaChatMessageSpeak {
  private spokenLine: boolean = false;

  constructor(private autoSpeakType: AutoSpeakType) {
  }


  handleTextSoFar(textSoFar: string): void {
    if (this.spokenLine || this.autoSpeakType === 'off') return;

    // 📢 TTS: first-line
    if (this.autoSpeakType === 'firstLine') {
      const cutPoint = this.findLastCutPoint(textSoFar);
      if (cutPoint > 100 && cutPoint < 400) {
        this.spokenLine = true;
        const firstParagraph = textSoFar.substring(0, cutPoint);
        this.speak(firstParagraph);
      }
    }
  }

  finalizeText(fullText: string): void {
    if (!this.spokenLine && this.autoSpeakType !== 'off' && fullText.length > 0) {
      this.speak(fullText);
    }
  }

  private findLastCutPoint(text: string): number {
    let cutPoint = text.lastIndexOf('\n');
    if (cutPoint < 0)
      cutPoint = text.lastIndexOf('. ');
    return cutPoint;
  }

  private speak(text: string) {
    console.log('📢 TTS:', text);
    // fire/forget: we don't want to stall this loop
    void speakText(text);
  }
}
