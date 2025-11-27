/**
 * SpeexOutputSettings - Voice output settings for the Settings Modal
 *
 * Provides:
 * - Engine selection dropdown
 * - Per-engine voice configuration
 * - Auto-speak toggle (from chat settings)
 */

import * as React from 'react';

import { FormControl, FormHelperText, Option, Select, Typography } from '@mui/joy';

import { useChatAutoAI } from '../../../apps/chat/store-app-chat';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';

import type { DSpeexEngineAny } from '../speex.types';
import { SpeexEngineConfig } from './SpeexEngineConfig';
import { useSpeexActiveEngineId, useSpeexEngines, useSpeexStore } from '../store-module-speex';


export function SpeexOutputSettings() {

  // external state
  const { autoSpeak, setAutoSpeak } = useChatAutoAI();

  // external state - module
  const engines = useSpeexEngines();
  const activeEngineId = useSpeexActiveEngineId();
  // const { setActiveEngineId, updateEngine } = useSpeexStore.getState();


  // derived state
  const hasEngines = engines.length > 0;
  const activeEngine = engines.find(e => e.engineId === activeEngineId);


  // handlers

  const handleEngineChange = React.useCallback((_: unknown, value: string | null) => {
    useSpeexStore.getState().setActiveEngineId(value || null);
  }, []);

  const handleEngineUpdate = React.useCallback((updates: Partial<DSpeexEngineAny>) => {
    if (activeEngineId)
      useSpeexStore.getState().updateEngine(activeEngineId, updates);
  }, [activeEngineId]);


  return <>

    {/* Auto-speak setting */}
    <FormRadioControl
      title='Speak Responses'
      description={autoSpeak === 'off' ? 'Off' : autoSpeak === 'firstLine' ? 'First paragraph' : 'Full response'}
      tooltip={!hasEngines ? 'No voice engines available. Configure a TTS service or use system voice.' : undefined}
      disabled={!hasEngines}
      options={[
        { value: 'off', label: 'Off' },
        { value: 'firstLine', label: 'Start' },
        { value: 'all', label: 'Full' },
      ]}
      value={autoSpeak} onChange={setAutoSpeak}
    />

    {/* Engine selection */}
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Voice Engine' description='TTS provider' />
      <Select
        value={activeEngineId || ''}
        onChange={handleEngineChange}
        placeholder={hasEngines ? 'Select engine' : 'No engines available'}
        disabled={!hasEngines}
        sx={{ minWidth: 200 }}
      >
        {engines.map(engine => (
          <Option key={engine.engineId} value={engine.engineId}>
            {engine.label}
            {engine.isAutoLinked && <Typography level='body-xs' sx={{ ml: 1, opacity: 0.6 }}>(linked)</Typography>}
          </Option>
        ))}
      </Select>
    </FormControl>

    {/* Engine-specific configuration */}
    {activeEngine ? (
      <SpeexEngineConfig
        engine={activeEngine}
        onUpdate={handleEngineUpdate}
        mode='voice-only'
      />
    ) : (
      <FormHelperText>
        {hasEngines
          ? 'Select a voice engine to configure its voice settings.'
          : 'No voice engines detected. Voice engines are auto-detected from your LLM services (OpenAI) or browser (System Voice).'}
      </FormHelperText>
    )}

  </>;
}
