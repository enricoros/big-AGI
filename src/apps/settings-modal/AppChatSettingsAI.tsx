import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, Switch } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useUIPreferencesStore } from '~/common/state/store-ui';


export function AppChatSettingsAI() {
  // external state
  const {
    autosetChatTitle, setAutoSetChatTitle,
  } = useUIPreferencesStore(state => ({
    autosetChatTitle: state.autoSetChatTitle, setAutoSetChatTitle: state.setAutoSetChatTitle,
  }), shallow);

  const handleAutoSetChatTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSetChatTitle(event.target.checked);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Chat Title'
                      description={autosetChatTitle ? 'LLM Titling' : 'Manual only'} />
      <Switch checked={autosetChatTitle} onChange={handleAutoSetChatTitleChange}
              endDecorator={autosetChatTitle ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

  </>;
}
