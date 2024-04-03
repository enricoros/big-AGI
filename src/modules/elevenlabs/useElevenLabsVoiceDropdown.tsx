import * as React from 'react';

import { CircularProgress, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverTwoToneIcon from '@mui/icons-material/RecordVoiceOverTwoTone';

import { apiQuery } from '~/common/util/trpc.client';

import { playSoundUrl } from '~/common/util/audioUtils';

import { VoiceSchema } from './elevenlabs.router';
import { isElevenLabsEnabled } from './elevenlabs.client';
import { useElevenLabsApiKey, useElevenLabsVoiceId } from './store-module-elevenlabs';


function VoicesDropdown(props: {
  isValidKey: boolean,
  isLoadingVoices: boolean,
  isErrorVoices: boolean,
  disabled?: boolean,
  voices: VoiceSchema[],
  voiceId: string | null,
  setVoiceId: (voiceId: string) => void,
}) {

  const handleVoiceChange = (_event: any, value: string | null) => props.setVoiceId(value || '');

  return (
    <Select
      value={props.voiceId} onChange={handleVoiceChange}
      variant='outlined' disabled={props.disabled || !props.voices.length}
      // color={props.isErrorVoices ? 'danger' : undefined}
      placeholder={props.isErrorVoices ? 'Issue loading voices' : props.isValidKey ? 'Select a voice' : 'Missing API Key'}
      startDecorator={<RecordVoiceOverTwoToneIcon />}
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


export function useElevenLabsVoices() {
  const [apiKey] = useElevenLabsApiKey();

  const isConfigured = isElevenLabsEnabled(apiKey);

  const { data, isLoading, isError } = apiQuery.elevenlabs.listVoices.useQuery({ elevenKey: apiKey }, {
    enabled: isConfigured,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    isConfigured,
    isLoading,
    isError,
    hasVoices: !isLoading && !!data?.voices.length,
    voices: data?.voices || [],
  };
}


export function useElevenLabsVoiceDropdown(autoSpeak: boolean, disabled?: boolean) {

  // external state
  const { isConfigured, isLoading, isError, hasVoices, voices } = useElevenLabsVoices();
  const [voiceId, setVoiceId] = useElevenLabsVoiceId();

  // derived state
  const voice: VoiceSchema | undefined = voices.find(voice => voice.id === voiceId);

  // [E] autoSpeak
  const previewUrl = (autoSpeak && voice?.previewUrl) || null;
  React.useEffect(() => {
    if (previewUrl)
      playSoundUrl(previewUrl);
  }, [previewUrl]);

  const voicesDropdown = React.useMemo(() =>
      <VoicesDropdown
        isValidKey={isConfigured} isLoadingVoices={isLoading} isErrorVoices={isError} disabled={disabled}
        voices={voices}
        voiceId={voiceId} setVoiceId={setVoiceId}
      />,
    [disabled, isConfigured, isError, isLoading, setVoiceId, voiceId, voices],
  );

  return {
    hasVoices,
    voiceId,
    voiceName: voice?.name,
    voicesDropdown,
  };
}