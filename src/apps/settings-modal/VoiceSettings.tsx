import * as React from 'react';

import { FormControl, Radio, RadioGroup } from '@mui/joy';

import { ChatAutoSpeakType, useChatAutoAI } from '../chat/store-app-chat';

import { useElevenLabsVoices } from '~/modules/elevenlabs/useElevenLabsVoiceDropdown';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { LanguageSelect } from '~/common/components/LanguageSelect';


export function VoiceSettings() {

  // external state
  const { autoSpeak, setAutoSpeak } = useChatAutoAI();
  const { hasVoices } = useElevenLabsVoices();


  const handleAutoSpeakChange = (e: React.ChangeEvent<HTMLInputElement>) => setAutoSpeak((e.target.value || 'off') as ChatAutoSpeakType);

  return <>

    {/* LanguageSelect: moved from the UI settings (where it logically belongs), just to group things better from an UX perspective */}
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Language'
                      description='ASR and TTS'
                      tooltip='Currently for Microphone input and Voice output. Microphone support varies by browser (iPhone/Safari lacks speech input). We will use the ElevenLabs MultiLanguage model if a language other than English is selected.' />
      <LanguageSelect />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <FormLabelStart title='Speak Responses'
                      description={autoSpeak === 'off' ? 'Off' : 'First paragraph'}
                      tooltip={!hasVoices ? 'No voices available, please configure a voice synthesis service' : undefined} />
      <RadioGroup orientation='horizontal' value={autoSpeak} onChange={handleAutoSpeakChange}>
        <Radio disabled={!hasVoices} value='off' label='Off' />
        <Radio disabled={!hasVoices} value='firstLine' label='Start' />
        <Radio disabled={!hasVoices} value='all' label='Full' />
      </RadioGroup>
    </FormControl>

  </>;
}