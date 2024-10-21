import * as React from 'react';

import { ListItemDecorator, MenuItem } from '@mui/joy';
import SettingsIcon from '@mui/icons-material/Settings';

import { DarkModeToggleButton } from '~/common/components/DarkModeToggleButton';

import { optimaOpenPreferences } from '../useOptima';


export function OptimaPreferencesMenuItem(props: { onCloseMenu: () => void }) {

  const { onCloseMenu } = props;

  const handleShowPreferences = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    optimaOpenPreferences();
    onCloseMenu();
  }, [onCloseMenu]);

  return (
    <MenuItem onClick={handleShowPreferences}>
      <ListItemDecorator><SettingsIcon /></ListItemDecorator>
      Big-AGI Preferences{/*<KeyStroke combo='Ctrl + ,' />*/}
      <DarkModeToggleButton />
    </MenuItem>
  );
}
