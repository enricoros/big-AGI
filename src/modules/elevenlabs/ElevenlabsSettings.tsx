import * as React from 'react';

import { FormControl } from '@mui/joy';

import { useChatAutoAI } from '../../apps/chat/store-app-chat';

import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { useCapabilityElevenLabs } from '~/common/components/useCapabilities';

import { isElevenLabsEnabled } from './elevenlabs.client';
import { useElevenLabsVoiceDropdown, useElevenLabsVoices } from './useElevenLabsVoiceDropdown';
import { useElevenLabsApiKey } from './store-module-elevenlabs';


export function ElevenlabsSettings() {

  // state
  const [apiKey, setApiKey] = useElevenLabsApiKey();

  // external state
  const { autoSpeak, setAutoSpeak } = useChatAutoAI();
  const { hasVoices } = useElevenLabsVoices();
  const { isConfiguredServerSide } = useCapabilityElevenLabs();
  const { voicesDropdown } = useElevenLabsVoiceDropdown(true);


  // derived state
  const isValidKey = isElevenLabsEnabled(apiKey);


  return <>

    {/*<FormHelperText>*/}
    {/*  📢 Hear AI responses, even in your own voice*/}
    {/*</FormHelperText>*/}

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


    {!isConfiguredServerSide && <FormInputKey
      autoCompleteId='elevenlabs-key' label='ElevenLabs API Key'
      rightLabel={<AlreadySet required={!isConfiguredServerSide} />}
      value={apiKey} onChange={setApiKey}
      required={!isConfiguredServerSide} isError={!isValidKey}
    />}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Assistant Voice' />
      {voicesDropdown}
    </FormControl>

  </>;
}