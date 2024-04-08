import * as React from 'react';
import { shallow } from 'zustand/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Chip, IconButton, List, ListItem, ListItemButton, Typography } from '@mui/joy';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';


import { GoodTooltip } from '~/common/components/GoodTooltip';

import { DLLM, DLLMId, DModelSourceId, useModelsStore } from '../store-llms';
import { IModelVendor } from '../vendors/IModelVendor';
import { findVendorById } from '../vendors/vendors.registry';


const absorbListPadding: SxProps = { my: 'calc(var(--ListItem-paddingY) / -2)' };

function ModelItem(props: {
  llm: DLLM,
  vendor: IModelVendor,
  chipChat: boolean,
  chipFast: boolean,
  chipFunc: boolean,
  onModelClicked: (llmId: DLLMId) => void,
  onModelSetHidden: (llmId: DLLMId, hidden: boolean) => void,
}) {

  // derived
  const { llm, onModelClicked, onModelSetHidden } = props;

  const handleLLMConfigure = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onModelClicked(llm.id);
  }, [llm.id, onModelClicked]);

  const handleLLMHide = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onModelSetHidden(llm.id, true);
  }, [llm.id, onModelSetHidden]);

  const handleLLMUnhide = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onModelSetHidden(llm.id, false);
  }, [llm.id, onModelSetHidden]);


  const label = llm.label;

  let tooltip = llm._source.label;
  if (llm.description)
    tooltip += ' - ' + llm.description;
  tooltip += ' - ';
  if (llm.contextTokens) {
    tooltip += llm.contextTokens.toLocaleString() + ' tokens';
    if (llm.maxOutputTokens)
      tooltip += ' / ' + llm.maxOutputTokens.toLocaleString() + ' max output tokens';
  } else
    tooltip += 'token count not provided';

  return (
    <ListItem>
      <ListItemButton
        aria-label='Configure LLM'
        onClick={handleLLMConfigure}
        tabIndex={-1}
        sx={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 },
        }}
      >

        {/* Model Name */}
        <GoodTooltip title={tooltip}>
          <Typography sx={{
            flex: 1,
            color: llm.hidden ? 'neutral.plainDisabledColor' : 'text.primary',
            wordBreak: 'break-all',
          }}>
            {label}
          </Typography>
        </GoodTooltip>

        {/* Chips */}
        {props.chipChat && <Chip size='sm' variant='plain' sx={{ boxShadow: 'sm' }}>chat</Chip>}
        {props.chipFast && <Chip size='sm' variant='plain' sx={{ boxShadow: 'sm' }}>fast</Chip>}
        {props.chipFunc && <Chip size='sm' variant='plain' sx={{ boxShadow: 'sm' }}>𝑓n</Chip>}

        <GoodTooltip title={llm.hidden ? 'Hidden' : 'Shown in Chat'}>
          <IconButton aria-label={llm.hidden ? 'Unhide' : 'Hide in Chat'} size='sm' onClick={llm.hidden ? handleLLMUnhide : handleLLMHide} sx={absorbListPadding}>
            {llm.hidden ? <VisibilityOffOutlinedIcon sx={{ opacity: 0.5, fontSize: 'md' }} /> : <VisibilityOutlinedIcon />}
          </IconButton>
        </GoodTooltip>

        <GoodTooltip title='Options'>
          <IconButton aria-label='Configure LLM' size='sm' sx={absorbListPadding} onClick={handleLLMConfigure}>
            <SettingsOutlinedIcon />
          </IconButton>
        </GoodTooltip>

      </ListItemButton>
    </ListItem>
  );
}

export function ModelsList(props: {
  filterSourceId: DModelSourceId | null,
  onOpenLLMOptions: (id: DLLMId) => void,
  sx?: SxProps,
}) {

  // external state
  const { chatLLMId, fastLLMId, funcLLMId, llms, updateLLM } = useModelsStore(state => ({
    chatLLMId: state.chatLLMId,
    fastLLMId: state.fastLLMId,
    funcLLMId: state.funcLLMId,
    llms: state.llms.filter(llm => !props.filterSourceId || llm.sId === props.filterSourceId),
    updateLLM: state.updateLLM,
  }), (a, b) => a.chatLLMId === b.chatLLMId && a.fastLLMId === b.fastLLMId && a.funcLLMId === b.funcLLMId && shallow(a.llms, b.llms));


  const { onOpenLLMOptions } = props;

  const handleModelClicked = React.useCallback((llmId: DLLMId) => onOpenLLMOptions(llmId), [onOpenLLMOptions]);

  const handleModelSetHidden = React.useCallback((llmId: DLLMId, hidden: boolean) => updateLLM(llmId, { hidden }), [updateLLM]);


  // find out if there's more than 1 sourceLabel in the llms array
  const multiSources = llms.length >= 2 && llms.find(llm => llm._source !== llms[0]._source);
  const showAllSources = !props.filterSourceId;
  let lastGroupLabel = '';

  // generate the list items, prepending headers when necessary
  const items: React.JSX.Element[] = [];
  for (const llm of llms) {

    // prepend label if changing source
    const groupLabel = llm._source.label;
    if ((multiSources || showAllSources) && groupLabel !== lastGroupLabel) {
      lastGroupLabel = groupLabel;
      items.push(
        <ListItem key={'lab-' + llm._source.id} sx={{ justifyContent: 'center' }}>
          <Typography>
            {groupLabel}
          </Typography>
        </ListItem>,
      );
    }

    // for safety, ensure the vendor exists
    const vendor = findVendorById(llm._source.vId);
    !!vendor && items.push(
      <ModelItem
        key={'llm-' + llm.id}
        llm={llm} vendor={vendor}
        chipChat={llm.id === chatLLMId}
        chipFast={llm.id === fastLLMId}
        chipFunc={llm.id === funcLLMId}
        onModelClicked={handleModelClicked}
        onModelSetHidden={handleModelSetHidden}
      />,
    );
  }

  return (
    <List variant='outlined' sx={props.sx}>
      {items.length > 0 ? items : (
        <ListItem>
          <Typography level='body-sm'>
            Please configure the service and update the list of models.
          </Typography>
        </ListItem>
      )}
    </List>
  );
}