import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { CircularProgress, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';

import { apiQuery } from '~/modules/trpc/trpc.client';

import { playSoundUrl } from '~/common/util/audioUtils';

import { VoiceSchema } from './elevenlabs.router';
import { isElevenLabsEnabled } from './elevenlabs.client';
import { useElevenlabsStore } from './store-elevenlabs';


function VoicesDropdown(props: {
  isValidKey: boolean,
  isLoadingVoices: boolean,
  isErrorVoices: boolean,
  voices: VoiceSchema[],
  voiceId: string | null,
  setVoiceId: (voiceId: string) => void,
}) {

  const handleVoiceChange = (_event: any, value: string | null) => props.setVoiceId(value || '');

  return (
    <Select
      value={props.voiceId} onChange={handleVoiceChange}
      variant='outlined'
      // color={props.isErrorVoices ? 'danger' : undefined}
      placeholder={props.isErrorVoices ? 'Issue loading voices' : props.isValidKey ? 'Select a voice' : 'Enter valid API Key'}
      startDecorator={<RecordVoiceOverIcon />}
      endDecorator={props.isValidKey && props.isLoadingVoices && <CircularProgress size='sm' />}
      indicator={<KeyboardArrowDownIcon />}
      slotProps={{
        root: { sx: { width: '100%' } },
        indicator: { sx: { opacity: 0.5 } },
      }}
    >
      {props.voices.map(voice => (
        <Option key={voice.id} value={voice.id}>
          {voice.name}
        </Option>
      ))}
    </Select>
  );
}


export function useVoiceDropdown(autoSpeak: boolean) {

  // external state
  const { apiKey, voiceId } = useElevenlabsStore(state => ({
    apiKey: state.elevenLabsApiKey,
    voiceId: state.elevenLabsVoiceId,
  }), shallow);

  // derived state
  const isValidKey = isElevenLabsEnabled(apiKey);

  // remote state
  const { data, isLoading, isError } = apiQuery.elevenlabs.listVoices.useQuery({ elevenKey: apiKey }, {
    enabled: isValidKey,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // global voice
  const voice: VoiceSchema | undefined = data?.voices.find(voice => voice.id === voiceId);

  // [E] autoSpeak
  const previewUrl = (autoSpeak && voice?.previewUrl) || null;
  React.useEffect(() => {
    if (previewUrl)
      playSoundUrl(previewUrl);
  }, [previewUrl]);

  const voicesDropdown = React.useMemo(() =>
      <VoicesDropdown
        isValidKey={isValidKey} isLoadingVoices={isLoading} isErrorVoices={isError}
        voices={data?.voices || []}
        voiceId={voiceId} setVoiceId={(voiceId) => useElevenlabsStore.getState().setElevenLabsVoiceId(voiceId)}
      />,
    [data?.voices, isError, isLoading, isValidKey, voiceId],
  );

  return {
    hasVoices: !isLoading && data?.voices.length,
    voiceId,
    voiceName: voice?.name,
    voicesDropdown,
  };
}