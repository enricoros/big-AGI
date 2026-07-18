import * as React from 'react';

import type { InputProps } from '@mui/joy/Input';
import { Box, IconButton, Input } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';


type DebounceInputProps = Omit<InputProps, 'onChange'> & {
  /**
   * Keep DOM focus on this input while hosted inside a Joy UI Select listbox.
   *
   * The Select steals focus on every filter keystroke: MUI Base's useSelect re-runs a
   * layout effect that focuses the highlighted option whenever the registered options
   * change (its deps include the internal options map, rebuilt on option add/removal).
   * Countermeasures, in order:
   * - onBlur: when focus lands inside the listbox, take it back synchronously - this
   *   keeps the mobile on-screen keyboard up (a delayed refocus hides and re-shows it)
   * - post-debounce repair: for browsers that don't report the focus thief (null
   *   relatedTarget, e.g. older WebKit), restore focus late - no-op when the bounce worked
   * - onKeyDownCapture: stop propagation so the Select's typeahead doesn't grab keystrokes
   */
  retainFocus?: boolean;
  debounceTimeout: number;
  minChars?: number;
  onDebounce: (value: string) => void;
};

const DebouncedInput: React.FC<DebounceInputProps> = (props: DebounceInputProps) => {

  // state
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const refocusTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  // derived state
  const { debounceTimeout, minChars, onDebounce, retainFocus, ...rest } = props;

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

      // Repair pass: if the synchronous bounce (onBlur below) missed the focus steal,
      // restore focus late - flickers the mobile keyboard, but never loses the input
      if (retainFocus) {
        if (refocusTimerRef.current)
          clearTimeout(refocusTimerRef.current);

        refocusTimerRef.current = setTimeout(() => {
          refocusTimerRef.current = undefined;
          if (inputRef.current && document.activeElement !== inputRef.current)
            inputRef.current.focus();
        }, 20);
      }
    }, debounceTimeout);
  }, [debounceTimeout, retainFocus, minChars, onDebounce]);

  const handleClear = React.useCallback(() => {
    setInputValue(''); // Clear internal state
    onDebounce(''); // Call onDebounce with empty string
  }, [onDebounce]);

  const handleRetainFocusBlur = React.useCallback((event: React.FocusEvent) => {
    /* Bounce focus back synchronously when the hosting Select steals it (see `retainFocus` doc).
     * Refocusing within the blur event keeps the mobile on-screen keyboard up; the thief is the
     * listbox itself (an ancestor of this input) or one of its options.
     */
    const thief = event.relatedTarget;
    if (thief instanceof Element && (thief.contains(inputRef.current) || thief.closest('[role="listbox"]')))
      inputRef.current?.focus();
  }, []);


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
      startDecorator={rest.startDecorator === undefined ? <SearchIcon /> : rest.startDecorator}
      onBlur={!retainFocus ? undefined : handleRetainFocusBlur}
      onKeyDownCapture={!retainFocus ? undefined : (event) => {
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
      slotProps={!retainFocus ? undefined : {
        input: { ref: inputRef },
      }}
    />
  );
};

export const DebouncedInputMemo = React.memo(DebouncedInput);
