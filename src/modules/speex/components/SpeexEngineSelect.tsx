/**
 * SpeexEngineSelect - Reusable engine selection dropdown
 */

import * as React from 'react';

import { Option, Select, Typography } from '@mui/joy';

import type { DSpeexVendorType, SpeexEngineId } from '../speex.types';
import { speexAreCredentialsValid, useSpeexEngines } from '../store-module-speex';


export function speexVendorTypeLabel(vendorType: DSpeexVendorType): string {
  switch (vendorType) {
    case 'elevenlabs':
      return 'ElevenLabs';
    case 'openai':
      return 'OpenAI';
    case 'localai':
      return 'LocalAI';
    case 'webspeech':
      return 'System';
  }
}


interface SpeexEngineSelectProps {
  /** Selected engine ID (null = none selected) */
  engineId: string | null;
  /** Called when selection changes */
  onEngineChange: (engineId: string | null) => void;
  /** Disable the select */
  disabled?: boolean;
  /** Placeholder text (default: 'Select engine...') */
  placeholder?: string;
}

export function SpeexEngineSelect(props: SpeexEngineSelectProps) {
  const { engineId, onEngineChange, disabled, placeholder = 'Select engine...' } = props;

  const engines = useSpeexEngines();

  const validEngines = React.useMemo(
    () => engines.filter(e => speexAreCredentialsValid(e.credentials)),
    [engines],
  );

  const handleChange = React.useCallback((_event: unknown, value: SpeexEngineId | null) => {
    onEngineChange(value);
  }, [onEngineChange]);

  return (
    <Select
      value={engineId}
      disabled={disabled || !validEngines.length}
      placeholder={placeholder}
      onChange={handleChange}
      sx={{ minWidth: 200 }}
    >
      {validEngines.map(({ engineId, label, vendorType }) => (
        <Option key={engineId} value={engineId} label={label}>
          {label}
          {!label.toLowerCase().includes(vendorType) && (
            <Typography level='body-xs' sx={{ ml: 1, color: 'text.tertiary' }}>
              ({speexVendorTypeLabel(vendorType)})
            </Typography>
          )}
        </Option>
      ))}
    </Select>
  );
}
