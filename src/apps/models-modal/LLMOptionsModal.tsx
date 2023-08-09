import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Button, ButtonGroup, Divider, FormControl, FormLabel, Input, Switch, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { DLLMId } from '~/modules/llms/llm.types';
import { useModelsStore } from '~/modules/llms/store-llms';

import { GoodModal } from '~/common/components/GoodModal';
import { useUIStateStore } from '~/common/state/store-ui';

import { VendorLLMOptions } from './VendorLLMOptions';


export function LLMOptionsModal(props: { id: DLLMId }) {

  // state
  const [showDetails, setShowDetails] = React.useState(false);

  // external state
  const closeLLMOptions = useUIStateStore(state => state.closeLLMOptions);
  const {
    llm,
    removeLLM, updateLLM,
    isChatLLM, setChatLLMId,
    isFastLLM, setFastLLMId,
    isFuncLLM, setFuncLLMId,
  } = useModelsStore(state => ({
    llm: state.llms.find(llm => llm.id === props.id),
    removeLLM: state.removeLLM,
    updateLLM: state.updateLLM,
    isChatLLM: state.chatLLMId === props.id,
    isFastLLM: state.fastLLMId === props.id,
    isFuncLLM: state.funcLLMId === props.id,
    setChatLLMId: state.setChatLLMId,
    setFastLLMId: state.setFastLLMId,
    setFuncLLMId: state.setFuncLLMId,
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
          Defaults
        </FormLabel>
        <ButtonGroup orientation='horizontal' size='sm' variant='outlined'>
          <Button variant={isChatLLM ? 'solid' : undefined} onClick={() => setChatLLMId(isChatLLM ? null : props.id)}>Chat</Button>
          <Button variant={isFastLLM ? 'solid' : undefined} onClick={() => setFastLLMId(isFastLLM ? null : props.id)}>Fast</Button>
          <Button variant={isFuncLLM ? 'solid' : undefined} onClick={() => setFuncLLMId(isFuncLLM ? null : props.id)}>Func</Button>
        </ButtonGroup>
      </FormControl>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabel sx={{ minWidth: 80 }}>
          Visible
        </FormLabel>
        <Switch checked={!llm.hidden} onChange={handleLlmVisibilityToggle}
                endDecorator={!llm.hidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
                sx={{ ml: 0, mr: 'auto' }} />
      </FormControl>

      {/*<FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>*/}
      {/*  <FormLabel sx={{ minWidth: 80 }}>*/}
      {/*    Flags*/}
      {/*  </FormLabel>*/}
      {/*  <Checkbox color='neutral' checked={llm.tags?.includes('chat')} readOnly disabled label='Chat' sx={{ ml: 4 }} />*/}
      {/*  <Checkbox color='neutral' checked={llm.tags?.includes('stream')} readOnly disabled label='Stream' sx={{ ml: 4 }} />*/}
      {/*</FormControl>*/}

      <FormControl orientation='horizontal' sx={{ flexWrap: 'nowrap' }}>
        <FormLabel onClick={() => setShowDetails(!showDetails)} sx={{ minWidth: 80, cursor: 'pointer', textDecoration: 'underline' }}>
          Details
        </FormLabel>
        {showDetails && <Typography level='body-sm' sx={{ display: 'block' }}>
          [{llm.id}]: {llm.options.llmRef && `${llm.options.llmRef} · `} context tokens: {llm.contextTokens?.toLocaleString()} · {
          llm.created && `created: ${(new Date(llm.created * 1000)).toLocaleString()}`} · description: {llm.description}
          {/*· tags: {llm.tags.join(', ')}*/}
        </Typography>}
      </FormControl>

    </GoodModal>

  );
}