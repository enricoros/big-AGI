import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { FormSelectControl, FormSelectOption } from '~/common/components/forms/FormSelectControl';
import { useUIPreferencesStore } from '~/common/stores/store-ui';


const QuickOptions: FormSelectOption<'off' | 'call' | 'beam'>[] = [
  { value: 'beam', label: 'Beam', description: 'Beam it' },
  { value: 'call', label: 'Call', description: 'Call Persona' },
  { value: 'off', label: 'Off', description: 'Hide' },
];

export function SettingUIComposerQuickButton(props: { noLabel?: boolean }) {

  // external state
  const [composerQuickButton, setComposerQuickButton] = useUIPreferencesStore(useShallow(state => [state.composerQuickButton, state.setComposerQuickButton]));

  return (
    <FormSelectControl
      title={props.noLabel ? undefined : 'Quick Button'}
      options={QuickOptions}
      value={composerQuickButton}
      onChange={setComposerQuickButton}
      selectSx={{ minWidth: 150 }}
    />
  );
}
