import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Chip, Divider, IconButton, Input, Option, Select, Stack, Typography } from '@mui/joy';

import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { createAssistantConversationParticipant, DConversationParticipant, DConversationTurnTerminationMode, generateAssistantParticipantName } from '~/common/stores/chat/chat.conversation';
import { isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useChatAgentGroupsStore } from '~/common/stores/chat/store-chat-agent-groups';
import { useVisibleLLMs } from '~/common/stores/llms/llms.hooks';
import { getParticipantAccentColor } from '~/common/util/dMessageUtils';

import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';
import { useFolderDropdown } from './useFolderDropdown';


export function ChatBarChat(props: {
  conversationId: DConversationId | null;
  llmDropdownRef: React.Ref<OptimaBarControlMethods>;
  personaDropdownRef: React.Ref<OptimaBarControlMethods>;
  onConversationSaveAgentGroup: (conversationId: DConversationId, name?: string, existingId?: string | null) => string | null;
}) {

  // state
  const [participantsAnchorEl, setParticipantsAnchorEl] = React.useState<HTMLElement | null>(null);
  const [agentGroupNameDraft, setAgentGroupNameDraft] = React.useState('');
  const [draftPersonaId, setDraftPersonaId] = React.useState<SystemPurposeId | ''>('');
  const [draftLlmId, setDraftLlmId] = React.useState<string>('');
  const [expandedParticipantId, setExpandedParticipantId] = React.useState<string | null>(null);
  const [draggedParticipantId, setDraggedParticipantId] = React.useState<string | null>(null);
  const [dropTargetParticipantId, setDropTargetParticipantId] = React.useState<string | null>(null);
  const [dropTargetEdge, setDropTargetEdge] = React.useState<'before' | 'after' | null>(null);
  const [participantDrafts, setParticipantDrafts] = React.useState<Record<string, {
    name: string;
    personaId: SystemPurposeId | null;
    llmId: string | null;
    customPrompt: string;
    speakWhen: DConversationParticipant['speakWhen'];
  }>>({});

  // external state
  const { chatLLMDropdown, chatLLMId } = useChatLLMDropdown(props.llmDropdownRef);
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId, props.personaDropdownRef);
  const { folderDropdown } = useFolderDropdown(props.conversationId);
  const { participants, messages, systemPurposeId, turnTerminationMode, setParticipants, setTurnTerminationMode } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(_c => _c.id === props.conversationId);
    return {
      participants: conversation?.participants ?? [],
      messages: conversation?.messages ?? [],
      systemPurposeId: conversation?.systemPurposeId ?? null,
      turnTerminationMode: conversation?.turnTerminationMode === 'continuous'
        ? 'continuous'
        : conversation?.turnTerminationMode === 'consensus'
          ? 'consensus'
          : 'round-robin-per-human',
      setParticipants: state.setParticipants,
      setTurnTerminationMode: state.setTurnTerminationMode,
    };
  }));
  const { savedAgentGroups } = useChatAgentGroupsStore(useShallow(state => ({
    savedAgentGroups: state.savedAgentGroups,
  })));
  const { llms: visibleLLMs } = useVisibleLLMs(chatLLMId ?? null, false, true);

  // derived state
  const assistantParticipants = React.useMemo(() => participants.filter(participant => participant.kind === 'assistant'), [participants]);
  const latestUserMessage = React.useMemo(() => [...messages].reverse().find(message => message.role === 'user') ?? null, [messages]);
  const latestUserMessageIndex = React.useMemo(() => {
    if (!latestUserMessage)
      return -1;
    return messages.findIndex(message => message.id === latestUserMessage.id);
  }, [latestUserMessage, messages]);
  const assistantMessagesSinceLatestUser = React.useMemo(() => {
    const messagesAfterLatestUser = latestUserMessageIndex >= 0 ? messages.slice(latestUserMessageIndex + 1) : [];
    return messagesAfterLatestUser.filter(message => message.role === 'assistant' && !!message.metadata?.author?.participantId);
  }, [latestUserMessageIndex, messages]);
  const latestAssistantMessage = React.useMemo(() => assistantMessagesSinceLatestUser.at(-1) ?? null, [assistantMessagesSinceLatestUser]);
  const participantMentionPattern = React.useCallback((participantName: string) => {
    const escapedName = participantName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\w])@${escapedName}(?=$|[^\\w])`, 'i');
  }, []);
  const wasParticipantMentionedInLatestUserTurn = React.useCallback((participant: DConversationParticipant) => {
    const participantName = participant.name?.trim() ?? '';
    const mentionRegex = participantName ? participantMentionPattern(participantName) : null;
    return !!(latestUserMessage && mentionRegex && latestUserMessage.fragments.some(fragment =>
      isTextContentFragment(fragment) && mentionRegex.test(fragment.part.text),
    ));
  }, [latestUserMessage, participantMentionPattern]);
  const runnableParticipantIds = React.useMemo(() => assistantParticipants
    .filter(participant => participant.speakWhen !== 'when-mentioned' || wasParticipantMentionedInLatestUserTurn(participant))
    .map(participant => participant.id), [assistantParticipants, wasParticipantMentionedInLatestUserTurn]);
  const spokenThisTurnParticipantIds = React.useMemo(() => new Set(assistantMessagesSinceLatestUser
    .map(message => message.metadata?.author?.participantId)
    .filter((participantId): participantId is string => !!participantId)), [assistantMessagesSinceLatestUser]);
  const nextToSpeakParticipantId = React.useMemo(() => runnableParticipantIds.find(participantId => !spokenThisTurnParticipantIds.has(participantId)) ?? null,
    [runnableParticipantIds, spokenThisTurnParticipantIds]);
  const participantStatusById = React.useMemo(() => new Map(assistantParticipants.map(participant => {
    const participantName = participant.name?.trim() ?? '';
    const mentionRegex = participantName ? participantMentionPattern(participantName) : null;
    const wasMentioned = !!(latestUserMessage && mentionRegex && latestUserMessage.fragments.some(fragment =>
      isTextContentFragment(fragment) && mentionRegex.test(fragment.part.text),
    ));
    const willSpeak = participant.speakWhen !== 'when-mentioned' || wasMentioned;
    const spokeThisTurn = spokenThisTurnParticipantIds.has(participant.id);
    const spokeLast = latestAssistantMessage?.metadata?.author?.participantId === participant.id;
    const isNextToSpeak = nextToSpeakParticipantId === participant.id;
    const reason = isNextToSpeak
      ? 'Next to speak'
      : willSpeak
        ? (spokeThisTurn ? 'Already spoke this turn' : (participant.speakWhen === 'when-mentioned' ? 'Will speak this turn because it was @mentioned' : 'Will speak every turn'))
        : 'Waiting for an @mention';
    return [participant.id, { wasMentioned, willSpeak, spokeThisTurn, spokeLast, isNextToSpeak, reason }];
  })), [assistantParticipants, latestAssistantMessage, latestUserMessage, nextToSpeakParticipantId, participantMentionPattern, spokenThisTurnParticipantIds]);
  const participantPersonaOptions = React.useMemo(() => Object.entries(SystemPurposes) as [SystemPurposeId, (typeof SystemPurposes)[SystemPurposeId]][], []);
  const selectedParticipantLlm = React.useMemo(() => visibleLLMs.find(llm => llm.id === draftLlmId) ?? null, [draftLlmId, visibleLLMs]);
  const activeConversationGroupId = React.useMemo(() => {
    if (!props.conversationId)
      return null;

    const activeParticipants = assistantParticipants.map(participant => ({ ...participant }));
    return savedAgentGroups.find(group =>
      group.turnTerminationMode === turnTerminationMode
      && JSON.stringify(group.participants) === JSON.stringify(activeParticipants)
    )?.id ?? null;
  }, [assistantParticipants, props.conversationId, savedAgentGroups, turnTerminationMode]);
  const canManageParticipants = !!props.conversationId;
  const canRemoveAssistant = assistantParticipants.length > 1;

  React.useEffect(() => {
    if (!participantsAnchorEl) {
      setDraftPersonaId(systemPurposeId ?? '');
      setDraftLlmId('');
      setExpandedParticipantId(null);
      setParticipantDrafts({});
      setAgentGroupNameDraft('');
      return;
    }

    const activeGroup = activeConversationGroupId
      ? savedAgentGroups.find(group => group.id === activeConversationGroupId) ?? null
      : null;
    setAgentGroupNameDraft(activeGroup?.name ?? `Agents ${Math.max(assistantParticipants.length, 1)}`);
  }, [activeConversationGroupId, assistantParticipants.length, participantsAnchorEl, savedAgentGroups, systemPurposeId]);

  const handleParticipantsToggle = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!canManageParticipants)
      return;
    setParticipantsAnchorEl(current => current ? null : event.currentTarget);
  }, [canManageParticipants]);

  const handleParticipantRemove = React.useCallback((participantId: string) => {
    if (!props.conversationId || !canRemoveAssistant)
      return;

    setParticipants(props.conversationId, participants.filter(participant => participant.id !== participantId));
  }, [canRemoveAssistant, participants, props.conversationId, setParticipants]);

  const handleClearAgents = React.useCallback(() => {
    if (!props.conversationId)
      return;

    const humanParticipants = participants.filter(participant => participant.kind === 'human');
    setParticipants(props.conversationId, humanParticipants);
    setExpandedParticipantId(null);
    setParticipantDrafts({});
  }, [participants, props.conversationId, setParticipants]);

  const handleParticipantUpdate = React.useCallback((participantId: string, update: Partial<DConversationParticipant>) => {
    if (!props.conversationId)
      return;

    setParticipants(props.conversationId, participants.map(participant =>
      participant.id === participantId ? { ...participant, ...update } : participant,
    ));
  }, [participants, props.conversationId, setParticipants]);

  const handleParticipantDraftChange = React.useCallback((participantId: string, update: Partial<{
    name: string;
    personaId: SystemPurposeId | null;
    llmId: string | null;
    customPrompt: string;
    speakWhen: DConversationParticipant['speakWhen'];
  }>) => {
    const participant = participants.find(participant => participant.id === participantId);
    if (!participant)
      return;

    setParticipantDrafts(current => ({
      ...current,
      [participantId]: {
        name: current[participantId]?.name ?? participant.name,
        personaId: current[participantId]?.personaId ?? participant.personaId ?? null,
        llmId: current[participantId]?.llmId ?? participant.llmId ?? null,
        customPrompt: current[participantId]?.customPrompt ?? participant.customPrompt ?? '',
        speakWhen: current[participantId]?.speakWhen ?? participant.speakWhen ?? 'every-turn',
        ...update,
      },
    }));
  }, [participants]);

  const handleParticipantDraftCommit = React.useCallback((participantId: string) => {
    const participant = participants.find(participant => participant.id === participantId);
    const draft = participantDrafts[participantId];
    if (!participant || !draft)
      return;

    const nextName = draft.name.trim() || participant.name;
    const hasChanges = nextName !== participant.name
      || (draft.personaId ?? null) !== (participant.personaId ?? null)
      || (draft.llmId ?? null) !== (participant.llmId ?? null)
      || (draft.customPrompt.trim() || '') !== (participant.customPrompt ?? '')
      || (draft.speakWhen ?? 'every-turn') !== (participant.speakWhen ?? 'every-turn');

    if (hasChanges)
      handleParticipantUpdate(participantId, {
        name: nextName,
        personaId: draft.personaId ?? null,
        llmId: draft.llmId ?? null,
        customPrompt: draft.customPrompt.trim() || undefined,
        speakWhen: draft.speakWhen ?? 'every-turn',
      });

    setParticipantDrafts(current => {
      const { [participantId]: _removed, ...rest } = current;
      return rest;
    });
  }, [handleParticipantUpdate, participantDrafts, participants]);

  const handleExpandedParticipantChange = React.useCallback((participantId: string) => {
    if (expandedParticipantId === participantId) {
      handleParticipantDraftCommit(participantId);
      setExpandedParticipantId(null);
      return;
    }

    if (expandedParticipantId)
      handleParticipantDraftCommit(expandedParticipantId);

    setExpandedParticipantId(participantId);
  }, [expandedParticipantId, handleParticipantDraftCommit]);

  const handleParticipantsClose = React.useCallback(() => {
    Object.keys(participantDrafts).forEach(participantId => handleParticipantDraftCommit(participantId));
    setParticipantsAnchorEl(null);
    setExpandedParticipantId(null);
  }, [handleParticipantDraftCommit, participantDrafts]);

  const handleParticipantReorder = React.useCallback((draggedParticipantId: string, targetParticipantId: string, edge: 'before' | 'after') => {
    if (!props.conversationId || draggedParticipantId === targetParticipantId)
      return;

    const humanParticipants = participants.filter(participant => participant.kind === 'human');
    const assistantParticipants = participants.filter(participant => participant.kind === 'assistant');
    const draggedIndex = assistantParticipants.findIndex(participant => participant.id === draggedParticipantId);
    const targetIndex = assistantParticipants.findIndex(participant => participant.id === targetParticipantId);
    if (draggedIndex < 0 || targetIndex < 0)
      return;

    const reorderedAssistants = [...assistantParticipants];
    const [draggedParticipant] = reorderedAssistants.splice(draggedIndex, 1);
    const adjustedTargetIndex = reorderedAssistants.findIndex(participant => participant.id === targetParticipantId);
    if (adjustedTargetIndex < 0)
      return;

    const insertionIndex = edge === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;
    reorderedAssistants.splice(insertionIndex, 0, draggedParticipant);
    setParticipants(props.conversationId, [...humanParticipants, ...reorderedAssistants]);
  }, [participants, props.conversationId, setParticipants]);

  const resetParticipantDragState = React.useCallback(() => {
    setDraggedParticipantId(null);
    setDropTargetParticipantId(null);
    setDropTargetEdge(null);
  }, []);

  const handleParticipantDragStart = React.useCallback((event: React.DragEvent<HTMLElement>, participantId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', participantId);
    setDraggedParticipantId(participantId);
    setDropTargetParticipantId(participantId);
    setDropTargetEdge('before');
  }, []);

  const handleParticipantDragOver = React.useCallback((event: React.DragEvent<HTMLElement>, participantId: string) => {
    if (!draggedParticipantId)
      return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerOffset = event.clientY - bounds.top;
    const edge = pointerOffset < bounds.height / 2 ? 'before' : 'after';

    setDropTargetParticipantId(participantId);
    setDropTargetEdge(edge);
  }, [draggedParticipantId]);

  const handleParticipantDrop = React.useCallback((event: React.DragEvent<HTMLElement>, participantId: string) => {
    event.preventDefault();

    const sourceParticipantId = draggedParticipantId || event.dataTransfer.getData('text/plain');
    const edge = dropTargetParticipantId === participantId ? (dropTargetEdge ?? 'before') : 'before';
    if (sourceParticipantId)
      handleParticipantReorder(sourceParticipantId, participantId, edge);

    resetParticipantDragState();
  }, [draggedParticipantId, dropTargetEdge, dropTargetParticipantId, handleParticipantReorder, resetParticipantDragState]);

  const handleParticipantDragEnd = React.useCallback(() => {
    resetParticipantDragState();
  }, [resetParticipantDragState]);

  const handleTurnTerminationModeChange = React.useCallback((_event: React.SyntheticEvent | null, value: string | null) => {
    if (!props.conversationId || (value !== 'round-robin-per-human' && value !== 'continuous' && value !== 'consensus'))
      return;
    setTurnTerminationMode(props.conversationId, value);
  }, [props.conversationId, setTurnTerminationMode]);

  const handleParticipantAdd = React.useCallback(() => {
    if (!props.conversationId || !draftPersonaId)
      return;

    const nextParticipant = createAssistantConversationParticipant(
      draftPersonaId,
      draftLlmId || null,
      generateAssistantParticipantName(draftPersonaId, assistantParticipants.map(participant => participant.name)),
    );

    setParticipants(props.conversationId, [...participants, nextParticipant]);
    setDraftLlmId('');
    setExpandedParticipantId(nextParticipant.id);
  }, [assistantParticipants, draftLlmId, draftPersonaId, participants, props.conversationId, setParticipants]);

  const handleSaveAgentGroup = React.useCallback(() => {
    if (!props.conversationId)
      return;

    const normalizedName = agentGroupNameDraft.trim() || `Agents ${Math.max(assistantParticipants.length, 1)}`;
    const savedId = props.onConversationSaveAgentGroup(
      props.conversationId,
      normalizedName,
      activeConversationGroupId,
    );

    if (savedId)
      setAgentGroupNameDraft(normalizedName);
  }, [activeConversationGroupId, agentGroupNameDraft, assistantParticipants.length, props]);

  return <>

    {/* Persona selector */}
    {personaDropdown}

    {/* Model selector */}
    {chatLLMDropdown}

    {/* Participants */}
    <Button
      color='neutral'
      disabled={!canManageParticipants}
      onClick={handleParticipantsToggle}
      size='sm'
      startDecorator={<SmartToyOutlinedIcon />}
      variant={participantsAnchorEl ? 'solid' : 'soft'}
    >
      Agents {assistantParticipants.length > 1 ? assistantParticipants.length : ''}
    </Button>
    <CloseablePopup
      anchorEl={participantsAnchorEl}
      onClose={handleParticipantsClose}
      noAutoFocus
      placement='bottom-start'
      maxWidth={560}
      minWidth={420}
      sx={{ p: 1.25, display: 'grid', gap: 1.25 }}
    >
      <Box sx={{ display: 'grid', gap: 1, p: 1.1, borderRadius: 'xl', backgroundColor: 'background.level1', border: '1px solid', borderColor: 'divider' }}>
        <Stack direction='row' spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Stack spacing={0.35}>
            <Typography level='title-md'>Agents</Typography>
            <Typography level='body-sm' sx={{ color: 'text.tertiary' }}>
              {assistantParticipants.length} configured · drag to reorder
            </Typography>
          </Stack>
          <Stack direction='row' spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button size='sm' variant='soft' color='primary' disabled={!props.conversationId} onClick={handleSaveAgentGroup}>
              {activeConversationGroupId ? 'Update group' : 'Save group'}
            </Button>
            <Button size='sm' variant='soft' color='danger' disabled={!assistantParticipants.length} onClick={handleClearAgents}>
              Clear agents
            </Button>
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Typography level='body-sm'>Group name</Typography>
          <Input
            size='sm'
            value={agentGroupNameDraft}
            onChange={event => setAgentGroupNameDraft(event.target.value)}
            placeholder={`Agents ${Math.max(assistantParticipants.length, 1)}`}
          />
        </Box>

        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Typography level='body-sm'>Turn termination</Typography>
          <Select
            size='sm'
            value={turnTerminationMode}
            onChange={handleTurnTerminationModeChange}
          >
            <Option value='round-robin-per-human'>Human message → agents pass → @mentions can continue</Option>
            <Option value='continuous'>Human starts → agents continue until stopped</Option>
            <Option value='consensus'>Human message → all triggered agents must agree → one reply</Option>
          </Select>
          <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
            {turnTerminationMode === 'continuous'
              ? 'Agents keep taking turns until you stop the room.'
              : turnTerminationMode === 'consensus'
                ? 'Triggered agents deliberate privately and only a shared answer is shown when they match.'
                : 'Each human message starts an ordered pass; agent @mentions can keep the room going until no follow-ups remain.'}
          </Typography>
        </Box>
      </Box>

      <Stack spacing={1}>
        {assistantParticipants.map((participant, index) => {
          const personaTitle = participant.personaId ? SystemPurposes[participant.personaId]?.title ?? participant.personaId : 'No persona';
          const llmLabel = participant.llmId ? (visibleLLMs.find(llm => llm.id === participant.llmId)?.label ?? participant.llmId) : 'Chat model';
          const participantStatus = participantStatusById.get(participant.id);
          const isExpanded = expandedParticipantId === participant.id;
          const summaryLabel = participant.speakWhen === 'when-mentioned' ? 'On mention' : 'Every turn';
          const participantDraft = participantDrafts[participant.id];
          const aliasDraft = participantDraft?.name ?? participant.name;
          const personaDraftValue = participantDraft?.personaId ?? participant.personaId ?? null;
          const llmDraftValue = participantDraft?.llmId ?? participant.llmId ?? '';
          const customPromptDraft = participantDraft?.customPrompt ?? participant.customPrompt ?? '';
          const isCustomPersonaSelected = personaDraftValue === 'Custom';
          const hasCustomPrompt = isCustomPersonaSelected && !!customPromptDraft.trim();
          const speakWhenDraftValue = participantDraft?.speakWhen ?? participant.speakWhen ?? 'every-turn';
          const participantAccentColor = getParticipantAccentColor(participant.name);
          const isDragged = draggedParticipantId === participant.id;
          const isDropTarget = dropTargetParticipantId === participant.id && draggedParticipantId !== participant.id;
          return (
            <Box
              key={participant.id}
              draggable
              onDragStart={(event) => handleParticipantDragStart(event, participant.id)}
              onDragOver={(event) => handleParticipantDragOver(event, participant.id)}
              onDrop={(event) => handleParticipantDrop(event, participant.id)}
              onDragEnd={handleParticipantDragEnd}
              sx={{
                display: 'grid',
                gap: 0.9,
                p: 1,
                borderRadius: 'xl',
                border: '1px solid',
                borderColor: isExpanded ? `${participantAccentColor}.outlinedBorder` : 'divider',
                backgroundColor: isExpanded ? 'background.level1' : 'background.surface',
                transition: 'box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease',
                position: 'relative',
                cursor: 'grab',
                opacity: isDragged ? 0.55 : 1,
                boxShadow: isDropTarget ? 'md' : undefined,
                '&::before': isDropTarget && dropTargetEdge === 'before' ? {
                  content: '""',
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  top: -4,
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: 'primary.500',
                } : undefined,
                '&::after': isDropTarget && dropTargetEdge === 'after' ? {
                  content: '""',
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  bottom: -4,
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: 'primary.500',
                } : undefined,
                '&:hover': {
                  boxShadow: 'sm',
                  borderColor: isExpanded ? `${participantAccentColor}.outlinedBorder` : 'neutral.outlinedHoverBorder',
                },
              }}
            >
              <Stack direction='row' spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip size='sm' variant='soft' color='neutral' sx={{ minWidth: 32, justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {index + 1}
                </Chip>

                <Box
                  onClick={() => handleExpandedParticipantChange(participant.id)}
                  sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                >
                  <Stack direction='row' spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography level='title-sm'>{participant.name}</Typography>
                    <Chip size='sm' variant='soft' color={participantAccentColor}>{summaryLabel}</Chip>
                    {participantStatus?.isNextToSpeak && <Chip size='sm' variant='soft' color='primary'>Next</Chip>}
                    {participantStatus?.spokeThisTurn && <Chip size='sm' variant='soft' color='success'>Done</Chip>}
                    {participantStatus?.spokeLast && <Chip size='sm' variant='soft'>Latest</Chip>}
                    {participantStatus?.wasMentioned && <Chip size='sm' variant='soft' color='primary'>@mentioned</Chip>}
                    {hasCustomPrompt && <Chip size='sm' variant='soft' color='warning'>Custom prompt</Chip>}
                  </Stack>

                  <Typography level='body-sm' sx={{ color: 'text.secondary', mt: 0.35 }}>
                    {personaTitle} · {llmLabel}
                  </Typography>
                  <Typography level='body-xs' sx={{ color: participantStatus?.isNextToSpeak ? 'primary.600' : 'text.tertiary', mt: 0.15 }}>
                    {participantStatus?.reason ?? 'Ready'}
                  </Typography>
                </Box>

                <Stack direction='row' spacing={0.25} sx={{ alignItems: 'center' }}>
                  <IconButton
                    aria-label='Delete'
                    size='sm'
                    variant='plain'
                    color='neutral'
                    disabled={!canRemoveAssistant}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleParticipantRemove(participant.id);
                    }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                  <Button
                    size='sm'
                    variant={isExpanded ? 'soft' : 'plain'}
                    color={isExpanded ? participantAccentColor : 'neutral'}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleExpandedParticipantChange(participant.id);
                    }}
                  >
                    {isExpanded ? 'Close' : 'Edit'}
                  </Button>
                </Stack>
              </Stack>

              {isExpanded && (
                <Box sx={{ display: 'grid', gap: 0.9 }}>
                  <Divider />
                  <Input
                    size='sm'
                    value={aliasDraft}
                    onChange={(event) => handleParticipantDraftChange(participant.id, { name: event.target.value })}
                    onBlur={() => handleParticipantDraftCommit(participant.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleParticipantDraftCommit(participant.id);
                      }
                    }}
                    placeholder='Agent alias'
                  />
                  <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: 'minmax(8rem, 1fr) minmax(9rem, 1fr) minmax(8rem, 1fr)' } }}>
                    <Select
                      size='sm'
                      value={personaDraftValue}
                      onChange={(_event, value) => handleParticipantDraftChange(participant.id, { personaId: (value as SystemPurposeId | null) ?? null })}
                    >
                      {participantPersonaOptions.map(([personaId, persona]) => (
                        <Option key={personaId} value={personaId}>{persona.title}</Option>
                      ))}
                    </Select>

                    <Select
                      size='sm'
                      value={llmDraftValue}
                      onChange={(_event, value) => handleParticipantDraftChange(participant.id, { llmId: ((value as string | null) || null) })}
                    >
                      <Option value={''}>Current chat model</Option>
                      {visibleLLMs.map(llm => (
                        <Option key={llm.id} value={llm.id}>{llm.label}</Option>
                      ))}
                    </Select>

                    <Select
                      size='sm'
                      value={speakWhenDraftValue}
                      onChange={(_event, value) => handleParticipantDraftChange(participant.id, { speakWhen: ((value as DConversationParticipant['speakWhen'] | null) ?? 'every-turn') })}
                    >
                      <Option value='every-turn'>Every turn</Option>
                      <Option value='when-mentioned'>Only @mentioned</Option>
                    </Select>
                  </Box>

                  {isCustomPersonaSelected && <Input
                    size='sm'
                    value={customPromptDraft}
                    onChange={(event) => handleParticipantDraftChange(participant.id, { customPrompt: event.target.value })}
                    onBlur={() => handleParticipantDraftCommit(participant.id)}
                    placeholder='Optional custom prompt/persona instructions'
                  />}
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ display: 'grid', gap: 0.75, p: 1, borderRadius: 'xl', border: '1px dashed', borderColor: 'divider', backgroundColor: 'background.level1' }}>
        <Typography level='body-sm'>Add another agent</Typography>
        <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: 'minmax(10rem, 1fr) minmax(10rem, 1fr) auto' } }}>
          <Select
            placeholder='Persona'
            value={draftPersonaId || null}
            onChange={(_event, value) => setDraftPersonaId((value as SystemPurposeId | null) ?? '')}
            size='sm'
          >
            {participantPersonaOptions.map(([personaId, persona]) => (
              <Option key={personaId} value={personaId}>{persona.title}</Option>
            ))}
          </Select>

          <Select
            placeholder='Model (optional)'
            value={draftLlmId || null}
            onChange={(_event, value) => setDraftLlmId((value as string | null) ?? '')}
            size='sm'
          >
            <Option value={''}>Current chat model</Option>
            {visibleLLMs.map(llm => (
              <Option key={llm.id} value={llm.id}>{llm.label}</Option>
            ))}
          </Select>

          <Button size='sm' onClick={handleParticipantAdd} disabled={!draftPersonaId} startDecorator={<SmartToyOutlinedIcon />}>
            Add agent
          </Button>
        </Box>
        <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
          {selectedParticipantLlm ? `New agent uses ${selectedParticipantLlm.label}.` : 'New agent uses the current chat model.'}
        </Typography>
      </Box>
    </CloseablePopup>

    {/* Folder selector */}
    {folderDropdown}

  </>;
}
