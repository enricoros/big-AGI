import * as React from 'react';

import { FormControl, FormLabel, Radio, RadioGroup } from '@mui/joy';
import { useUIPreferencesStore } from '~/common/state/store-ui';


export type FormRadioOption<T extends string> = { label: string, value: T, experimental?: boolean };


/**
 * Warning: this must be a constant to avoid re-rendering the radio group
 */
export function useFormRadio<T extends string>(initialValue: T, options: FormRadioOption<T>[], label?: string, hidden?: boolean): [T | null, React.JSX.Element | null] {

  // state
  const [value, setValue] = React.useState<T | null>(initialValue);

  // external state
  const experimentalLabs = useUIPreferencesStore(state => state.experimentalLabs);

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value as T | null);
  }, []);

  const component = React.useMemo(() =>
      hidden === true
        ? null
        : <FormControl>
          {!!label && <FormLabel>{label}</FormLabel>}
          <RadioGroup
            orientation='horizontal'
            value={value} onChange={handleChange}
          >
            {options.map((option) =>
              <Radio key={option.value} disabled={!!option.experimental && !experimentalLabs} value={option.value} label={option.label} />)}
          </RadioGroup>
        </FormControl>,
    [experimentalLabs, handleChange, hidden, label, options, value],
  );

  return [value, component];
}