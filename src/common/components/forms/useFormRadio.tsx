import * as React from 'react';

import { FormControl, FormLabel, Radio, RadioGroup } from '@mui/joy';

import { FormRadioOption } from './FormRadioControl';


/**
 * Warning: this must be a constant to avoid re-rendering the radio group
 */
export function useFormRadio<T extends string>(initialValue: T, options: FormRadioOption<T>[], label?: string, hidden?: boolean): [T | null, React.JSX.Element | null, React.Dispatch<React.SetStateAction<T | null>>] {

  // state
  const [value, setValue] = React.useState<T | null>(initialValue);

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value as T | null);
  }, []);

  const component = React.useMemo(() => hidden === true ? null : (
    <FormControl /* size='sm' NOTE: this would make all forms smaller, but requires an adaptation of all the other <RadioGroups> as well, including settings */>
      {!!label && <FormLabel>{label}</FormLabel>}
      <RadioGroup
        orientation='horizontal'
        value={value} onChange={handleChange}
        sx={{ gap: 0.5 }}
      >
        {options.map((option) =>
          <Radio key={option.value} disabled={option.disabled} value={option.value} label={option.label} />)}
      </RadioGroup>
    </FormControl>
  ), [handleChange, hidden, label, options, value]);

  return [value, component, setValue];
}