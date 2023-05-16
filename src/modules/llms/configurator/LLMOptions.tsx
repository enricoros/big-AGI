import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Divider, FormControl, FormLabel, IconButton, Switch } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { GoodModal } from '~/common/components/GoodModal';
import { useUIStore } from '~/common/state/store-ui';

import { DLLMId } from '../llm.types';
import { VendorLLMOptions } from './VendorLLMOptions';
import { useModelsStore } from '../llm.store';


export function LLMOptions(props: { id: DLLMId }) {

  // external state
  const closeLLMOptions = useUIStore(state => state.closeLLMOptions);
  const { llm, removeLLM, updateLLM } = useModelsStore(state => ({
    llm: state.llms.find(llm => llm.id === props.id),
    removeLLM: state.removeLLM,
    updateLLM: state.updateLLM,
  }), shallow);

  if (!llm)
    return <>Options issue: LLM not found for id {props.id}</>;

  const handleLlmVisibilityToggle = () => updateLLM(llm.id, { hidden: !llm.hidden });

  const handleLlmDelete = () => {
    removeLLM(llm.id);
    closeLLMOptions();
  };

  return (

    <GoodModal title={`${llm.label} Options`} open={!!props.id} onClose={closeLLMOptions}>

      <VendorLLMOptions id={props.id} />

      <Divider />

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap' }}>
        <FormLabel sx={{ minWidth: 80 }}>
          Visibility
        </FormLabel>
        <Switch checked={!llm.hidden} onChange={handleLlmVisibilityToggle}
                endDecorator={!llm.hidden ? 'Show' : 'Hide'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </FormControl>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap' }}>
        <FormLabel sx={{ minWidth: 80 }}>
          Delete
        </FormLabel>
        <IconButton variant='plain' color='neutral' onClick={handleLlmDelete}>
          <DeleteOutlineIcon />
        </IconButton>
      </FormControl>

    </GoodModal>

  );
}