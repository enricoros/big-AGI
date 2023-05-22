import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, CircularProgress, FormControl, FormHelperText, FormLabel, Option, Radio, RadioGroup, Select, Stack } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';

import { apiQuery } from '~/modules/trpc/trpc.client';

import { FormInputKey } from '~/common/components/FormInputKey';
import { settingsCol1Width, settingsGap } from '~/common/theme';

import { isElevenLabsEnabled, requireUserKeyElevenLabs } from './elevenlabs.client';
import { useElevenlabsStore } from './store-elevenlabs';


export function ElevenlabsSettings() {
  // external state
  const { apiKey, setApiKey, voiceId, setVoiceId, autoSpeak, setAutoSpeak } = useElevenlabsStore(state => ({
    apiKey: state.elevenLabsApiKey, setApiKey: state.setElevenLabsApiKey,
    voiceId: state.elevenLabsVoiceId, setVoiceId: state.setElevenLabsVoiceId,
    autoSpeak: state.elevenLabsAutoSpeak, setAutoSpeak: state.setElevenLabsAutoSpeak,
  }), shallow);

  const requiresKey = requireUserKeyElevenLabs;
  const isValidKey = isElevenLabsEnabled(apiKey);

  const { data: voicesData, isLoading: loadingVoices } = apiQuery.elevenlabs.listVoices.useQuery({ elevenKey: apiKey }, {
    enabled: isValidKey,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleVoiceChange = (e: any, value: string | null) => setVoiceId(value || '');

  const handleAutoSpeakChange = (e: React.ChangeEvent<HTMLInputElement>) => setAutoSpeak((e.target.value || 'off') as 'off' | 'firstLine');

  return (
    <Stack direction='column' sx={{ gap: settingsGap }}>

      <FormHelperText>
        📢 Hear AI responses, even in your own voice
      </FormHelperText>

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
        <Select
          variant='outlined' placeholder={isValidKey ? 'Select a voice' : 'Enter valid API Key'}
          value={voiceId} onChange={handleVoiceChange}
          startDecorator={<RecordVoiceOverIcon />}
          endDecorator={isValidKey && loadingVoices && <CircularProgress size='sm' />}
          indicator={<KeyboardArrowDownIcon />}
          slotProps={{
            root: { sx: { width: '100%' } },
            indicator: { sx: { opacity: 0.5 } },
          }}
        >
          {voicesData && voicesData.voices?.map(voice => (
            <Option key={voice.id} value={voice.id}>
              {voice.name}
            </Option>
          ))}
        </Select>
      </FormControl>

      <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: settingsCol1Width }}>
          <FormLabel>Speak Responses</FormLabel>
          <FormHelperText>{autoSpeak === 'off' ? 'Off' : 'First paragraph'}</FormHelperText>
        </Box>
        <RadioGroup orientation='horizontal' value={autoSpeak} onChange={handleAutoSpeakChange}>
          <Radio disabled={!voicesData?.voices} value='off' label='Off' />
          <Radio disabled={!voicesData?.voices} value='firstLine' label='Start' />
          <Radio disabled={true} value='all' label='Full' />
        </RadioGroup>
      </FormControl>

    </Stack>
  );
}