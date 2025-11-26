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

import { useSpeexActiveEngineId, useSpeexEngines, useSpeexStore } from '../store-module-speex';
import { SpeexEngineConfig } from './SpeexEngineConfig';


export function SpeexOutputSettings() {

  // Speex state
  const engines = useSpeexEngines();
  const activeEngineId = useSpeexActiveEngineId();
  const { setActiveEngineId, updateEngine } = useSpeexStore.getState();

  // Chat auto-speak state
  const { autoSpeak, setAutoSpeak } = useChatAutoAI();

  // Find active engine
  const activeEngine = engines.find(e => e.engineId === activeEngineId);

  // Handlers
  const handleEngineChange = React.useCallback((_: unknown, value: string | null) => {
    setActiveEngineId(value || null);
  }, [setActiveEngineId]);

  const handleEngineUpdate = React.useCallback((updates: Parameters<typeof updateEngine>[1]) => {
    if (activeEngineId) {
      updateEngine(activeEngineId, updates);
    }
  }, [activeEngineId, updateEngine]);

  // Derived state
  const hasEngines = engines.length > 0;

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
