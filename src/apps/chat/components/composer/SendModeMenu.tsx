import * as React from 'react';

import { Box, ListDivider, Menu, MenuItem, Radio, Typography } from '@mui/joy';

import { SendModeId } from '../../Chat';


/// SendMode(s) definition

type SendModeData = {
  label: string;
  description: string | React.JSX.Element;
}

const SendModeItems: { [key in SendModeId]: SendModeData } = {
  'immediate': {
    label: 'Chat',
    description: 'AI-powered direct responses',
  },
  'react': {
    label: 'Reason+Act',
    description: 'Answer your questions with ReAct and search',
  },
};


export const SendModeMenu = (props: { anchorEl: HTMLAnchorElement, sendMode: SendModeId, onSetSendMode: (sendMode: SendModeId) => void, onClose: () => void, }) =>
  <Menu
    variant='plain' color='neutral' size='md' placement='top-end' sx={{ minWidth: 320, overflow: 'auto' }}
    open anchorEl={props.anchorEl} onClose={props.onClose}>

    <MenuItem color='neutral' selected>Conversation Mode</MenuItem>

    <ListDivider />

    {Object.entries(SendModeItems).map(([key, data]) =>
      <MenuItem key={'send-mode-' + key} onClick={() => props.onSetSendMode(key as SendModeId)}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Radio checked={key === props.sendMode} />
          <Box>
            <Typography>{data.label}</Typography>
            <Typography level='body2'>{data.description}</Typography>
          </Box>
        </Box>
      </MenuItem>)}

  </Menu>;