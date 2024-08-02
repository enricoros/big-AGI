import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { UIComplexityMode } from '~/common/app.theme';
import { FormSelectControl, FormSelectOption } from '~/common/components/forms/FormSelectControl';
import { useUIPreferencesStore } from '~/common/state/store-ui';


const AppearanceOptions: FormSelectOption<UIComplexityMode>[] = [
  { value: 'minimal', label: 'Minimal', description: 'Clean' },
  { value: 'pro', label: 'Pro (default)', description: 'Perfect' },
  { value: 'extra', label: 'Extra', description: 'GIFs & more.' },
];

export function SettingUIComplexity(props: { noLabel?: boolean }) {

  // external state
  const [complexityMode, setComplexityMode] = useUIPreferencesStore(useShallow(state => [state.complexityMode, state.setComplexityMode]));

  return (
    <FormSelectControl
      title={props.noLabel ? undefined : 'Appearance'}
      options={AppearanceOptions}
      value={complexityMode}
      onChange={setComplexityMode}
      selectSx={{ minWidth: 150 }}
    />
  );
}
