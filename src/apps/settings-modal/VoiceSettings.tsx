import * as React from 'react';

import { FormControl } from '@mui/joy';

import { useChatAutoAI } from '../chat/store-app-chat';

import { useElevenLabsVoices } from '~/modules/elevenlabs/useElevenLabsVoiceDropdown';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { LanguageSelect } from '~/common/components/LanguageSelect';


export function VoiceSettings() {

  // external state
  const { autoSpeak, setAutoSpeak } = useChatAutoAI();
  const { hasVoices } = useElevenLabsVoices();


  return <>

    {/* LanguageSelect: moved from the UI settings (where it logically belongs), just to group things better from an UX perspective */}
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Language'
                      description='ASR and TTS'
                      tooltip='Currently for Microphone input and Voice output. Microphone support varies by browser (iPhone/Safari lacks speech input). We will use the ElevenLabs MultiLanguage model if a language other than English is selected.' />
      <LanguageSelect />
    </FormControl>

    <FormRadioControl
      title='Speak Responses'
      description={autoSpeak === 'off' ? 'Off' : 'First paragraph'}
      tooltip={!hasVoices ? 'No voices available, please configure a voice synthesis service' : undefined}
      disabled={!hasVoices}
      options={[
        { value: 'off', label: 'Off' },
        { value: 'firstLine', label: 'Start' },
        { value: 'all', label: 'Full' },
      ]}
      value={autoSpeak} onChange={setAutoSpeak}
    />

  </>;
}