import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { CircularProgress, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverTwoToneIcon from '@mui/icons-material/RecordVoiceOverTwoTone';

import type { DSpeexEngineAny, SpeexListVoiceOption } from '../speex.types';
import { speexListVoices_RPC } from '../protocols/rpc/rpc.client';
import { useSpeexWebSpeechVoices } from '../protocols/webspeech/webspeech.client';


export function SpeexVoiceDropdown(props: {
  engine: DSpeexEngineAny;
  voiceId: string | null;
  onVoiceChange: (voiceId: string) => void;
  disabled?: boolean;
  autoPreview?: boolean;
}) {

  // props
  const { engine, voiceId, onVoiceChange, disabled, autoPreview } = props;

  // external state - module
  const { voices, isLoading, error } = useSpeexVoices(engine);


  // handlers

  const handleVoiceChange = React.useCallback((_event: unknown, value: string | null) => {
    if (value) onVoiceChange(value);
  }, [onVoiceChange]);


  return (
    <Select
      value={voiceId ?? ''}
      onChange={handleVoiceChange}
      variant='outlined'
      disabled={disabled || isLoading || voices.length === 0}
      placeholder={
        error ? 'Error loading voices'
          : isLoading ? 'Loading...'
            : voices.length === 0 ? 'No voices available'
              : 'Select a voice'
      }
      startDecorator={<RecordVoiceOverTwoToneIcon />}
      endDecorator={isLoading && <CircularProgress size='sm' />}
      indicator={<KeyboardArrowDownIcon />}
      slotProps={{
        root: { sx: { width: '100%' } },
        indicator: { sx: { opacity: 0.5 } },
      }}
    >
      {voices.map(voice => (
        <Option key={voice.id} value={voice.id}>
          {voice.name}
          {voice.description && <span style={{ opacity: 0.6, marginLeft: 8 }}>({voice.description})</span>}
        </Option>
      ))}
    </Select>
  );
}


// voice Data Hook - returns SpeexListVoiceOption[] for all vendors

function useSpeexVoices(engine: DSpeexEngineAny): {
  voices: SpeexListVoiceOption[];
  isLoading: boolean;
  error: string | null;
} {

  const { vendorType, engineId } = engine;
  const isCloudVendor = vendorType !== 'webspeech';

  // browser voices (webspeech) - returns normalized SpeexListVoiceOption[]
  const browserVoices = useSpeexWebSpeechVoices(engine.vendorType === 'webspeech');

  // RPC voices (for this engine) via react-query - credential resolution happens inside queryFn
  const cloudVoicesQuery = useQuery({
    queryKey: ['speex', 'listVoices', engineId, vendorType],
    queryFn: () => speexListVoices_RPC(engine as any /* will not run for 'webspeech' */),
    enabled: isCloudVendor,
    staleTime: 5 * 60 * 1000, // 5 minutes - voices don't change often
  });

  // WebSpeech: use browser voices (already normalized)
  if (!isCloudVendor)
    return {
      voices: browserVoices.voices,
      isLoading: browserVoices.isLoading,
      error: null,
    };

  // Cloud providers: use react-query result
  return {
    voices: cloudVoicesQuery.data?.voices ?? [],
    isLoading: cloudVoicesQuery.isLoading,
    error: cloudVoicesQuery.error instanceof Error ? cloudVoicesQuery.error.message : null,
  };
}
