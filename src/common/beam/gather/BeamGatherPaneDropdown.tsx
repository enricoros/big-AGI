import * as React from 'react';

import { Dropdown, IconButton, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';


export function BeamGatherDropdown(props: {
  gatherShowDevMethods: boolean,
  gatherShowPrompts: boolean,
  toggleGatherShowDevMethods: () => void,
  toggleGatherShowPrompts: () => void,
}) {
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
        <MenuItem onClick={props.toggleGatherShowPrompts}>
          <ListItemDecorator>{props.gatherShowPrompts && <CheckRoundedIcon />}</ListItemDecorator>
          Show All Prompts
        </MenuItem>
        <MenuItem onClick={props.toggleGatherShowDevMethods}>
          <ListItemDecorator>{props.gatherShowDevMethods && <CheckRoundedIcon />}</ListItemDecorator>
          Experimental Methods
        </MenuItem>
      </Menu>
    </Dropdown>
  );
}