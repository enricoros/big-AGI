import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, ButtonGroup, Divider, FormControl, Input, Switch, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { DLLMId, useModelsStore } from '~/modules/llms/store-llms';
import { findVendorById } from '~/modules/llms/vendors/vendor.registry';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/GoodModal';
import { closeLayoutLLMOptions } from '~/common/layout/store-applayout';
import { settingsGap } from '~/common/app.theme';


function VendorLLMOptions(props: { llmId: DLLMId }) {
  // get LLM (warning: this will refresh all children components on every change of any LLM field)
  const llm = useModelsStore(state => state.llms.find(llm => llm.id === props.llmId), shallow);
  if (!llm)
    return 'Options issue: LLM not found for id ' + props.llmId;

  // get vendor
  const vendor = findVendorById(llm._source.vId);
  if (!vendor)
    return 'Options issue: Vendor not found for LLM ' + props.llmId + ', source ' + llm._source.id;

  return <vendor.LLMOptionsComponent llm={llm} />;
}


export function LLMOptionsModal(props: { id: DLLMId }) {

  // state
  const [showDetails, setShowDetails] = React.useState(false);

  // external state
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
    closeLayoutLLMOptions();
  };

  return (

    <GoodModal
      title={<><b>{llm.label}</b> options</>}
      open={!!props.id} onClose={closeLayoutLLMOptions}
      startButton={
        <Button variant='plain' color='neutral' onClick={handleLlmDelete} startDecorator={<DeleteOutlineIcon />}>
          Delete
        </Button>
      }
    >

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>
        <VendorLLMOptions llmId={props.id} />
      </Box>

      <Divider />

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Name' sx={{ minWidth: 80 }} />
        <Input variant='outlined' value={llm.label} onChange={handleLlmLabelSet} />
      </FormControl>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Defaults' sx={{ minWidth: 80 }} />
        <ButtonGroup orientation='horizontal' size='sm' variant='outlined'>
          <Button variant={isChatLLM ? 'solid' : undefined} onClick={() => setChatLLMId(isChatLLM ? null : props.id)}>Chat</Button>
          <Button variant={isFastLLM ? 'solid' : undefined} onClick={() => setFastLLMId(isFastLLM ? null : props.id)}>Fast</Button>
          <Button variant={isFuncLLM ? 'solid' : undefined} onClick={() => setFuncLLMId(isFuncLLM ? null : props.id)}>Func</Button>
        </ButtonGroup>
      </FormControl>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Visible' sx={{ minWidth: 80 }} />
        <Switch checked={!llm.hidden} onChange={handleLlmVisibilityToggle}
                endDecorator={!llm.hidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
                sx={{ ml: 0, mr: 'auto' }} />
      </FormControl>

      {/*<FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>*/}
      {/* <FormLabelStart title='Flags' sx={{ minWidth: 80 }} /> >*/}
      {/*  <Checkbox color='neutral' checked={llm.tags?.includes('chat')} readOnly disabled label='Chat' sx={{ ml: 4 }} />*/}
      {/*  <Checkbox color='neutral' checked={llm.tags?.includes('stream')} readOnly disabled label='Stream' sx={{ ml: 4 }} />*/}
      {/*</FormControl>*/}

      <FormControl orientation='horizontal' sx={{ flexWrap: 'nowrap' }}>
        <FormLabelStart title='Details' sx={{ minWidth: 80 }} onClick={() => setShowDetails(!showDetails)} />
        {showDetails && <Typography level='body-sm' sx={{ display: 'block' }}>
          [{llm.id}]: {llm.options.llmRef && `${llm.options.llmRef} · `}
          {llm.contextTokens && `context tokens: ${llm.contextTokens.toLocaleString()} · `}
          {llm.maxOutputTokens && `max output tokens: ${llm.maxOutputTokens.toLocaleString()} · `}
          {llm.created && `created: ${(new Date(llm.created * 1000)).toLocaleString()} · `}
          description: {llm.description}
          {/*· tags: {llm.tags.join(', ')}*/}
        </Typography>}
      </FormControl>

    </GoodModal>

  );
}