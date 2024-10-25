import * as React from 'react';

import { CircularProgress, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverTwoToneIcon from '@mui/icons-material/RecordVoiceOverTwoTone';

import { useBrowseVoiceId } from './store-module-webspeech';
import { speakText, cancel } from '../../tts.client';

function VoicesDropdown(props: {
  isValidKey: boolean;
  isFetchingVoices: boolean;
  isErrorVoices: boolean;
  disabled?: boolean;
  voices: SpeechSynthesisVoice[];
  voiceId: string;
  setVoiceId: (voiceId: string) => void;
}) {
  const handleVoiceChange = (_event: any, value: string | null) => props.setVoiceId(value === null ? '' : value);

  return (
    <Select
      value={props.voiceId}
      onChange={handleVoiceChange}
      variant="outlined"
      disabled={props.disabled || !props.voices.length}
      // color={props.isErrorVoices ? 'danger' : undefined}
      placeholder={props.voices.length === 0 ? 'No voice available' : 'Select a voice'}
      startDecorator={<RecordVoiceOverTwoToneIcon />}
      endDecorator={props.isValidKey && props.isFetchingVoices && <CircularProgress size="sm" />}
      indicator={<KeyboardArrowDownIcon />}
      slotProps={{
        root: { sx: { width: '100%' } },
        indicator: { sx: { opacity: 0.5 } },
      }}
    >
      {props.voices.map((voice, index) => (
        <Option key={voice.name} value={voice.name}>
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

export function useBrowserSpeechVoices() {
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);

  React.useEffect(() => {
    allVoicesObtained().then((data) => setVoices(data));
  }, []);

  return {
    hasVoices: voices.length > 0,
    voices: voices || [],
  };
}

export function useBrowserSpeechVoiceDropdown(
  autoSpeak: boolean,
  {
    disabled,
    voiceNameFilters,
    testUtterance,
  }: {
    disabled?: boolean;
    voiceNameFilters?: string[] | null;
    testUtterance?: string | null;
  },
) {
  // external state
  const { hasVoices, voices } = useBrowserSpeechVoices();
  const [voiceId, setVoiceId] = useBrowseVoiceId();

  // derived state
  const voice = voices.find((voice) => voiceId === voice.name);
  const voiceFiltered = voiceNameFilters ? voices.filter((voice) => voiceNameFilters.includes(voice.name)) : voices;

  // [E] autoSpeak
  React.useEffect(() => {
    if (autoSpeak && voice && voiceFiltered.includes(voice)) {
      speakText(testUtterance ? testUtterance.replace('{name}', voice.name) : `How can I assist you today?`, String(voiceId));
    }
    return () => {
      cancel();
    };
  }, [autoSpeak, testUtterance, voice, voiceFiltered, voiceId, voiceNameFilters]);

  const voicesDropdown = React.useMemo(
    () => (
      <VoicesDropdown
        isValidKey={true}
        isFetchingVoices={false}
        isErrorVoices={false}
        disabled={disabled}
        voices={voiceFiltered}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
      />
    ),
    [disabled, setVoiceId, voiceFiltered, voiceId],
  );

  return {
    hasVoices,
    voiceId,
    voiceName: voice?.name,
    voicesDropdown,
  };
}
