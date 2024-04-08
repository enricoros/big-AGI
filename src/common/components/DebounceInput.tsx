import * as React from 'react';

import type { InputProps } from '@mui/joy/Input';
import { Box, IconButton, Input } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';

type DebounceInputProps = Omit<InputProps, 'onChange'> & {
  minChars?: number;
  onDebounce: (value: string) => void;
  debounceTimeout: number;
};

const DebounceInput: React.FC<DebounceInputProps> = ({
                                                       minChars,
                                                       onDebounce,
                                                       debounceTimeout,
                                                       ...rest
                                                     }) => {
  const [inputValue, setInputValue] = React.useState('');
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue); // Update internal state immediately for a responsive UI

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      // Don't call onDebounce if the input value is too short
      if (newValue && minChars && newValue?.length < minChars)
        return;
      onDebounce(newValue); // Call onDebounce after the debounce timeout
    }, debounceTimeout);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClear = () => {
    setInputValue(''); // Clear internal state
    onDebounce(''); // Call onDebounce with empty string
  };

  return (
    <Input
      {...rest}
      value={inputValue}
      onChange={handleChange}
      aria-label={rest['aria-label'] || 'Search'}
      startDecorator={<SearchIcon />}
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
    />
  );
};

export const DebounceInputMemo = React.memo(DebounceInput);
