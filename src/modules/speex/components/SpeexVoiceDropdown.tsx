import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { CircularProgress, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverTwoToneIcon from '@mui/icons-material/RecordVoiceOverTwoTone';

import type { DSpeexEngineAny } from '../speex.types';
import type { SpeexVoiceInfo } from '../speex.client';
import { speexListVoicesRPC } from '../vendors/rpc.client';
import { useSpeexWebSpeechVoices } from '../vendors/webspeech.client';


interface SpeexVoiceDropdownProps {
  engine: DSpeexEngineAny;
  voiceId: string | null;
  onVoiceChange: (voiceId: string) => void;
  disabled?: boolean;
  autoPreview?: boolean;
}


export function SpeexVoiceDropdown(props: SpeexVoiceDropdownProps) {
  const { engine, voiceId, onVoiceChange, disabled, autoPreview } = props;

  // Get voices based on vendor type
  const { voices, isLoading, error } = useSpeexVoices(engine);

  const handleVoiceChange = (_event: unknown, value: string | null) => {
    if (value) onVoiceChange(value);
  };

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


// Voice Data Hook - returns SpeexVoiceInfo[] for all vendors

function useSpeexVoices(engine: DSpeexEngineAny): {
  voices: SpeexVoiceInfo[];
  isLoading: boolean;
  error: string | null;
} {
  const { vendorType, engineId } = engine;
  const isCloudVendor = vendorType !== 'webspeech';

  // Browser voices (webspeech) - returns normalized SpeexVoiceInfo[]
  const browserVoices = useSpeexWebSpeechVoices();

  // Cloud voices via react-query - credential resolution happens inside queryFn
  const cloudVoicesQuery = useQuery({
    queryKey: ['speex', 'listVoices', engineId, vendorType],
    queryFn: () => speexListVoicesRPC(engine),
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
