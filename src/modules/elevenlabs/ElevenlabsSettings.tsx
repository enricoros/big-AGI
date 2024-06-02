import * as React from 'react';

import { FormControl } from '@mui/joy';

import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useCapabilityElevenLabs } from '~/common/components/useCapabilities';

import { isElevenLabsEnabled } from './elevenlabs.client';
import { useElevenLabsVoiceDropdown } from './useElevenLabsVoiceDropdown';
import { useElevenLabsApiKey } from './store-module-elevenlabs';


export function ElevenlabsSettings() {

  // external state
  const [apiKey, setApiKey] = useElevenLabsApiKey();
  const { isConfiguredServerSide } = useCapabilityElevenLabs();
  const { voicesDropdown } = useElevenLabsVoiceDropdown(true);


  // derived state
  const isValidKey = isElevenLabsEnabled(apiKey);


  return <>

    {/*<FormHelperText>*/}
    {/*  📢 Hear AI responses, even in your own voice*/}
    {/*</FormHelperText>*/}

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