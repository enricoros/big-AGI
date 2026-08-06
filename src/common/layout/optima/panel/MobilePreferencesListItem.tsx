import * as React from 'react';

import { ListItem, ListItemButton, ListItemDecorator } from '@mui/joy';
import SettingsIcon from '@mui/icons-material/Settings';

import { DarkModeToggleButton } from '~/common/components/DarkModeToggleButton';

import { optimaClosePanel, optimaOpenPreferences } from '../useOptima';


export function MobilePreferencesListItem(props: { autoClosePanel?: boolean }) {

  const handleShowPreferences = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    optimaOpenPreferences();
    if (props.autoClosePanel)
      optimaClosePanel();
  }, [props.autoClosePanel]);

  return (
    <ListItem endAction={<DarkModeToggleButton />}>
      <ListItemButton onClick={handleShowPreferences}>
        <ListItemDecorator><SettingsIcon /></ListItemDecorator>
        Preferences{/*<KeyStroke combo='Ctrl + ,' />*/}
      </ListItemButton>
    </ListItem>
  );
}
