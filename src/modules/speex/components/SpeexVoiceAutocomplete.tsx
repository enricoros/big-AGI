/**
 * SpeexVoiceAutocomplete - Combined voice/model selector + free-form input
 *
 * Uses MUI Joy Autocomplete with freeSolo to allow:
 * - Selecting from fetched voice/model list (suggestions)
 * - Typing custom value (free-form)
 *
 * Used by LocalAI where models can be selected from list or typed manually.
 */

import * as React from 'react';

import { Autocomplete, AutocompleteOption, Box, CircularProgress, IconButton, Typography } from '@mui/joy';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';

import type { DSpeexEngineAny, SpeexListVoiceOption } from '../speex.types';
import { useSpeexVoices } from './useSpeexVoices';


interface SpeexVoiceAutocompleteProps {
  engine: DSpeexEngineAny;
  /** Current value (can be from list or custom) */
  value: string | undefined;
  /** Called when value changes (selection or typed). undefined = cleared */
  onValueChange: (value: string | undefined) => void;
  /** Placeholder text */
  placeholder?: string;
  disabled?: boolean;
}


export function SpeexVoiceAutocomplete(props: SpeexVoiceAutocompleteProps) {
  const { engine, value /* e.g. ttsModel */, onValueChange, placeholder = 'Select or type...', disabled } = props;

  // fetch voices/models
  const { voices, isLoading, error, refetch } = useSpeexVoices(engine);

  // local input state for freeSolo
  const [inputValue, setInputValue] = React.useState(value ?? '');

  // sync input when value prop changes externally
  React.useEffect(() => {
    setInputValue(value ?? '');
  }, [value]);


  // handlers

  const handleChange = React.useCallback((_event: unknown, newValue: string | SpeexListVoiceOption | null) => {
    // newValue can be: string (typed), SpeexListVoiceOption (selected), or null (cleared)
    if (newValue === null)
      onValueChange(undefined);
    else if (typeof newValue === 'string')
      onValueChange(newValue || undefined);
    else
      onValueChange(newValue.id || undefined);
  }, [onValueChange]);

  const handleInputChange = React.useCallback((_event: unknown, newInputValue: string, reason: string) => {
    // BUGFIX: when re-clicking on the same option on the popup, reason will be 'reset', but the inputValue
    // will be the label of the selected option and not the value. This fixes it
    if (reason !== 'input')
      return;

    setInputValue(newInputValue);
    // For freeSolo, also update value on input change (typing)
    onValueChange(newInputValue || undefined);
  }, [onValueChange]);


  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>

      {/* Refresh button (only if refetch available) */}
      {refetch && (
        <TooltipOutlined color={error ? 'danger' : undefined} title={error ? <pre>{error}</pre> : 'Refresh'}>
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

      {/* Autocomplete */}
      <Autocomplete<SpeexListVoiceOption, false, false, true>
        freeSolo
        openOnFocus
        clearOnEscape
        disabled={disabled}
        placeholder={placeholder}

        options={voices}
        getOptionKey={(option) => typeof option === 'string' ? option : option.id}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
        isOptionEqualToValue={(option, val) => option.id === (typeof val === 'string' ? val : val.id)}
        value={voices.find(o => o.id === value) ?? (value || null)}
        onChange={handleChange}

        inputValue={inputValue}
        onInputChange={handleInputChange}

        loading={isLoading}
        renderOption={(optionProps, option) => {
          const { key, ...rest } = optionProps as any;
          return (
            <AutocompleteOption key={key} {...rest} sx={{ display: 'block' }}>
              <Typography level='title-sm'>{option.name}</Typography>
              {option.description && (
                <Typography level='body-xs' sx={{ opacity: 0.6 }}>{option.description}</Typography>
              )}
            </AutocompleteOption>
          );
        }}
        slotProps={{
          root: {
            sx: { minWidth: 180, maxWidth: 220, flexGrow: 1 },
          },
          listbox: {
            sx: { maxWidth: 'min(400px, calc(100dvw - 1rem))' },
          },
        }}
      />
    </Box>
  );
}