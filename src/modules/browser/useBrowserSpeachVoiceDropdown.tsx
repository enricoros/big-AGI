import * as React from 'react';

import { CircularProgress, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverTwoToneIcon from '@mui/icons-material/RecordVoiceOverTwoTone';

import { useBrowseVoiceId } from './store-module-browser';
import { speakText, cancel } from './browser.speechSynthesis.client';


function VoicesDropdown(props: {
  isValidKey: boolean,
  isLoadingVoices: boolean,
  isErrorVoices: boolean,
  disabled?: boolean,
  voices: SpeechSynthesisVoice[],
  voiceId: number | null,
  setVoiceId: (voiceId: number) => void,
}) {

  const handleVoiceChange = (_event: any, value: number | null) => props.setVoiceId(value === null? 0 : value);

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
      {props.voices.map((voice, index) => (
        <Option key={index} value={index}>
          {voice.name}
        </Option>
      ))}
    </Select>
  );
}


export function useBrowserSpeachVoices() {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();

  return {
    hasVoices: voices.length > 0,
    voices: voices || [],
  };
}


export function useBrowserSpeachVoiceDropdown(autoSpeak: boolean, disabled?: boolean) {

  // external state
  const { hasVoices, voices } = useBrowserSpeachVoices();
  const [voiceId, setVoiceId] = useBrowseVoiceId();

  // derived state
  const voice = voices.length > voiceId? voices[voiceId] : null;

  // [E] autoSpeak
  React.useEffect(() => {
    if (autoSpeak && voice) {
      speakText(`How can I assist you today?`, voiceId);
    }
    return () => {
      cancel()
    }
  }, [autoSpeak, voice, voiceId]);

  const voicesDropdown = React.useMemo(() =>
      <VoicesDropdown
        isValidKey={true} isLoadingVoices={false} isErrorVoices={false} disabled={disabled}
        voices={voices}
        voiceId={voiceId} setVoiceId={setVoiceId}
      />,
    [disabled, setVoiceId, voiceId, voices],
  );

  return {
    hasVoices: hasVoices,
    voiceId,
    voiceName: voice?.name,
    voicesDropdown,
  };
}