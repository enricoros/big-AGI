import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Dropdown, IconButton, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';

import { useModuleBeamStore } from '../store-module-beam';


export function BeamGatherDropdown() {

  // external (persisted) state
  const {
    gatherShowPrompts,
    toggleGatherShowPrompts,
  } = useModuleBeamStore(useShallow(state => ({
    gatherShowPrompts: state.gatherShowPrompts,
    toggleGatherShowPrompts: state.toggleGatherShowPrompts,
  })));

  return (
    <Dropdown>
      <MenuButton
        aria-label='Merge Options'
        slots={{ root: IconButton }}
        slotProps={{ root: { size: 'sm', sx: { my: -0.5 /* to not disrupt the layouting */ } } }}
      >
        <MoreHorizRoundedIcon />
      </MenuButton>
      <Menu placement='right-end' sx={{ minWidth: 250, zIndex: 'var(--joy-zIndex-modal)' /* on top of its own modal in FS */ }}>
        <ListItem>
          <Typography level='body-sm'>Advanced</Typography>
        </ListItem>
        <MenuItem onClick={toggleGatherShowPrompts}>
          <ListItemDecorator>{gatherShowPrompts && <CheckRoundedIcon />}</ListItemDecorator>
          Show All Prompts
        </MenuItem>
      </Menu>
    </Dropdown>
  );
}