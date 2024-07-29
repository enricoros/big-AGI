import * as React from 'react';

import type { InputProps } from '@mui/joy/Input';
import { Box, IconButton, Input } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';


type DebounceInputProps = Omit<InputProps, 'onChange'> & {
  /**
   * When true, this will not give up the focus on the input field, and aggressively
   * refocus it after the debounce (assuming the callee will cascade a removal, which
   * is the case for Joy UI Select components).
   */
  aggressiveRefocus?: boolean;
  debounceTimeout: number;
  minChars?: number;
  onDebounce: (value: string) => void;
};

const DebouncedInput: React.FC<DebounceInputProps> = (props: DebounceInputProps) => {

  // state
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const refocusTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  // derived state
  const { debounceTimeout, minChars, onDebounce, aggressiveRefocus, ...rest } = props;

  // callbacks

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue); // Update internal state immediately for a responsive UI

    if (debounceTimerRef.current)
      clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      // reset the timer
      debounceTimerRef.current = undefined;

      // Don't call onDebounce if the input value is too short
      if (newValue && minChars && newValue?.length < minChars)
        return;

      // Call onDebounce with the new value
      onDebounce(newValue);

      // If requested, get back the focus
      if (aggressiveRefocus) {
        if (refocusTimerRef.current)
          clearTimeout(refocusTimerRef.current);

        refocusTimerRef.current = setTimeout(() => {
          refocusTimerRef.current = undefined;
          inputRef.current?.focus();
        }, 20);
      }
    }, debounceTimeout);
  }, [debounceTimeout, aggressiveRefocus, minChars, onDebounce]);

  const handleClear = React.useCallback(() => {
    setInputValue(''); // Clear internal state
    onDebounce(''); // Call onDebounce with empty string
  }, [onDebounce]);


  // Clear all timers on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current)
        clearTimeout(debounceTimerRef.current);
      if (refocusTimerRef.current)
        clearTimeout(refocusTimerRef.current);
    };
  }, []);


  return (
    <Input
      {...rest}
      value={inputValue}
      onChange={handleChange}
      aria-label={rest['aria-label'] || 'Search'}
      startDecorator={<SearchIcon />}
      onKeyDownCapture={!aggressiveRefocus ? undefined : (event) => {
        /* We stop the propagation of the event to prevent the parent component from handling it.
         * This is useful only when used inside a Select with options, as the select is eager to capture
         * the focus at every keystroke. This way we keep the focus.
         */
        event.stopPropagation();
      }}
      endDecorator={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!!inputValue && (
            <IconButton size='sm' aria-label='Clear search' onClick={handleClear}>
              <ClearIcon sx={{ fontSize: 'xl' }} />
            </IconButton>
          )}
          {rest.endDecorator}
        </Box>
      }
      slotProps={!aggressiveRefocus ? undefined : {
        input: { ref: inputRef },
      }}
    />
  );
};

export const DebouncedInputMemo = React.memo(DebouncedInput);
