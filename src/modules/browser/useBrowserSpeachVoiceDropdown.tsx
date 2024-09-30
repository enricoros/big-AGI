import * as React from 'react';

import { CircularProgress, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverTwoToneIcon from '@mui/icons-material/RecordVoiceOverTwoTone';

import { useBrowseVoiceId } from './store-module-browser';
import { speakText, cancel } from './browser.speechSynthesis.client';
import { promises } from 'dns';


function VoicesDropdown(props: {
  isValidKey: boolean,
  isFetchingVoices: boolean,
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
      placeholder={props.isErrorVoices ? 'Issue loading voices' : 'Select a voice'}
      startDecorator={<RecordVoiceOverTwoToneIcon />}
      endDecorator={props.isValidKey && props.isFetchingVoices && <CircularProgress size='sm' />}
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

function allVoicesObtained(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(function (resolve, reject) {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length !== 0) {
      resolve(voices);
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', function () {
        voices = window.speechSynthesis.getVoices();
        resolve(voices);
      });
    }
  });
}

export function useBrowserSpeachVoices() {
  
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  
  React.useEffect(() => {
    allVoicesObtained()
    .then(data =>
      setVoices(data)
    );
   }, [])

  return {
    hasVoices: voices.length > 0,
    voices: voices || [],
  };
}

export function useBrowserSpeachVoiceDropdown(autoSpeak: boolean, disabled?: boolean) {

  // external state
  const { hasVoices, voices } = useBrowserSpeachVoices();
  const [ voiceId, setVoiceId ] = useBrowseVoiceId();

  // derived state
  const voice = Number.isNaN(voiceId)? null : voices[voiceId];

  // [E] autoSpeak
  React.useEffect(() => {
    if (autoSpeak) {
      speakText(`How can I assist you today?`, String(voiceId));
    }
    return () => {
      cancel()
    }
  }, [autoSpeak, voiceId]);

  const voicesDropdown = React.useMemo(() =>
      <VoicesDropdown
        isValidKey={true} isFetchingVoices={false} isErrorVoices={false} disabled={disabled}
        voices={voices}
        voiceId={voiceId} setVoiceId={setVoiceId}
      />,
    [disabled, setVoiceId, voiceId, voices],
  );

  return {
    hasVoices,
    voiceId,
    voiceName: voice?.name,
    voicesDropdown,
  };
}