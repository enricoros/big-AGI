import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Dropdown, IconButton, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';

import { useModuleBeamStore } from '../store-module-beam';


export function BeamGatherDropdown() {

  // external (persisted) state
  const {
    gatherShowDevMethods,
    gatherShowPrompts,
    toggleGatherShowDevMethods,
    toggleGatherShowPrompts,
  } = useModuleBeamStore(useShallow(state => ({
    gatherShowDevMethods: state.gatherShowDevMethods,
    gatherShowPrompts: state.gatherShowPrompts,
    toggleGatherShowDevMethods: state.toggleGatherShowDevMethods,
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
      <Menu placement='right-end' sx={{ minWidth: 250 }}>
        <ListItem>
          <Typography level='body-sm'>Advanced</Typography>
        </ListItem>
        <MenuItem onClick={toggleGatherShowPrompts}>
          <ListItemDecorator>{gatherShowPrompts && <CheckRoundedIcon />}</ListItemDecorator>
          Show All Prompts
        </MenuItem>
        <MenuItem onClick={toggleGatherShowDevMethods}>
          <ListItemDecorator>{gatherShowDevMethods && <CheckRoundedIcon />}</ListItemDecorator>
          Experimental Methods
        </MenuItem>
      </Menu>
    </Dropdown>
  );
}