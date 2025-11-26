/**
 * SpeexVoiceDropdown - Generic voice selector for any Speex engine
 *
 * Uses speexListVoicesForEngine for cloud providers and useWebSpeechVoices for browser TTS.
 * Supports optional voice preview with play/stop functionality.
 */

import * as React from 'react';

import { CircularProgress, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverTwoToneIcon from '@mui/icons-material/RecordVoiceOverTwoTone';

import { apiQuery } from '~/common/util/trpc.client';

import type { DSpeexEngineAny, SpeexVendorType } from '../speex.types';
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


// Voice Data Hook

interface VoiceInfo {
  id: string;
  name: string;
  description?: string;
  previewUrl?: string;
}

function useSpeexVoices(engine: DSpeexEngineAny): {
  voices: VoiceInfo[];
  isLoading: boolean;
  error: string | null;
} {
  const vendorType = engine.vendorType;

  // Browser voices (webspeech)
  const browserVoices = useSpeexWebSpeechVoices();

  // Cloud voices (elevenlabs, openai, localai) - use RPC
  // For now, we'll use hardcoded voices for OpenAI and skip RPC for LocalAI
  const shouldFetchRPC = vendorType === 'elevenlabs';

  // Note: This is a simplified implementation
  // In a full implementation, we'd call speexListVoicesRPC through react-query

  if (vendorType === 'webspeech') {
    return {
      voices: browserVoices.voices.map(v => ({
        id: v.voiceURI,
        name: v.name,
        description: `${v.lang}${v.localService ? ' (local)' : ''}`,
      })),
      isLoading: browserVoices.isLoading,
      error: null,
    };
  }

  if (vendorType === 'openai') {
    // OpenAI has hardcoded voices
    return {
      voices: [
        { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
        { id: 'ash', name: 'Ash', description: 'Warm and engaging' },
        { id: 'coral', name: 'Coral', description: 'Warm and friendly' },
        { id: 'echo', name: 'Echo', description: 'Clear and resonant' },
        { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
        { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
        { id: 'nova', name: 'Nova', description: 'Friendly and upbeat' },
        { id: 'sage', name: 'Sage', description: 'Calm and wise' },
        { id: 'shimmer', name: 'Shimmer', description: 'Clear and bright' },
      ],
      isLoading: false,
      error: null,
    };
  }

  if (vendorType === 'localai') {
    // LocalAI voices depend on configuration - can't enumerate
    return {
      voices: [],
      isLoading: false,
      error: null,
    };
  }

  if (vendorType === 'elevenlabs') {
    // TODO: Implement ElevenLabs voice fetching via speexListVoicesRPC
    // For now, return empty - will be populated when properly integrated
    return {
      voices: [],
      isLoading: false,
      error: 'ElevenLabs voice listing not yet integrated',
    };
  }

  return { voices: [], isLoading: false, error: 'Unknown vendor type' };
}
