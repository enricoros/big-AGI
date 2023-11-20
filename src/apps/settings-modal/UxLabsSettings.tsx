import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Button, FormControl, Switch } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { closeLayoutPreferences } from '~/common/layout/store-applayout';
import { navigateToLabs } from '~/common/app.routes';
import { useUIPreferencesStore } from '~/common/state/store-ui';


export function UxLabsSettings() {
  // external state
  const {
    experimentalLabs, setExperimentalLabs,
  } = useUIPreferencesStore(state => ({
    experimentalLabs: state.experimentalLabs, setExperimentalLabs: state.setExperimentalLabs,
  }), shallow);

  const handleExperimentalLabsChange = (event: React.ChangeEvent<HTMLInputElement>) => setExperimentalLabs(event.target.checked);


  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Experiments'
                      description={experimentalLabs ? 'Enabled' : 'Disabled'} />
      <Switch checked={experimentalLabs} onChange={handleExperimentalLabsChange}
              endDecorator={experimentalLabs ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <Button variant='soft' onClick={() => {
      closeLayoutPreferences();
      void navigateToLabs();
    }} sx={{ ml: 'auto' }}>
      👉 See Experiments
    </Button>

  </>;
}