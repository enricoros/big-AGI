import * as React from 'react';

import { Box, CircularProgress, IconButton, Option, optionClasses, Select, SelectSlotsAndSlotProps } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';

import type { DSpeexEngineAny } from '../speex.types';
import { useSpeexVoices } from './useSpeexVoices';


// copied from useLLMSelect.tsx - inspired by optimaSelectSlotProps.listbox
const _selectSlotProps: SelectSlotsAndSlotProps<false>['slotProps'] = {
  root: {
    sx: {
      minWidth: 220, // 180 = 220 - 36 - 4
    },
  },
  button: {
    className: 'agi-ellipsize',
    sx: {
      // these + the ellipsize class will ellipsize the text in the button
      display: 'inline-block',
      textAlign: 'start',
      // maxWidth: 220,
    } as const,
  },
  listbox: {
    // size: 'md',
    // className: 'agi-ellipsize',
    sx: {
      boxShadow: 'xl',
      // Option: clip width to 200...360px
      [`& .${optionClasses.root}`]: {
        // minWidth: 300,
        maxWidth: 'min(640px, calc(100dvw - 0.25rem))', // the small reduction is to avoid accidental h-scrolling because of the border
      },
    },
  } as const,
} as const;


export function SpeexVoiceSelect(props: {
  engine: DSpeexEngineAny;
  voiceId: string | null;
  onVoiceChange: (voiceId: string) => void;
  disabled?: boolean;
  autoPreview?: boolean;
}) {

  // props
  const { engine, voiceId, onVoiceChange, disabled, autoPreview } = props;

  // external state - module
  const { voices, isLoading, error, refetch } = useSpeexVoices(engine);

  // track user-initiated voice changes for preview (not initial load or voice list changes)
  const [userSelectedVoiceId, setUserSelectedVoiceId] = React.useState<string | null>(null);


  // [effect] auto-preview: play voice sample only when user explicitly selects a voice
  const selectedVoice = userSelectedVoiceId ? voices.find(v => v.id === userSelectedVoiceId) : null;
  const previewUrl = (autoPreview && selectedVoice?.previewUrl) || null;
  React.useEffect(() => {
    if (previewUrl)
      void AudioPlayer.playUrl(previewUrl);
  }, [previewUrl]);


  // handlers

  const handleVoiceChange = React.useCallback((_event: unknown, value: string | null) => {
    setUserSelectedVoiceId(value);
    value && onVoiceChange(value);
  }, [onVoiceChange]);

  return <Box sx={{ display: 'flex', alignItems: 'center' }}>

    {refetch && (
      <TooltipOutlined color={error ? 'danger' : undefined} title={error ? <pre>{error}</pre> : 'Refresh voices'}>
        <IconButton
          color={error ? 'danger' : 'neutral'}
          variant='plain'
          disabled={isLoading}
          onClick={() => refetch()}
        >
          {!isLoading ? <RefreshRoundedIcon /> : <CircularProgress size='sm' />}
        </IconButton>
      </TooltipOutlined>
    )}

    <Select
      variant='outlined'
      disabled={disabled || isLoading || voices.length === 0}
      value={voiceId ?? null}
      onChange={handleVoiceChange}
      placeholder={
        error ? 'Error loading voices'
          : isLoading ? 'Loading...'
            : voices.length === 0 ? 'No voices available'
              : voiceId ? `Voice ${voiceId.slice(0, 12)}...`
                : 'Select a voice'
      }
      // startDecorator={<PhVoice />}
      // endDecorator={isLoading && <CircularProgress size='sm' />}
      indicator={<KeyboardArrowDownIcon />}
      slotProps={_selectSlotProps}
    >
      {voices.map(voice => (
        <Option key={voice.id} value={voice.id} label={voice.name.split('-')[0]}>
          <div className='agi-ellipsize'>
            {voice.name} {voice.description && <span style={{ marginLeft: '0.75rem', opacity: 0.5, fontSize: 'smaller' }}>{voice.description}</span>}
          </div>
        </Option>
      ))}
    </Select>

  </Box>;
}
