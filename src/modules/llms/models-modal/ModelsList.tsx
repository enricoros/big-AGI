import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, IconButton, List, ListItem, ListItemButton, Typography } from '@mui/joy';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SdCardOutlinedIcon from '@mui/icons-material/SdCardOutlined';
import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { DLLM, DLLMId, LLM_IF_ANT_PromptCaching, LLM_IF_GEM_CodeExecution, LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Realtime, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { findModelsServiceOrNull, llmsStoreActions } from '~/common/stores/llms/store-llms';
import { useDefaultLLMIDs, useFilteredLLMs } from '~/common/stores/llms/llms.hooks';

import type { IModelVendor } from '../vendors/IModelVendor';
import { findModelVendor } from '../vendors/vendors.registry';
import { useIsMobile } from '~/common/components/useMatchMedia';


// configuration
const SHOW_LLM_INTERFACES = false;


const absorbListPadding: SxProps = { my: 'calc(var(--ListItem-paddingY) / -2)' };

function ModelItem(props: {
  llm: DLLM,
  serviceLabel: string,
  vendor: IModelVendor,
  chipChat: boolean,
  chipFast: boolean,
  onModelClicked: (llmId: DLLMId) => void,
  onModelSetHidden: (llmId: DLLMId, hidden: boolean) => void,
}) {

  // derived
  const { llm, onModelClicked, onModelSetHidden } = props;

  const handleLLMConfigure = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (event.shiftKey) {
      console.log('llm', llm);
      return;
    }
    onModelClicked(llm.id);
  }, [llm, onModelClicked]);

  const handleLLMHide = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onModelSetHidden(llm.id, true);
  }, [llm.id, onModelSetHidden]);

  const handleLLMUnhide = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onModelSetHidden(llm.id, false);
  }, [llm.id, onModelSetHidden]);


  // label will be of the form "Model Name (Date)" - here we extract the date
  const label = llm.label;
  // const dateMatch = _label.match(/^(.*?)\s*\(([^)]+)\)$/);
  // const labelWithoutDate = dateMatch ? dateMatch[1].trim() : _label;
  // const labelDate = dateMatch ? dateMatch[2] : '';

  let tooltip = props.serviceLabel;
  if (llm.description)
    tooltip += ' · ' + llm.description;
  if (llm.contextTokens) {
    tooltip += '\n\n' + llm.contextTokens.toLocaleString() + ' tokens';
    if (llm.maxOutputTokens)
      tooltip += ' / ' + llm.maxOutputTokens.toLocaleString() + ' max output tokens';
  } else
    tooltip += ' · token count not provided';
  if (llm.pricing?.chat?._isFree)
    tooltip += '\n\n🎁 Free model - refresh to check for pricing updates';

  const chipsComponentsMemo = React.useMemo(() => {
    if (!SHOW_LLM_INTERFACES)
      return null;
    return llm.interfaces.map((iface, i) => {
      switch (iface) {
        case LLM_IF_OAI_Chat:
          return <Chip key={i} size='sm' variant={props.chipChat ? 'solid' : 'plain'} sx={{ boxShadow: 'xs' }}><TextsmsOutlinedIcon /></Chip>;
        case LLM_IF_OAI_Vision:
          return <Chip key={i} size='sm' variant='plain' sx={{ boxShadow: 'xs' }}><VisibilityOutlinedIcon />️</Chip>;
        case LLM_IF_OAI_Reasoning:
          return <Chip key={i} size='sm' variant='plain' sx={{ boxShadow: 'xs' }}><PsychologyOutlinedIcon /></Chip>;
        case LLM_IF_ANT_PromptCaching:
        case LLM_IF_OAI_PromptCaching:
          return <Chip key={i} size='sm' variant='plain' sx={{ boxShadow: 'xs' }}><SdCardOutlinedIcon /></Chip>;
        // Ignored
        case LLM_IF_OAI_Json:
        case LLM_IF_OAI_Fn:
        case LLM_IF_OAI_Complete:
        case LLM_IF_OAI_Realtime:
        case LLM_IF_GEM_CodeExecution:
          return null;
      }
    }).reverse();
  }, [llm.interfaces, props.chipChat]);

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
          <Box sx={{
            flex: 1,
            color: llm.hidden ? 'neutral.plainDisabledColor' : 'text.primary',
            wordBreak: 'break-all',
          }}>
            {label}
            {/*{labelWithoutDate}{labelDate && <Box component='span' sx={{ typography: 'body-sm',color: llm.hidden ? 'neutral.plainDisabledColor' : undefined  }}> · ({labelDate})</Box>}*/}
          </Box>
        </GoodTooltip>

        {/* Chips */}
        {SHOW_LLM_INTERFACES ? (chipsComponentsMemo && (
          <Box sx={{
            mr: 2,
            display: 'flex', gap: 0.5,
            // the following line is to absorb the padding of the list item
            // my: 'calc(var(--ListItem-paddingY) / -2)',
          }}>
            {chipsComponentsMemo}
          </Box>
        )) : <>
          {props.chipChat && <Chip size='sm' variant='plain' sx={{ boxShadow: 'sm' }}>chat</Chip>}
          {props.chipFast && <Chip size='sm' variant='plain' sx={{ boxShadow: 'sm' }}>fast</Chip>}
        </>}

        {/* Action Buttons */}

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
  filterServiceId: DModelsServiceId | null,
  onOpenLLMOptions: (id: DLLMId) => void,
  sx?: SxProps,
}) {

  // external state
  const isMobile = useIsMobile();
  const { chatLLMId, fastLLMId } = useDefaultLLMIDs();
  const llms = useFilteredLLMs(props.filterServiceId === null ? false : props.filterServiceId);

  const { onOpenLLMOptions } = props;

  const handleModelClicked = React.useCallback((llmId: DLLMId) => onOpenLLMOptions(llmId), [onOpenLLMOptions]);

  const handleModelSetHidden = React.useCallback((llmId: DLLMId, hidden: boolean) => llmsStoreActions().updateLLM(llmId, { hidden }), []);


  // are we showing multiple services
  const showAllServices = !props.filterServiceId;
  const hasManyServices = llms.length >= 2 && llms.some(llm => llm.sId !== llms[0].sId);
  let lastGroupLabel = '';

  // generate the list items, prepending headers when necessary
  const items: React.JSX.Element[] = [];
  for (const llm of llms) {

    // get the service label
    const serviceLabel = findModelsServiceOrNull(llm.sId)?.label ?? llm.sId;

    // prepend label when switching services
    if ((hasManyServices || showAllServices) && serviceLabel !== lastGroupLabel) {
      items.push(
        <ListItem key={'lab-' + llm.sId} sx={{ justifyContent: 'center' }}>
          <Typography>
            {serviceLabel}
          </Typography>
        </ListItem>,
      );
      lastGroupLabel = serviceLabel;
    }

    // for safety, ensure the vendor exists
    const vendor = findModelVendor(llm.vId);
    !!vendor && items.push(
      <ModelItem
        key={'llm-' + llm.id}
        llm={llm}
        serviceLabel={serviceLabel}
        vendor={vendor}
        chipChat={llm.id === chatLLMId}
        chipFast={llm.id === fastLLMId}
        onModelClicked={handleModelClicked}
        onModelSetHidden={handleModelSetHidden}
      />,
    );
  }

  return (
    <List size={!isMobile ? undefined : 'sm'} variant='outlined' sx={props.sx}>
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