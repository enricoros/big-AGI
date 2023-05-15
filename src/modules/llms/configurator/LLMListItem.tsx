import * as React from 'react';

import { Box, IconButton, ListItem, ListItemButton, ListItemContent, Tooltip, Typography } from '@mui/joy';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { DLLM, ModelVendor } from '../llm.types';
import { useUIStore } from '~/common/state/store-ui';


export function LLMListItem(props: { llm: DLLM, vendor: ModelVendor }) {

  // external state
  const openLLMSetup = useUIStore(state => state.openLLMSetup);

  // derived
  const llm = props.llm;
  const label = llm.label;
  const tooltip = `${llm._source.label} - ${llm.description}`;

  return (
    <ListItem>
      <ListItemButton onClick={() => openLLMSetup(llm.id)}>

        {/* Model Name */}
        <ListItemContent>
          <Tooltip title={tooltip}>
            <Typography sx={{ display: 'inline' }}>
              {label}
            </Typography>
          </Tooltip>
        </ListItemContent>

        {/* 'Actions' (only click -> configure in reality) */}
        <Box sx={{ ml: 'auto', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          {llm.hidden && <IconButton disabled variant='plain' color='neutral'>
            <VisibilityOffOutlinedIcon />
          </IconButton>}
          <IconButton variant='plain' color='neutral'>
            <SettingsOutlinedIcon />
          </IconButton>
        </Box>

      </ListItemButton>
    </ListItem>
  );
}