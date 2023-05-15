import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, IconButton, Switch, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { settingsGap } from '~/common/theme';
import { useUIStore } from '~/common/state/store-ui';

import { DLLM } from '../llm.types';
import { useModelsStore } from '../llm.store';


export function SetupLLMCommon(props: { llm: DLLM }) {

  // external state
  const closeLLMSetup = useUIStore(state => state.closeLLMSetup);
  const { removeLLM, updateLLM } = useModelsStore(state => ({
    removeLLM: state.removeLLM,
    updateLLM: state.updateLLM,
  }), shallow);

  const handleLlmVisibilityToggle = () => updateLLM(props.llm.id, { hidden: !props.llm.hidden });

  const handleLlmDelete = () => {
    removeLLM(props.llm.id);
    closeLLMSetup();
  };

  return (

    <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: settingsGap, alignItems: 'center', justifyContent: 'space-between' }}>

      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <Typography sx={{ mr: 1 }}>
          Visible
        </Typography>
        <Switch checked={!props.llm.hidden} onChange={handleLlmVisibilityToggle} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <Typography sx={{ mr: 1 }}>
          Delete
        </Typography>
        <IconButton variant='plain' color='danger' onClick={handleLlmDelete}>
          <DeleteOutlineIcon />
        </IconButton>
      </Box>

    </Box>

  );
}