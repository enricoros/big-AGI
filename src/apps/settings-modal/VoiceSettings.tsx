import * as React from 'react';

import { FormControl, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { useASREngine, useChatAutoAI, useChatMicTimeoutMs } from '../chat/store-app-chat';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { LanguageSelect } from '~/common/components/LanguageSelect';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { ASREngineKey, ASREngineList } from '~/modules/asr/asr.client';
import { TTSEngineKey, TTSEngineList, useTTSEngine } from '~/modules/tts/useTTSStore';
import { useTTSCapability } from '~/modules/tts/tts.client.hooks';

export function VoiceSettings() {
  // external state
  const isMobile = useIsMobile();
  const { autoSpeak, setAutoSpeak } = useChatAutoAI();

  const [chatTimeoutMs, setChatTimeoutMs] = useChatMicTimeoutMs();
  const [TTSEngine, setTTSEngine] = useTTSEngine();
  const [ASREngine, setASREngine] = useASREngine();

  // this converts from string keys to numbers and vice versa
  const chatTimeoutValue: string = '' + chatTimeoutMs;
  const setChatTimeoutValue = (value: string) => value && setChatTimeoutMs(parseInt(value));

  const { mayWork: hasVoices } = useTTSCapability();

  const handleTTSChanged = (_event: any, newValue: TTSEngineKey | null) => {
    if (!newValue) return;
    setTTSEngine(newValue);
  };

  const handleASRChanged = (_event: any, newValue: ASREngineKey | null) => {
    if (!newValue) return;
    setASREngine(newValue);
  };

  return (
    <>
      {/* LanguageSelect: moved from the UI settings (where it logically belongs), just to group things better from an UX perspective */}
      <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart
          title="Language"
          description="ASR and TTS"
          tooltip="Currently for Microphone input and Voice output. Microphone support varies by browser (iPhone/Safari lacks speech input). We will use the ElevenLabs MultiLanguage model if a language other than English is selected."
        />
        <LanguageSelect />
      </FormControl>

      {!isMobile && (
        <FormRadioControl
          title="Mic Timeout"
          description={chatTimeoutMs < 1000 ? 'Best for quick calls' : chatTimeoutMs > 5000 ? 'Best for thinking' : 'Standard'}
          options={[
            { value: '600', label: '.6s' },
            { value: '2000', label: '2s' },
            { value: '15000', label: '15s' },
          ]}
          value={chatTimeoutValue}
          onChange={setChatTimeoutValue}
        />
      )}

      <FormRadioControl
        title="Speak Responses"
        description={autoSpeak === 'off' ? 'Off' : 'First paragraph'}
        tooltip={!hasVoices ? 'No voices available, please configure a voice synthesis service' : undefined}
        disabled={!hasVoices}
        options={[
          { value: 'off', label: 'Off' },
          { value: 'firstLine', label: 'Start' },
          { value: 'all', label: 'Full' },
        ]}
        value={autoSpeak}
        onChange={setAutoSpeak}
      />

      <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title="TTS engine" description="Text to speech / voice synthesis" tooltip="" />

        <Select
          value={TTSEngine}
          onChange={handleTTSChanged}
          indicator={<KeyboardArrowDownIcon />}
          slotProps={{
            root: { sx: { minWidth: 200 } },
            indicator: { sx: { opacity: 0.5 } },
          }}
        >
          {TTSEngineList.map((i) => (
            <Option key={i.key} value={i.key}>
              {i.label}
            </Option>
          ))}
        </Select>
      </FormControl>

      <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title="ASR engine" description="Automatic Speech Recognition" tooltip="" />
        <Select
          value={ASREngine}
          onChange={handleASRChanged}
          indicator={<KeyboardArrowDownIcon />}
          slotProps={{
            root: { sx: { minWidth: 200 } },
            indicator: { sx: { opacity: 0.5 } },
          }}
        >
          {ASREngineList.map((i) => (
            <Option key={i.key} value={i.key}>
              {i.label}
            </Option>
          ))}
        </Select>
      </FormControl>
    </>
  );
}
