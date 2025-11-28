import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { CircularProgress, Option, optionClasses, Select, SelectSlotsAndSlotProps } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { AudioPlayer } from '~/common/util/audio/AudioPlayer';

import { DSpeexEngineAny, SpeexListVoiceOption, SpeexListVoicesResult } from '../speex.types';
import { speexListVoices_RPC } from '../protocols/rpc/rpc.client';
import { useSpeexWebSpeechVoices } from '../protocols/webspeech/webspeech.client';


// copied from useLLMSelect.tsx - inspired by optimaSelectSlotProps.listbox
const _selectSlotProps: SelectSlotsAndSlotProps<false>['slotProps'] = {
  root: {
    sx: {
      minWidth: 220,
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
      // larger list
      // '--ListItem-paddingLeft': '1rem',
      // '--ListItem-minHeight': '2.5rem', // note that in the Optima Dropdowns we use 2.75rem
      '--ListItemDecorator-size': '2rem', // compensate for the border
      boxShadow: 'xl',
      // v-size: keep the default
      // maxHeight: 'calc(100dvh - 200px)',

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
  const { voices, isLoading, error } = useSpeexVoices(engine);

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

  return (
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
      endDecorator={isLoading && <CircularProgress size='sm' />}
      indicator={<KeyboardArrowDownIcon />}
      slotProps={_selectSlotProps}
    >
      {voices.map(voice => (
        <Option key={voice.id} value={voice.id} label={voice.name}>
          <div className='agi-ellipsize'>
            {voice.name} {voice.description && <span style={{ marginLeft: '0.75rem', opacity: 0.5, fontSize: 'smaller' }}>{voice.description}</span>}
          </div>
        </Option>
      ))}
    </Select>
  );
}


// hooks - voice data: returns voices given an engine

const _stableEmptyVoices: SpeexListVoiceOption[] = [] as const;

function useSpeexVoices(engine: DSpeexEngineAny): SpeexListVoicesResult {

  // props
  const { vendorType, engineId } = engine;
  const isWebspeech = vendorType === 'webspeech';

  // use browser voices
  const browserVoicesResult = useSpeexWebSpeechVoices(isWebspeech);

  // use RPC voices
  const { data: cloudVoices, error: cloudError, isLoading: cloudIsLoading } = useQuery({
    enabled: !isWebspeech,
    queryKey: ['speex', 'listVoices', engineId, vendorType],
    queryFn: () => speexListVoices_RPC(engine as any /* will not run for 'webspeech' */),
    staleTime: 5 * 60 * 1000, // 5 minutes - voices don't change often
  });

  // switch result
  return isWebspeech ? browserVoicesResult : {
    voices: cloudVoices?.length ? cloudVoices : _stableEmptyVoices,
    isLoading: cloudIsLoading,
    error: cloudError instanceof Error ? cloudError.message : null,
  };
}
