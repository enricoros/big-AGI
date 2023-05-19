import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Button, Divider, FormControl, FormLabel, Input, Switch, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { GoodModal } from '~/common/components/GoodModal';
import { useUIStateStore } from '~/common/state/store-ui';

import { DLLMId } from '../llm.types';
import { VendorLLMOptions } from './VendorLLMOptions';
import { useModelsStore } from '../store-llms';


export function LLMOptions(props: { id: DLLMId }) {

  // external state
  const closeLLMOptions = useUIStateStore(state => state.closeLLMOptions);
  const { llm, removeLLM, updateLLM } = useModelsStore(state => ({
    llm: state.llms.find(llm => llm.id === props.id),
    removeLLM: state.removeLLM,
    updateLLM: state.updateLLM,
  }), shallow);

  if (!llm)
    return <>Options issue: LLM not found for id {props.id}</>;


  const handleLlmLabelSet = (event: React.ChangeEvent<HTMLInputElement>) => updateLLM(llm.id, { label: event.target.value || '' });

  const handleLlmVisibilityToggle = () => updateLLM(llm.id, { hidden: !llm.hidden });

  const handleLlmDelete = () => {
    removeLLM(llm.id);
    closeLLMOptions();
  };

  return (

    <GoodModal
      title={<><b>{llm.label}</b> options</>}
      open={!!props.id} onClose={closeLLMOptions}
      startButton={
        <Button variant='plain' color='neutral' onClick={handleLlmDelete} startDecorator={<DeleteOutlineIcon />}>
          Delete
        </Button>
      }
    >

      <VendorLLMOptions id={props.id} />

      <Divider />

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap' }}>
        <FormLabel sx={{ minWidth: 80 }}>
          Name
        </FormLabel>
        <Input variant='outlined' value={llm.label} onChange={handleLlmLabelSet} />
      </FormControl>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabel sx={{ minWidth: 80 }}>
          Visibility
        </FormLabel>
        <Switch checked={!llm.hidden} onChange={handleLlmVisibilityToggle}
                endDecorator={!llm.hidden ? 'Show' : 'Hide'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
        {/*<Checkbox color='neutral' checked={llm.tags?.includes('chat')} readOnly disabled label='Chat' sx={{ ml: 4 }} />*/}
        {/*<Checkbox color='neutral' checked={llm.tags?.includes('stream')} readOnly disabled label='Stream' sx={{ ml: 4 }} />*/}
      </FormControl>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'nowrap' }}>
        <FormLabel sx={{ minWidth: 80 }}>
          Info
        </FormLabel>
        <Typography level='body2' sx={{ display: 'block' }}>
          [{llm.id}]: {llm.options.llmRef && `id: ${llm.options.llmRef} · `} context tokens: {llm.contextTokens} · {
          llm.created && `created: ${(new Date(llm.created * 1000)).toLocaleString()}`} · description: {llm.description} · tags: {llm.tags.join(', ')}
        </Typography>
      </FormControl>

    </GoodModal>

  );
}