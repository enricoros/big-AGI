import * as React from 'react';

import { Box, IconButton, ListItemButton, ListItemDecorator } from '@mui/joy';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SettingsIcon from '@mui/icons-material/Settings';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { DLLM, DLLMId, getLLMLabel, isLLMVisible } from '~/common/stores/llms/llms.types';
import { DebouncedInputMemo } from '~/common/components/DebouncedInput';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';
import { OptimaBarControlMethods, OptimaBarDropdownMemo, OptimaDropdownItems } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { findModelsServiceOrNull } from '~/common/stores/llms/store-llms';
import { isDeepEqual } from '~/common/util/hooks/useDeep';
import { sortLLMsByServiceLabel } from '~/common/stores/llms/components/llms.dropdown.utils';
import { optimaActions, optimaOpenModels } from '~/common/layout/optima/useOptima';
import { useAllLLMs } from '~/common/stores/llms/hooks/useAllLLMs';
import { setPrimaryChatModelId, useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';
import { useUIComplexityMode } from '~/common/stores/store-ui';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useConversationModelBinding } from '~/common/stores/chat/hooks/useConversationModelBinding';


function LLMDropdown(props: {
  dropdownRef: React.Ref<OptimaBarControlMethods>,
  llms: ReadonlyArray<DLLM>,
  chatLlmId: undefined | DLLMId | null,
  setChatLlmId: (llmId: DLLMId) => void,
  placeholder?: string,
  isPinned?: boolean, // the active model is pinned to the focused conversation
  onTogglePin?: () => void, // pin the active model to the focused conversation / revert to following the app default
}) {

  // state
  const [filterString, setfilterString] = React.useState<string | null>(null);

  // external state
  const uiComplexityMode = useUIComplexityMode();
  const showSymbols = uiComplexityMode !== 'minimal';

  // derived state
  const { chatLlmId, llms, setChatLlmId, isPinned, onTogglePin } = props;

  const llmsCount = llms.filter(isLLMVisible).length;
  const showFilter = llmsCount >= 50;

  const handleChatLLMChange = React.useCallback((value: DLLMId | null) => {
    value && setChatLlmId(value);
  }, [setChatLlmId]);

  const handleOpenLLMOptions = React.useCallback(() => {
    return chatLlmId && optimaActions().openModelOptions(chatLlmId);
  }, [chatLlmId]);


  // dropdown items - cached
  const stabilizeLlmOptions = React.useRef<OptimaDropdownItems>(undefined);

  const llmDropdownItems: OptimaDropdownItems = React.useMemo(() => {
    const llmItems: OptimaDropdownItems = {};
    let prevServiceId: DModelsServiceId | null = null;
    let sepCount = 0;

    const lcFilterString = filterString?.toLowerCase();
    const filteredLLMs = llms.filter(llm => {
      if (chatLlmId && llm.id === chatLlmId)
        return true;

      // filter-out models that don't contain the search string
      if (lcFilterString && !getLLMLabel(llm).toLowerCase().includes(lcFilterString))
        return false;

      // filter-out hidden models from the dropdown
      return lcFilterString ? true : isLLMVisible(llm);
    });

    // sort by service label so vendor groups appear alphabetically (groups remain contiguous because sort is stable on equal keys)
    const sortedLLMs = sortLLMsByServiceLabel(filteredLLMs);

    for (const llm of sortedLLMs) {
      // add separators when changing services
      if (!prevServiceId || llm.sId !== prevServiceId) {
        const vendor = findModelVendor(llm.vId);
        const serviceLabel = findModelsServiceOrNull(llm.sId)?.label || vendor?.name || llm.sId;
        llmItems[`sep-${llm.sId}`] = {
          type: 'separator',
          title: serviceLabel,
          // NOTE: commenting because not useful, and creates a recursive issue in isDeepEqual - not needed, so kthxbye
          // icon: vendor?.Icon ? <vendor.Icon /> : undefined,
        };
        prevServiceId = llm.sId;
        sepCount++;
      }

      // add the model item - prefix the active item with a pin when bound to the focused conversation
      const _isPinnedActive = isPinned && llm.id === chatLlmId;
      llmItems[llm.id] = {
        title: (_isPinnedActive ? '📌 ' : '') + getLLMLabel(llm),
        ...(llm.userStarred ? { symbol: '⭐' } : {}),
        // icon: llm.id.startsWith('some vendor') ? <VendorIcon /> : undefined,
      };
    }

    // if there's a single separator (i.e. only one source), remove it
    if (sepCount === 1) {
      for (const key in llmItems) {
        if (key.startsWith('sep-')) {
          delete llmItems[key];
          break;
        }
      }
    }

    // stabilize the items: reuse the full array if nothing changed
    const prev = stabilizeLlmOptions.current;
    if (prev && isDeepEqual(prev, llmItems)) return prev;

    // otherwise update the cache and return the new items
    return stabilizeLlmOptions.current = llmItems;
  }, [chatLlmId, isPinned, llms, filterString]);


  // "Model Options" button (only on the active item)
  const llmDropdownButton = React.useMemo(() => (
    <GoodTooltip title={
      <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
        Model Options
        <KeyStroke variant='outlined' combo='Ctrl + Shift + O' sx={{ my: 0.5 }} />
      </Box>
    }>
      <IconButton
        variant='outlined' color='neutral'
        onClick={handleOpenLLMOptions}
        sx={{
          ml: 'auto',
          // mr: -0.5,
          my: '-0.25rem' /* absorb the menuItem padding */,
          backgroundColor: 'background.surface',
          boxShadow: 'xs',
        }}
      >
        <SettingsIcon sx={{ fontSize: 'xl' }} />
      </IconButton>
    </GoodTooltip>
  ), [handleOpenLLMOptions]);


  // "Models Filter" box
  const llmDropdownPrependOptions = React.useMemo(() =>
    !showFilter ? undefined : (
      <Box sx={{ p: 1 }}>
        <DebouncedInputMemo
          retainFocus
          debounceTimeout={300}
          onDebounce={setfilterString}
          placeholder={`Search ${llmsCount} models...`}
        />
      </Box>
    ), [showFilter, llmsCount]);

  // [effect] clear filter when the active model changes
  // Note: this doesn't work because the debounced component holds the filter string
  // React.useEffect(() => {
  //   if (chatLlmId) {
  //     setsearchQuery(null);
  //     console.log('cleared');
  //   }
  // }, [chatLlmId]);


  // Zero State - no models available
  const hasDropdownOptions = Object.keys(llmDropdownItems || {}).length > 0;

  // "Models Setup" button
  const llmDropdownAppendOptions = React.useMemo(() => <>

    {/* Pin to this chat / Follow default - per-conversation model binding */}
    {!!onTogglePin && !!chatLlmId && (
      <ListItemButton key='menu-pin' onClick={onTogglePin} sx={{ backgroundColor: 'background.surface', py: 'calc(2 * var(--ListDivider-gap))' }}>
        <ListItemDecorator>{isPinned ? <PushPinIcon color='primary' /> : <PushPinOutlinedIcon />}</ListItemDecorator>
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
          {isPinned ? 'Unpin · follow app default' : 'Pin model to this chat'}
        </Box>
      </ListItemButton>
    )}

    {/*{chatLlmId && (*/}
    {/*  <ListItemButton key='menu-opt' onClick={handleOpenLLMOptions}>*/}
    {/*    <ListItemDecorator><SettingsIcon color='success' /></ListItemDecorator>*/}
    {/*    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>*/}
    {/*      Options*/}
    {/*      <KeyStroke combo='Ctrl + Shift + O' />*/}
    {/*    </Box>*/}
    {/*  </ListItemButton>*/}
    {/*)}*/}

    <ListItemButton key='menu-llms' onClick={optimaOpenModels} sx={{ backgroundColor: 'background.surface', py: 'calc(2 * var(--ListDivider-gap))' }}>
      <ListItemDecorator>{!hasDropdownOptions ? '⚠️' : <BuildCircleIcon color='success' />}</ListItemDecorator>
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
        {!hasDropdownOptions ? 'Add Models' : 'Models'}
        {/*<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>*/}
        {/*  <KeyStroke variant='outlined' size='sm' combo='Ctrl + Shift + M' sx={{ ml: 2, bgcolor: 'background.popup' }} />*/}
        <ArrowForwardRoundedIcon sx={{ ml: 'auto', fontSize: 'xl' }} />
        {/*</Box>*/}
      </Box>
    </ListItemButton>

  </>, [chatLlmId, hasDropdownOptions, isPinned, onTogglePin]);


  return (
    <OptimaBarDropdownMemo
      ref={props.dropdownRef}
      items={llmDropdownItems}
      value={chatLlmId}
      onChange={handleChatLLMChange}
      placeholder={props.placeholder || '⚠️ Models …'}
      prependOption={llmDropdownPrependOptions}
      appendOption={llmDropdownAppendOptions}
      activeEndDecorator={llmDropdownButton}
      showSymbols={showSymbols ? 'compact' : false}
    />
  );
}


export function useChatLLMDropdown(dropdownRef: React.Ref<OptimaBarControlMethods>, pinConversationId: DConversationId | null = null) {

  // external state
  const llms = useAllLLMs();
  const { domainModelId: chatLLMId } = useModelDomain('primaryChat');
  const { isPinned, boundLlmId } = useConversationModelBinding(pinConversationId);

  // Option A semantics: when the conversation is pinned, the selector edits the pin;
  // otherwise it keeps writing the app-level 'primaryChat' default (unchanged behavior)
  const activeLlmId = isPinned ? boundLlmId : chatLLMId;

  const handleSetLlmId = React.useCallback((llmId: DLLMId) => {
    if (isPinned && pinConversationId)
      useChatStore.getState().setUserLlmId(pinConversationId, llmId);
    else
      setPrimaryChatModelId(llmId);
  }, [isPinned, pinConversationId]);

  const handleTogglePin = React.useCallback(() => {
    if (!pinConversationId) return;
    // pin the currently-active model, or revert to following the app default
    useChatStore.getState().setUserLlmId(pinConversationId, isPinned ? null : (activeLlmId ?? null));
  }, [activeLlmId, isPinned, pinConversationId]);

  const chatLLMDropdown = React.useMemo(() => {
    return <LLMDropdown
      dropdownRef={dropdownRef} llms={llms}
      chatLlmId={activeLlmId} setChatLlmId={handleSetLlmId}
      isPinned={isPinned} onTogglePin={pinConversationId ? handleTogglePin : undefined}
    />;
  }, [activeLlmId, dropdownRef, handleSetLlmId, handleTogglePin, isPinned, llms, pinConversationId]);

  return { chatLLMId: activeLlmId, chatLLMDropdown };
}

/*export function useTempLLMDropdown(props: { initialLlmId: DLLMId | null }) {
  // local state
  const [llmId, setLlmId] = React.useState<DLLMId | null>(props.initialLlmId);

  // external state
  const llms = useModelsStore(state => state.llms);

  const chatLLMDropdown = React.useMemo(
    () => <LLMDropdown llms={llms} llmId={llmId} setLlmId={setLlmId} />,
    [llms, llmId, setLlmId],
  );

  return { llmId, chatLLMDropdown };
}*/