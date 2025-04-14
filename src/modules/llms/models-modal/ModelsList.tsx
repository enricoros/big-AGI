import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, IconButton, List, ListItem, ListItemButton, Typography } from '@mui/joy';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import SdCardOutlinedIcon from '@mui/icons-material/SdCardOutlined';
import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { DLLM, DLLMId, LLM_IF_ANT_PromptCaching, LLM_IF_GEM_CodeExecution, LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Realtime, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Image, LLM_IF_Tools_WebSearch } from '~/common/stores/llms/llms.types';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { PhGearSixIcon } from '~/common/components/icons/phosphor/PhGearSixIcon';
import { findModelsServiceOrNull, llmsStoreActions } from '~/common/stores/llms/store-llms';
import { useLLMsByService } from '~/common/stores/llms/llms.hooks';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useModelDomains } from '~/common/stores/llms/hooks/useModelDomains';

import type { IModelVendor } from '../vendors/IModelVendor';
import { findModelVendor } from '../vendors/vendors.registry';


// configuration
const SHOW_LLM_INTERFACES = false;


const absorbListPadding: SxProps = { my: 'calc(var(--ListItem-paddingY) / -2)' };

const styles = {
  liButton: {
    border: 'none',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: {
      xs: 0.5,
      md: 1,
    } as const,
  } as const,
  modelText: {
    flex: 1,
    wordBreak: 'break-all',
  } as const,
  modelHiddenText: {
    flex: 1,
    wordBreak: 'break-all',
    color: 'neutral.plainDisabledColor',
  } as const,
  chipPreferred: {
    // boxShadow: 'sm',
  } as const,
  chipFree: {
    // boxShadow: 'sm',
    boxShadow: 'md',
  } as const,
  chipCapability: {
    // boxShadow: 'sm',
    boxShadow: 'md',
  } as const,
  // styleNameChip: {
  //   marginLeft: '0.5rem',
  //   fontSize: '0.75rem',
  // } as const,
} as const;


function ModelItem(props: {
  llm: DLLM,
  serviceLabel: string,
  vendor: IModelVendor,
  chipChat: boolean,
  chipCode: boolean,
  chipFast: boolean,
  isMobile: boolean,
  onModelClicked: (llmId: DLLMId) => void,
  onModelSetHidden: (llmId: DLLMId, hidden: boolean) => void,
  onModelSetStarred: (llmId: DLLMId, starred: boolean) => void,
}) {

  // derived
  const { llm, onModelClicked, onModelSetHidden /*, onModelSetStarred*/ } = props;

  const seemsFree = !!llm.pricing?.chat?._isFree;
  const isNotSymlink = !llm.label.startsWith('🔗');


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

  // const handleLLMToggleStar = React.useCallback((event: React.MouseEvent) => {
  //   event.stopPropagation();
  //   onModelSetStarred(llm.id, !llm.userStarred);
  // }, [llm.id, llm.userStarred, onModelSetStarred]);


  // label will be of the form "Model Name (Date)" - here we extract the date
  // const label = llm.label;
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
  if (seemsFree)
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
        // color={(seemsFree && !llm.hidden) ? 'success' : undefined}
        // variant={(seemsFree && !llm.hidden) ? 'soft' : undefined}
        onClick={handleLLMConfigure}
        tabIndex={-1}
        sx={styles.liButton}
      >

        {/* Model Name */}
        <GoodTooltip title={tooltip}>
          <Box sx={llm.hidden ? styles.modelHiddenText : styles.modelText} className='agi-ellipsize'>
            {(/*props.isMobile &&*/ llm.userStarred) ? `⭐ ${llm.label}` : llm.label}
            {/*{labelWithoutDate}{labelDate && <Box component='span' sx={{ typography: 'body-sm',color: llm.hidden ? 'neutral.plainDisabledColor' : undefined  }}> · ({labelDate})</Box>}*/}
            {/*{llm.interfaces.includes(LLM_IF_OAI_Reasoning) && <span style={styles.styleNameChip}>🧠</span>}*/}
          </Box>
        </GoodTooltip>

        {/* Preferred Chips */}
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
          {props.chipChat && <Chip size='sm' variant='solid' sx={styles.chipPreferred}>chat</Chip>}
          {props.chipCode && <Chip size='sm' variant='solid' sx={styles.chipPreferred}>code</Chip>}
          {props.chipFast && <Chip size='sm' variant='solid' sx={styles.chipPreferred}>util</Chip>}
        </>}

        {/* Features Chips */}
        {llm.interfaces.includes(LLM_IF_OAI_Reasoning) && isNotSymlink && <Chip size='sm' variant='plain' sx={styles.chipCapability}>🧠</Chip>}
        {llm.interfaces.includes(LLM_IF_Tools_WebSearch) && isNotSymlink && <Chip size='sm' variant='plain' sx={styles.chipCapability}>🌐</Chip>}
        {llm.interfaces.includes(LLM_IF_Outputs_Image) && isNotSymlink && <Chip size='sm' variant='plain' sx={styles.chipCapability}>🖼️</Chip>}
        {seemsFree && isNotSymlink && <Chip size='sm' color='success' variant='plain' sx={styles.chipFree}>free</Chip>}


        {/* Action Buttons */}

        <Box sx={{ display: 'flex', gap: 1 }}>

          {/*{!props.isMobile && <GoodTooltip title={llm.userStarred ? 'Unstar' : 'Star this model'}>*/}
          {/*  <IconButton size='sm' onClick={handleLLMToggleStar} sx={absorbListPadding}>*/}
          {/*    {llm.userStarred ? <StarIcon sx={{ color: '#fad857' }} /> : <StarBorderIcon sx={{ opacity: 0.5, fontSize: 'md' }} />}*/}
          {/*  </IconButton>*/}
          {/*</GoodTooltip>}*/}

          {!props.isMobile && <GoodTooltip title={llm.hidden ? 'Hidden' : 'Shown in Chat'}>
            <IconButton aria-label={llm.hidden ? 'Unhide' : 'Hide in Chat'} size='sm' onClick={llm.hidden ? handleLLMUnhide : handleLLMHide} sx={absorbListPadding}>
              {llm.hidden ? <VisibilityOffOutlinedIcon sx={{ opacity: 0.5, fontSize: 'md' }} /> : <VisibilityOutlinedIcon />}
            </IconButton>
          </GoodTooltip>}

          <GoodTooltip title='Options'>
            <IconButton aria-label='Configure LLM' size='sm' sx={absorbListPadding} onClick={handleLLMConfigure}>
              <PhGearSixIcon />
            </IconButton>
          </GoodTooltip>

        </Box>

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
  const domainAssignments = useModelDomains();
  const llms = useLLMsByService(props.filterServiceId === null ? false : props.filterServiceId);

  const { onOpenLLMOptions } = props;

  const handleModelClicked = React.useCallback((llmId: DLLMId) => onOpenLLMOptions(llmId), [onOpenLLMOptions]);

  const handleModelSetHidden = React.useCallback((llmId: DLLMId, hidden: boolean) => llmsStoreActions().updateLLM(llmId, { hidden }), []);

  const handleModelSetStarred = React.useCallback((llmId: DLLMId, starred: boolean) => llmsStoreActions().updateLLM(llmId, { userStarred: starred }), []);

  const modelItems: React.ReactNode[] = React.useMemo(() => {

    // are we showing multiple services
    const showAllServices = !props.filterServiceId;
    const hasManyServices = llms.length >= 2 && llms.some(llm => llm.sId !== llms[0].sId);
    let lastGroupLabel = '';

    // derived
    const primaryChatLlmId = domainAssignments['primaryChat']?.modelId;
    // const codeApplyLlmId = domainAssignments['codeApply']?.modelId;
    const fastUtilLlmId = domainAssignments['fastUtil']?.modelId;

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
          chipChat={llm.id === primaryChatLlmId}
          chipCode={false /* do not show the CODE chip for now, to not confuse users llm.id === codeApplyLlmId*/}
          chipFast={llm.id === fastUtilLlmId}
          isMobile={isMobile}
          onModelClicked={handleModelClicked}
          onModelSetHidden={handleModelSetHidden}
          onModelSetStarred={handleModelSetStarred}
        />,
      );
    }

    return items;
  }, [domainAssignments, handleModelClicked, handleModelSetHidden, handleModelSetStarred, isMobile, llms, props.filterServiceId]);

  return (
    <List size={!isMobile ? undefined : 'sm'} variant='outlined' sx={props.sx}>
      {modelItems.length > 0 ? modelItems : (
        <ListItem sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Typography level='body-sm'>
            Please complete the configuration and refresh the models list.
          </Typography>
          {/*<Skeleton variant='rectangular' animation={false} height={24} width={160} />*/}
          {/*<Skeleton variant='rectangular' animation={false} height={24} width={120} />*/}
          {/*<Skeleton variant='rectangular' animation={false} height={24} width={140} />*/}
        </ListItem>
      )}
    </List>
  );
}