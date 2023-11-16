import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, Radio, RadioGroup } from '@mui/joy';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useCapabilityElevenLabs } from '~/common/components/useCapabilities';

import { isElevenLabsEnabled } from './elevenlabs.client';
import { useElevenlabsStore } from './store-elevenlabs';
import { useVoiceDropdown } from './useVoiceDropdown';


export function ElevenlabsSettings() {

  // external state
  const { isConfiguredServerSide } = useCapabilityElevenLabs();
  const { hasVoices, voicesDropdown } = useVoiceDropdown(true);
  const { apiKey, setApiKey, autoSpeak, setAutoSpeak } = useElevenlabsStore(state => ({
    apiKey: state.elevenLabsApiKey, setApiKey: state.setElevenLabsApiKey,
    autoSpeak: state.elevenLabsAutoSpeak, setAutoSpeak: state.setElevenLabsAutoSpeak,
  }), shallow);


  // derived state
  const isValidKey = isElevenLabsEnabled(apiKey);


  const handleAutoSpeakChange = (e: React.ChangeEvent<HTMLInputElement>) => setAutoSpeak((e.target.value || 'off') as 'off' | 'firstLine');


  return <>

    {/*<FormHelperText>*/}
    {/*  📢 Hear AI responses, even in your own voice*/}
    {/*</FormHelperText>*/}

    {!isConfiguredServerSide && <FormInputKey
      id='elevenlabs-key' label='ElevenLabs API Key'
      rightLabel={isConfiguredServerSide ? '✔️ already set in server' : 'required'}
      value={apiKey} onChange={setApiKey}
      required={!isConfiguredServerSide} isError={!isValidKey}
    />}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Assistant Voice' />
      {voicesDropdown}
    </FormControl>

    <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <FormLabelStart title='Speak Responses' description={autoSpeak === 'off' ? 'Off' : 'First paragraph'} />
      <RadioGroup orientation='horizontal' value={autoSpeak} onChange={handleAutoSpeakChange}>
        <Radio disabled={!hasVoices} value='off' label='Off' />
        <Radio disabled={!hasVoices} value='firstLine' label='Start' />
        <Radio disabled={true} value='all' label='Full' />
      </RadioGroup>
    </FormControl>

  </>;
}