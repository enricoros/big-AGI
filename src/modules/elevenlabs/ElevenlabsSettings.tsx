import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, FormControl, FormHelperText, FormLabel, Radio, RadioGroup, Stack, Tooltip } from '@mui/joy';

import { FormInputKey } from '~/common/components/FormInputKey';
import { LanguageSelect } from '~/common/components/LanguageSelect';
import { settingsCol1Width, settingsGap } from '~/common/theme';

import { isElevenLabsEnabled, requireUserKeyElevenLabs } from './elevenlabs.client';
import { useElevenlabsStore } from './store-elevenlabs';
import { useVoiceDropdown } from './useVoiceDropdown';


export function ElevenlabsSettings() {
  // external state
  const { apiKey, setApiKey, autoSpeak, setAutoSpeak } = useElevenlabsStore(state => ({
    apiKey: state.elevenLabsApiKey, setApiKey: state.setElevenLabsApiKey,
    autoSpeak: state.elevenLabsAutoSpeak, setAutoSpeak: state.setElevenLabsAutoSpeak,
  }), shallow);

  const requiresKey = requireUserKeyElevenLabs;
  const isValidKey = isElevenLabsEnabled(apiKey);

  const { hasVoices, voicesDropdown } = useVoiceDropdown(true);


  const handleAutoSpeakChange = (e: React.ChangeEvent<HTMLInputElement>) => setAutoSpeak((e.target.value || 'off') as 'off' | 'firstLine');

  return (
    <Stack direction='column' sx={{ gap: settingsGap }}>

      {/*<FormHelperText>*/}
      {/*  📢 Hear AI responses, even in your own voice*/}
      {/*</FormHelperText>*/}

      {/* LanguageSelect: moved from the UI settings (where it logically belongs), just to group things better from an UX perspective */}
      <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Tooltip title='Currently for Microphone input and Voice output. Microphone support varies by browser (iPhone/Safari lacks speech input). We will use the ElevenLabs MultiLanguage model if a language other than English is selected.'>
            <FormLabel>
              Language
            </FormLabel>
          </Tooltip>
          <FormHelperText>
            ASR and TTS
          </FormHelperText>
        </Box>
        <LanguageSelect />
      </FormControl>

      <FormInputKey
        label='ElevenLabs API Key'
        rightLabel={requiresKey ? 'required' : '✔️ already set in server'}
        value={apiKey} onChange={setApiKey}
        required={requiresKey} isError={!isValidKey}
      />

      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabel sx={{ minWidth: settingsCol1Width }}>
          Assistant Voice
        </FormLabel>
        {voicesDropdown}
      </FormControl>

      <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: settingsCol1Width }}>
          <FormLabel>Speak Responses</FormLabel>
          <FormHelperText>{autoSpeak === 'off' ? 'Off' : 'First paragraph'}</FormHelperText>
        </Box>
        <RadioGroup orientation='horizontal' value={autoSpeak} onChange={handleAutoSpeakChange}>
          <Radio disabled={!hasVoices} value='off' label='Off' />
          <Radio disabled={!hasVoices} value='firstLine' label='Start' />
          <Radio disabled={true} value='all' label='Full' />
        </RadioGroup>
      </FormControl>

    </Stack>
  );
}