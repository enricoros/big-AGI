import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { fileOpen, fileSave } from 'browser-fs-access';

import { Box, Button, Chip, Divider, FormControl, FormHelperText, FormLabel, IconButton, Input, Option, Select, Stack, Typography } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Menu from '@mui/joy/Menu';
import MenuButton from '@mui/joy/MenuButton';
import MenuItem from '@mui/joy/MenuItem';
import Dropdown from '@mui/joy/Dropdown';

import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { CloseablePopup, joyKeepPopup } from '~/common/components/CloseablePopup';
import {
  createAssistantConversationParticipant,
  DConversationParticipant,
  DConversationTurnTerminationMode,
  generateAssistantParticipantName,
  sanitizeCouncilMaxRounds,
  sanitizeCouncilTraceAutoCollapsePreviousRounds,
  sanitizeCouncilTraceAutoExpandNewestRound,
} from '~/common/stores/chat/chat.conversation';
import { isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useChatAgentGroupsStore } from '~/common/stores/chat/store-chat-agent-groups';
import type { DAgentGroupSnapshot, DAgentSnapshot } from '~/common/stores/chat/store-chat-agent-groups';
import { buildAgentTransferFile, getAgentTransferFilename, parseAgentTransferFile } from '~/common/stores/chat/store-chat-agent.transfer';
import { buildAgentGroupTransferFile, getAgentGroupTransferFilename, parseAgentGroupTransferFile } from '~/common/stores/chat/store-chat-agent-groups.transfer';
import { useVisibleLLMs } from '~/common/stores/llms/llms.hooks';
import { getLLMLabel, type DLLM } from '~/common/stores/llms/llms.types';
import { DModelParameterRegistry, DModelReasoningEffort, findModelReasoningEffortParamSpec, type DModelReasoningEffortParamId } from '~/common/stores/llms/llms.parameters';
import { findParticipantMentionMatchIndex, getParticipantAccentColor, getParticipantAccentSx } from '~/common/util/dMessageUtils';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';

import {
  getParticipantEditorGridTemplateColumns,
  getParticipantEditorSpeakWhenGridColumn,
  getParticipantRosterGridTemplateColumns,
} from './ChatBarChat.layout';
import {
  getParticipantReasoningEffortSelectState,
  PARTICIPANT_REASONING_EFFORT_META,
  PARTICIPANT_REASONING_EFFORT_ORDER,
  PARTICIPANT_REASONING_MODEL_SETTING_VALUE,
} from './ChatBarChat.reasoning';
import { createUniqueAgentName, getActiveAgentGroup, getAgentGroupSaveMode, getAgentSaveMode, getAssistantParticipantsSpeakWhenSummary, setAssistantParticipantsSpeakWhen } from './ChatBarChat.agentGroup';
import { ChatBarChatSettingsPanel, TURN_TERMINATION_MODE_OPTIONS } from './ChatBarChat.settings';
import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';
import { useFolderDropdown } from './useFolderDropdown';

function formatCouncilMaxRoundsDraft(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

function getParticipantReasoningEffortOptions(llm: DLLM | null) {
  if (!llm)
    return { parameterId: null, parameterLabel: 'Reasoning Effort', options: [] as Array<{ value: DModelReasoningEffort; label: string; description: string }> };

  const effortSpec = findModelReasoningEffortParamSpec(llm.parameterSpecs);
  if (!effortSpec)
    return { parameterId: null, parameterLabel: 'Reasoning Effort', options: [] as Array<{ value: DModelReasoningEffort; label: string; description: string }> };

  const parameterId = effortSpec.paramId as DModelReasoningEffortParamId;
  const allowedValues = new Set((effortSpec.enumValues as readonly DModelReasoningEffort[] | undefined)
    ?? (DModelParameterRegistry[parameterId].values as readonly DModelReasoningEffort[]));
  const options = PARTICIPANT_REASONING_EFFORT_ORDER
    .filter(value => allowedValues.has(value))
    .map(value => ({
      value,
      label: PARTICIPANT_REASONING_EFFORT_META[value].label,
      description: PARTICIPANT_REASONING_EFFORT_META[value].description,
    }));

  return {
    parameterId,
    parameterLabel: DModelParameterRegistry[parameterId].label,
    options,
  };
}

const agentsToolbarButtonSx = {
  '--Button-gap': '0.375rem',
  borderRadius: '999px',
  px: 1.2,
  border: '1px solid',
  borderColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.12)',
  backgroundColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.06)',
  boxShadow: 'xs',
  fontWeight: 600,
  '&:hover': {
    borderColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.2)',
    backgroundColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.12)',
  },
} as const;

const agentsToolbarPrimaryButtonSx = {
  borderRadius: '999px',
  px: 1.35,
  fontWeight: 700,
  boxShadow: 'sm',
} as const;

const agentsToolbarDangerButtonSx = {
  borderRadius: '999px',
  px: 1.15,
  fontWeight: 600,
} as const;

export function ChatBarChat(props: {
  conversationId: DConversationId | null;
  llmDropdownRef: React.Ref<OptimaBarControlMethods>;
  personaDropdownRef: React.Ref<OptimaBarControlMethods>;
  onConversationSaveAgentGroup: (conversationId: DConversationId, name?: string, existingId?: string | null) => string | null;
  onConversationLoadAgentGroup: (conversationId: DConversationId, agentGroupSnapshot: DAgentGroupSnapshot) => boolean;
}) {

  // state
  const [participantsAnchorEl, setParticipantsAnchorEl] = React.useState<HTMLElement | null>(null);
  const [agentGroupNameDraft, setAgentGroupNameDraft] = React.useState('');
  const [councilMaxRoundsDraft, setCouncilMaxRoundsDraft] = React.useState('');
  const [draftPersonaId, setDraftPersonaId] = React.useState<SystemPurposeId | ''>('');
  const [draftLlmId, setDraftLlmId] = React.useState<string>('');
  const [draftCustomPrompt, setDraftCustomPrompt] = React.useState('');
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
    reasoningEffort: DConversationParticipant['reasoningEffort'];
  }>>({});

  // external state
  const { chatLLMDropdown, chatLLMId } = useChatLLMDropdown(props.llmDropdownRef);
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId, props.personaDropdownRef);
  const { folderDropdown } = useFolderDropdown(props.conversationId);
  const {
    participants,
    messages,
    systemPurposeId,
    turnTerminationMode,
    councilMaxRounds,
    councilTraceAutoCollapsePreviousRounds,
    councilTraceAutoExpandNewestRound,
    activeAgentGroupId,
    setParticipants,
    setTurnTerminationMode,
    setCouncilMaxRounds,
    setCouncilTraceAutoCollapsePreviousRounds,
    setCouncilTraceAutoExpandNewestRound,
  } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(_c => _c.id === props.conversationId);
    return {
      participants: conversation?.participants ?? [],
      messages: conversation?.messages ?? [],
      systemPurposeId: conversation?.systemPurposeId ?? null,
      turnTerminationMode: (conversation?.turnTerminationMode === 'continuous'
        ? 'continuous'
        : conversation?.turnTerminationMode === 'council'
          ? 'council'
          : 'round-robin-per-human') as DConversationTurnTerminationMode,
      councilMaxRounds: sanitizeCouncilMaxRounds(conversation?.councilMaxRounds),
      councilTraceAutoCollapsePreviousRounds: sanitizeCouncilTraceAutoCollapsePreviousRounds(conversation?.councilTraceAutoCollapsePreviousRounds),
      councilTraceAutoExpandNewestRound: sanitizeCouncilTraceAutoExpandNewestRound(conversation?.councilTraceAutoExpandNewestRound),
      activeAgentGroupId: conversation?.agentGroupId ?? null,
      setParticipants: state.setParticipants,
      setTurnTerminationMode: state.setTurnTerminationMode,
      setCouncilMaxRounds: state.setCouncilMaxRounds,
      setCouncilTraceAutoCollapsePreviousRounds: state.setCouncilTraceAutoCollapsePreviousRounds,
      setCouncilTraceAutoExpandNewestRound: state.setCouncilTraceAutoExpandNewestRound,
    };
  }));
  const { savedAgentGroups, savedAgents, saveAgent, deleteAgent, importAgentGroups } = useChatAgentGroupsStore(useShallow(state => ({
    savedAgentGroups: state.savedAgentGroups,
    savedAgents: state.savedAgents,
    saveAgent: state.saveAgent,
    deleteAgent: state.deleteAgent,
    importAgentGroups: state.importAgentGroups,
  })));
  const { llms: visibleLLMs } = useVisibleLLMs(chatLLMId ?? null, false, true);
  const sortedSavedAgentGroups = React.useMemo(() =>
    [...savedAgentGroups].sort((a, b) => b.updatedAt - a.updatedAt),
  [savedAgentGroups]);
  const sortedSavedAgents = React.useMemo(() =>
    [...savedAgents].sort((a, b) => b.updatedAt - a.updatedAt),
  [savedAgents]);

  // derived state
  const assistantParticipants = React.useMemo(() => participants.filter(participant => participant.kind === 'assistant'), [participants]);
  const leaderParticipant = React.useMemo(() => assistantParticipants.find(participant => participant.isLeader) ?? assistantParticipants[0] ?? null, [assistantParticipants]);
  const latestUserMessage = React.useMemo(() => participantsAnchorEl
    ? [...messages].reverse().find(message => message.role === 'user') ?? null
    : null, [messages, participantsAnchorEl]);
  const latestUserMessageIndex = React.useMemo(() => {
    if (!participantsAnchorEl || !latestUserMessage)
      return -1;
    return messages.findIndex(message => message.id === latestUserMessage.id);
  }, [latestUserMessage, messages, participantsAnchorEl]);
  const assistantMessagesSinceLatestUser = React.useMemo(() => {
    if (!participantsAnchorEl)
      return [];
    const messagesAfterLatestUser = latestUserMessageIndex >= 0 ? messages.slice(latestUserMessageIndex + 1) : [];
    return messagesAfterLatestUser.filter(message => message.role === 'assistant' && !!message.metadata?.author?.participantId);
  }, [latestUserMessageIndex, messages, participantsAnchorEl]);
  const latestAssistantMessage = React.useMemo(() => assistantMessagesSinceLatestUser.at(-1) ?? null, [assistantMessagesSinceLatestUser]);
  const latestUserMessageText = React.useMemo(() => {
    if (!participantsAnchorEl || !latestUserMessage)
      return '';

    return latestUserMessage.fragments
      .filter(isTextContentFragment)
      .map(fragment => fragment.part.text)
      .join('\n');
  }, [latestUserMessage, participantsAnchorEl]);
  const wasParticipantMentionedInLatestUserTurn = React.useCallback((participant: DConversationParticipant) => {
    const participantName = participant.name?.trim() ?? '';
    return !!(latestUserMessageText && participantName && findParticipantMentionMatchIndex(latestUserMessageText, participantName) !== null);
  }, [latestUserMessageText]);
  const runnableParticipantIds = React.useMemo(() => {
    if (!participantsAnchorEl)
      return [];

    return assistantParticipants
      .filter(participant => participant.speakWhen !== 'when-mentioned' || wasParticipantMentionedInLatestUserTurn(participant))
      .map(participant => participant.id);
  }, [assistantParticipants, participantsAnchorEl, wasParticipantMentionedInLatestUserTurn]);
  const spokenThisTurnParticipantIds = React.useMemo(() => {
    if (!participantsAnchorEl)
      return new Set<string>();

    return new Set(assistantMessagesSinceLatestUser
      .map(message => message.metadata?.author?.participantId)
      .filter((participantId): participantId is string => !!participantId));
  }, [assistantMessagesSinceLatestUser, participantsAnchorEl]);
  const nextToSpeakParticipantId = React.useMemo(() => runnableParticipantIds.find(participantId => !spokenThisTurnParticipantIds.has(participantId)) ?? null,
    [runnableParticipantIds, spokenThisTurnParticipantIds]);
  const participantStatusById = React.useMemo(() => {
    if (!participantsAnchorEl)
      return new Map<string, { wasMentioned: boolean; willSpeak: boolean; spokeThisTurn: boolean; spokeLast: boolean; isNextToSpeak: boolean; reason: string }>();

    return new Map(assistantParticipants.map(participant => {
      const wasMentioned = wasParticipantMentionedInLatestUserTurn(participant);
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
    }));
  }, [assistantParticipants, latestAssistantMessage, nextToSpeakParticipantId, participantsAnchorEl, spokenThisTurnParticipantIds, wasParticipantMentionedInLatestUserTurn]);
  const participantPersonaOptions = React.useMemo(() => Object.entries(SystemPurposes) as [SystemPurposeId, (typeof SystemPurposes)[SystemPurposeId]][], []);
  const selectedParticipantLlm = React.useMemo(() => visibleLLMs.find(llm => llm.id === draftLlmId) ?? null, [draftLlmId, visibleLLMs]);
  const selectedParticipantReasoningConfig = React.useMemo(() => getParticipantReasoningEffortOptions(selectedParticipantLlm), [selectedParticipantLlm]);
  const isDraftCustomPersonaSelected = draftPersonaId === 'Custom';
  const participantRosterGridTemplateColumns = React.useMemo(
    () => getParticipantRosterGridTemplateColumns(!!expandedParticipantId),
    [expandedParticipantId],
  );
  const participantEditorGridTemplateColumns = React.useMemo(() => getParticipantEditorGridTemplateColumns(), []);
  const participantEditorSpeakWhenGridColumn = React.useMemo(() => getParticipantEditorSpeakWhenGridColumn(), []);
  const activeConversationGroupId = React.useMemo(() => {
    if (!props.conversationId)
      return null;

    if (activeAgentGroupId && savedAgentGroups.some(group => group.id === activeAgentGroupId))
      return activeAgentGroupId;

    const activeParticipants = assistantParticipants.map(participant => ({ ...participant }));
    const matchesCurrentConversation = (group: typeof savedAgentGroups[number]) =>
      group.turnTerminationMode === turnTerminationMode
      && (turnTerminationMode !== 'council' || sanitizeCouncilMaxRounds(group.councilMaxRounds) === councilMaxRounds)
      && sanitizeCouncilTraceAutoCollapsePreviousRounds(group.councilTraceAutoCollapsePreviousRounds) === councilTraceAutoCollapsePreviousRounds
      && sanitizeCouncilTraceAutoExpandNewestRound(group.councilTraceAutoExpandNewestRound) === councilTraceAutoExpandNewestRound
      && group.systemPurposeId === systemPurposeId
      && JSON.stringify(group.participants) === JSON.stringify(activeParticipants);

    return savedAgentGroups.find(matchesCurrentConversation)?.id ?? null;
  }, [
    activeAgentGroupId,
    assistantParticipants,
    councilMaxRounds,
    councilTraceAutoCollapsePreviousRounds,
    councilTraceAutoExpandNewestRound,
    props.conversationId,
    savedAgentGroups,
    systemPurposeId,
    turnTerminationMode,
  ]);
  const agentGroupSaveMode = React.useMemo(() => getAgentGroupSaveMode({
    activeConversationGroupId,
    agentGroupNameDraft,
    savedAgentGroups,
  }), [activeConversationGroupId, agentGroupNameDraft, savedAgentGroups]);
  const activeSavedAgentGroup = React.useMemo(() => getActiveAgentGroup({
    activeConversationGroupId,
    savedAgentGroups,
  }), [activeConversationGroupId, savedAgentGroups]);
  const canManageParticipants = !!props.conversationId;
  const canRemoveAssistant = assistantParticipants.length > 1;
  const assistantSpeakWhenSummary = React.useMemo(() => getAssistantParticipantsSpeakWhenSummary(assistantParticipants), [assistantParticipants]);
  const allAssistantsEveryTurn = React.useMemo(() =>
    assistantParticipants.every(participant => (participant.speakWhen ?? 'every-turn') === 'every-turn'),
  [assistantParticipants]);
  const allAssistantsOnlyMention = React.useMemo(() =>
    assistantParticipants.every(participant => (participant.speakWhen ?? 'every-turn') === 'when-mentioned'),
  [assistantParticipants]);
  const activeTurnMode = TURN_TERMINATION_MODE_OPTIONS[turnTerminationMode];
  const activeTurnModeColor = turnTerminationMode === 'council'
    ? 'primary'
    : turnTerminationMode === 'continuous'
      ? 'warning'
      : 'neutral';

  React.useEffect(() => {
    if (!participantsAnchorEl) {
      setDraftPersonaId(systemPurposeId ?? '');
      setDraftLlmId('');
      setDraftCustomPrompt('');
      setExpandedParticipantId(null);
      setParticipantDrafts({});
      setAgentGroupNameDraft('');
      setCouncilMaxRoundsDraft('');
      return;
    }

    const activeGroup = activeConversationGroupId
      ? savedAgentGroups.find(group => group.id === activeConversationGroupId) ?? null
      : null;
    setAgentGroupNameDraft(activeGroup?.name ?? `Agents ${Math.max(assistantParticipants.length, 1)}`);
    setCouncilMaxRoundsDraft(formatCouncilMaxRoundsDraft(councilMaxRounds));
  }, [activeConversationGroupId, assistantParticipants.length, councilMaxRounds, participantsAnchorEl, savedAgentGroups, systemPurposeId]);

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
    reasoningEffort: DConversationParticipant['reasoningEffort'];
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
        reasoningEffort: current[participantId]?.reasoningEffort ?? participant.reasoningEffort,
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
      || (draft.speakWhen ?? 'every-turn') !== (participant.speakWhen ?? 'every-turn')
      || (draft.reasoningEffort ?? null) !== (participant.reasoningEffort ?? null);

    if (hasChanges)
      handleParticipantUpdate(participantId, {
        name: nextName,
        personaId: draft.personaId ?? null,
        llmId: draft.llmId ?? null,
        customPrompt: draft.customPrompt.trim() || undefined,
        speakWhen: draft.speakWhen ?? 'every-turn',
        reasoningEffort: draft.reasoningEffort ?? undefined,
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

  const handleParticipantMove = React.useCallback((participantId: string, direction: -1 | 1) => {
    if (!props.conversationId)
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

  const handleParticipantLeaderChange = React.useCallback((participantId: string) => {
    if (!props.conversationId)
      return;

    setParticipants(props.conversationId, participants.map(participant =>
      participant.kind === 'assistant'
        ? { ...participant, isLeader: participant.id === participantId }
        : participant,
    ));
  }, [participants, props.conversationId, setParticipants]);

  const handleSetAllParticipantsSpeakWhen = React.useCallback((speakWhen: DConversationParticipant['speakWhen']) => {
    if (!props.conversationId)
      return;

    const nextParticipants = setAssistantParticipantsSpeakWhen(participants, speakWhen ?? 'every-turn');
    if (nextParticipants === participants)
      return;

    setParticipants(props.conversationId, nextParticipants);
    setParticipantDrafts(current => {
      const nextDrafts = { ...current };
      let hasDraftChanges = false;

      for (const participant of participants) {
        if (participant.kind !== 'assistant')
          continue;
        if (!nextDrafts[participant.id])
          continue;
        nextDrafts[participant.id] = {
          ...nextDrafts[participant.id],
          speakWhen: speakWhen ?? 'every-turn',
        };
        hasDraftChanges = true;
      }

      return hasDraftChanges ? nextDrafts : current;
    });
  }, [participants, props.conversationId, setParticipants]);

  const handleTurnTerminationModeChange = React.useCallback((_event: React.SyntheticEvent | null, value: string | null) => {
    if (!props.conversationId || (value !== 'round-robin-per-human' && value !== 'continuous' && value !== 'council'))
      return;
    setTurnTerminationMode(props.conversationId, value);
  }, [props.conversationId, setTurnTerminationMode]);

  const handleCouncilMaxRoundsDraftChange = React.useCallback((value: string) => {
    if (!/^\d*$/.test(value))
      return;

    setCouncilMaxRoundsDraft(value);
    if (!props.conversationId)
      return;

    setCouncilMaxRounds(props.conversationId, value ? Number(value) : null);
  }, [props.conversationId, setCouncilMaxRounds]);

  const handleCouncilMaxRoundsCommit = React.useCallback(() => {
    if (!props.conversationId)
      return;

    const nextCouncilMaxRounds = sanitizeCouncilMaxRounds(councilMaxRoundsDraft);
    setCouncilMaxRoundsDraft(formatCouncilMaxRoundsDraft(nextCouncilMaxRounds));
    setCouncilMaxRounds(props.conversationId, nextCouncilMaxRounds);
  }, [councilMaxRoundsDraft, props.conversationId, setCouncilMaxRounds]);

  const handleCouncilTraceAutoCollapsePreviousRoundsChange = React.useCallback((value: boolean) => {
    if (!props.conversationId)
      return;
    setCouncilTraceAutoCollapsePreviousRounds(props.conversationId, value);
  }, [props.conversationId, setCouncilTraceAutoCollapsePreviousRounds]);

  const handleCouncilTraceAutoExpandNewestRoundChange = React.useCallback((value: boolean) => {
    if (!props.conversationId)
      return;
    setCouncilTraceAutoExpandNewestRound(props.conversationId, value);
  }, [props.conversationId, setCouncilTraceAutoExpandNewestRound]);

  const handleParticipantsClose = React.useCallback(() => {
    Object.keys(participantDrafts).forEach(participantId => handleParticipantDraftCommit(participantId));
    handleCouncilMaxRoundsCommit();
    setParticipantsAnchorEl(null);
    setExpandedParticipantId(null);
  }, [handleCouncilMaxRoundsCommit, handleParticipantDraftCommit, participantDrafts]);

  const handleParticipantAdd = React.useCallback(() => {
    if (!props.conversationId || !draftPersonaId)
      return;

    const nextParticipant = createAssistantConversationParticipant(
      draftPersonaId,
      draftLlmId || null,
      generateAssistantParticipantName(draftPersonaId, assistantParticipants.map(participant => participant.name)),
    );
    if (draftCustomPrompt.trim())
      nextParticipant.customPrompt = draftCustomPrompt.trim();

    setParticipants(props.conversationId, [...participants, nextParticipant]);
    setDraftLlmId('');
    setDraftCustomPrompt('');
    setExpandedParticipantId(nextParticipant.id);
  }, [assistantParticipants, draftCustomPrompt, draftLlmId, draftPersonaId, participants, props.conversationId, setParticipants]);

  const handleSaveAgentGroup = React.useCallback(() => {
    if (!props.conversationId)
      return;

    handleCouncilMaxRoundsCommit();
    const normalizedName = agentGroupNameDraft.trim() || `Agents ${Math.max(assistantParticipants.length, 1)}`;
    const savedId = props.onConversationSaveAgentGroup(
      props.conversationId,
      normalizedName,
      agentGroupSaveMode.existingId,
    );

    if (savedId)
      setAgentGroupNameDraft(normalizedName);
  }, [agentGroupNameDraft, agentGroupSaveMode.existingId, assistantParticipants.length, handleCouncilMaxRoundsCommit, props]);

  const handleSaveAgent = React.useCallback((participant: DConversationParticipant) => {
    const participantName = participant.name.trim() || 'Untitled agent';
    const saveMode = getAgentSaveMode({
      participantName,
      savedAgents,
    });
    const savedId = saveAgent({
      name: participantName,
      participant: {
        ...participant,
        id: 'saved-agent-template',
      },
    }, saveMode.existingId);

    if (savedId) {
      addSnackbar({
        key: `agent-save-${savedId}`,
        message: saveMode.existingId ? `"${participantName}" updated.` : `"${participantName}" saved.`,
        type: 'success',
      });
    }
  }, [saveAgent, savedAgents]);

  const handleLoadAgent = React.useCallback((agentSnapshot: DAgentSnapshot) => {
    if (!props.conversationId)
      return;

    const existingAgentNames = assistantParticipants.map(participant => participant.name);
    const nextName = createUniqueAgentName(agentSnapshot.participant.name || agentSnapshot.name, existingAgentNames);
    const nextParticipant = {
      ...agentSnapshot.participant,
      id: createAssistantConversationParticipant(
        agentSnapshot.participant.personaId ?? systemPurposeId ?? 'Default',
        agentSnapshot.participant.llmId ?? null,
        nextName,
        agentSnapshot.participant.speakWhen ?? 'every-turn',
        false,
        agentSnapshot.participant.accentHue,
        agentSnapshot.participant.reasoningEffort,
      ).id,
      name: nextName,
      isLeader: false,
    } satisfies DConversationParticipant;

    setParticipants(props.conversationId, [...participants, nextParticipant]);
    setExpandedParticipantId(nextParticipant.id);
    addSnackbar({
      key: `agent-load-${agentSnapshot.id}`,
      message: `"${nextName}" loaded.`,
      type: 'success',
    });
  }, [assistantParticipants, participants, props.conversationId, setParticipants, systemPurposeId]);

  const handleDeleteSavedAgent = React.useCallback((agentSnapshot: DAgentSnapshot) => {
    deleteAgent(agentSnapshot.id);
    addSnackbar({
      key: `agent-delete-${agentSnapshot.id}`,
      message: `"${agentSnapshot.name}" deleted.`,
      type: 'success',
    });
  }, [deleteAgent]);

  const handleLoadAgentGroup = React.useCallback((agentGroupSnapshot: DAgentGroupSnapshot) => {
    if (!props.conversationId)
      return;

    const wasLoaded = props.onConversationLoadAgentGroup(props.conversationId, agentGroupSnapshot);
    if (wasLoaded) {
      setAgentGroupNameDraft(agentGroupSnapshot.name);
      setCouncilMaxRoundsDraft(formatCouncilMaxRoundsDraft(sanitizeCouncilMaxRounds(agentGroupSnapshot.councilMaxRounds)));
      setExpandedParticipantId(null);
      setParticipantDrafts({});
    }
  }, [props]);

  const saveAgentsToFile = React.useCallback(async (agentsToExport: DAgentSnapshot[], agentName?: string) => {
    const payload = buildAgentTransferFile(agentsToExport);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const exportedAtLabel = prettyTimestampForFilenames(false);

    await fileSave(blob, {
      fileName: getAgentTransferFilename({
        agentName,
        exportedAtLabel,
      }),
      extensions: ['.json'],
    }).then(() => {
      addSnackbar({
        key: agentName ? `agent-export-ok-${agentName}` : 'agents-export-ok',
        message: agentName ? `"${agentName}" exported.` : 'Agents exported.',
        type: 'success',
      });
    }).catch((error: any) => {
      if (error?.name !== 'AbortError')
        addSnackbar({
          key: agentName ? `agent-export-fail-${agentName}` : 'agents-export-fail',
          message: `Could not export ${agentName ? `"${agentName}"` : 'agents'}. ${error?.message || ''}`.trim(),
          type: 'issue',
        });
    });
  }, []);

  const handleAgentExport = React.useCallback(async (participant: DConversationParticipant) => {
    const participantName = participant.name.trim() || 'Untitled agent';
    await saveAgentsToFile([{
      id: participant.id,
      name: participantName,
      participant: {
        ...participant,
        name: participantName,
      },
      updatedAt: Date.now(),
    }], participantName);
  }, [saveAgentsToFile]);

  const handleAgentImport = React.useCallback(async (participantId: string) => {
    try {
      const file = await fileOpen({
        description: 'Agent JSON',
        mimeTypes: ['application/json'],
        extensions: ['.json'],
        multiple: false,
      });

      if (!file)
        return;

      const importedSnapshots = parseAgentTransferFile(await file.text(), 'single');
      const importedAgent = importedSnapshots[0];
      if (!importedAgent)
        return;

      handleParticipantUpdate(participantId, {
        name: importedAgent.participant.name.trim() || importedAgent.name.trim() || 'Untitled agent',
        personaId: importedAgent.participant.personaId,
        llmId: importedAgent.participant.llmId ?? null,
        accentHue: importedAgent.participant.accentHue,
        customPrompt: importedAgent.participant.customPrompt?.trim() || undefined,
        speakWhen: importedAgent.participant.speakWhen ?? 'every-turn',
        reasoningEffort: importedAgent.participant.reasoningEffort,
      });
      setParticipantDrafts(currentDrafts => {
        if (!(participantId in currentDrafts))
          return currentDrafts;
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[participantId];
        return nextDrafts;
      });
      addSnackbar({
        key: `agent-import-ok-${participantId}`,
        message: `"${importedAgent.name.trim() || importedAgent.participant.name.trim() || 'Agent'}" imported.`,
        type: 'success',
      });
    } catch (error: any) {
      if (error?.name !== 'AbortError')
        addSnackbar({ key: `agent-import-fail-${participantId}`, message: `Could not import agent. ${error?.message || ''}`.trim(), type: 'issue' });
    }
  }, [handleParticipantUpdate]);

  const saveAgentGroupsToFile = React.useCallback(async (groupsToExport: DAgentGroupSnapshot[], groupName?: string) => {
    const payload = buildAgentGroupTransferFile(groupsToExport);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const exportedAtLabel = prettyTimestampForFilenames(false);

    await fileSave(blob, {
      fileName: getAgentGroupTransferFilename({
        groupName,
        exportedAtLabel,
      }),
      extensions: ['.json'],
    }).then(() => {
      addSnackbar({
        key: groupName ? `agent-group-export-ok-${groupName}` : 'agent-groups-export-ok',
        message: groupName ? `"${groupName}" exported.` : 'Agent groups exported.',
        type: 'success',
      });
    }).catch((error: any) => {
      if (error?.name !== 'AbortError')
        addSnackbar({
          key: groupName ? `agent-group-export-fail-${groupName}` : 'agent-groups-export-fail',
          message: `Could not export ${groupName ? `"${groupName}"` : 'agent groups'}. ${error?.message || ''}`.trim(),
          type: 'issue',
        });
    });
  }, []);

  const handleAgentGroupsExport = React.useCallback(async () => {
    await saveAgentGroupsToFile(savedAgentGroups);
  }, [saveAgentGroupsToFile, savedAgentGroups]);

  const handleAgentGroupExport = React.useCallback(async (group: DAgentGroupSnapshot) => {
    await saveAgentGroupsToFile([group], group.name);
  }, [saveAgentGroupsToFile]);

  const handleAgentGroupsImport = React.useCallback(async (mode: 'single' | 'all') => {
    try {
      const file = await fileOpen({
        description: mode === 'single' ? 'Agent Group JSON' : 'Agent Groups JSON',
        mimeTypes: ['application/json'],
        extensions: ['.json'],
        multiple: false,
      });

      if (!file)
        return;

      const importedSnapshots = parseAgentGroupTransferFile(await file.text(), mode);
      const importedCount = importAgentGroups(importedSnapshots);
      addSnackbar({
        key: 'agent-groups-import-ok',
        message: importedCount === 1 ? '1 agent group imported.' : `${importedCount} agent groups imported.`,
        type: 'success',
      });
    } catch (error: any) {
      if (error?.name !== 'AbortError')
        addSnackbar({ key: 'agent-groups-import-fail', message: `Could not import agent groups. ${error?.message || ''}`.trim(), type: 'issue' });
    }
  }, [importAgentGroups]);

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
      Agents {assistantParticipants.length > 1 ? assistantParticipants.length : ''}{leaderParticipant ? ` · Leader ${leaderParticipant.name}` : ''}
    </Button>
    <Chip
      size='sm'
      variant='soft'
      color={assistantSpeakWhenSummary.key === 'mixed' ? 'warning' : 'neutral'}
      sx={{ maxWidth: { xs: '10rem', md: 'none' } }}
    >
      {assistantSpeakWhenSummary.label}
    </Chip>
    <Chip
      size='sm'
      variant='soft'
      color={activeTurnModeColor}
      sx={{ maxWidth: { xs: '9rem', md: 'none' } }}
    >
      {activeTurnMode.title}
    </Chip>
    <CloseablePopup
      anchorEl={participantsAnchorEl}
      onClose={handleParticipantsClose}
      noAutoFocus
      placement='bottom-start'
      maxWidth={700}
      minWidth={460}
      sx={{
        p: 1.25,
        display: 'grid',
        gap: 1.25,
        borderRadius: '24px',
        border: '1px solid',
        borderColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.16)',
        backgroundImage: 'linear-gradient(180deg, rgba(var(--joy-palette-primary-mainChannel) / 0.06) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.04) 48%, rgba(var(--joy-palette-neutral-mainChannel) / 0.02) 100%)',
        boxShadow: 'lg',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          p: 1.2,
          borderRadius: '20px',
          background: 'linear-gradient(180deg, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.04) 52%, rgba(var(--joy-palette-neutral-mainChannel) / 0.02) 100%)',
          border: '1px solid',
          borderColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.12)',
          boxShadow: 'sm',
        }}
      >
        <Stack direction='row' spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Stack spacing={0.45} sx={{ minWidth: 0 }}>
            <Stack direction='row' spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography level='title-md' sx={{ letterSpacing: '-0.01em' }}>Agents</Typography>
              <Chip
                size='sm'
                variant='soft'
                color='neutral'
                sx={{
                  borderRadius: '999px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.08)',
                }}
              >
                {assistantParticipants.length} configured
              </Chip>
              {activeSavedAgentGroup && (
                <Chip
                  size='sm'
                  variant='soft'
                  color='primary'
                  sx={{ borderRadius: '999px', maxWidth: '16rem' }}
                >
                  Active group: {activeSavedAgentGroup.name}
                </Chip>
              )}
            </Stack>
            <Typography level='body-sm' sx={{ color: 'text.tertiary' }}>
              Responsive roster layout{leaderParticipant ? ` · leader ${leaderParticipant.name}` : ''}
            </Typography>
          </Stack>
          <Stack
            direction='row'
            spacing={0.75}
            sx={{
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              rowGap: 0.75,
            }}
          >
            <Dropdown>
              <MenuButton
                slots={{ root: Button }}
                slotProps={{ root: {
                  size: 'sm',
                  variant: 'soft',
                  color: 'neutral',
                  disabled: !sortedSavedAgents.length,
                  endDecorator: <KeyboardArrowDownIcon />,
                  sx: agentsToolbarButtonSx,
                } }}
              >
                Load Agent
              </MenuButton>
              <Menu placement='bottom-end' sx={{ minWidth: 260, maxHeight: 320, overflow: 'auto' }}>
                {!sortedSavedAgents.length ? (
                  <MenuItem disabled>No saved agents yet</MenuItem>
                ) : sortedSavedAgents.map(agent => (
                  <MenuItem key={agent.id} onClick={() => handleLoadAgent(agent)} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography level='body-sm' noWrap>{agent.name}</Typography>
                      <Typography level='body-xs' sx={{ color: 'text.tertiary' }} noWrap>
                        {agent.participant.personaId ?? 'No persona'} · {agent.participant.llmId ?? 'Chat model'}
                      </Typography>
                    </Box>
                    <IconButton
                      aria-label='Delete'
                      size='sm'
                      variant='plain'
                      color='neutral'
                      onClick={joyKeepPopup((event) => {
                        event.stopPropagation();
                        handleDeleteSavedAgent(agent);
                      })}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </MenuItem>
                ))}
              </Menu>
            </Dropdown>
            <Dropdown>
              <MenuButton
                slots={{ root: Button }}
                slotProps={{ root: {
                  size: 'sm',
                  variant: 'soft',
                  color: 'neutral',
                  disabled: !sortedSavedAgentGroups.length,
                  endDecorator: <KeyboardArrowDownIcon />,
                  sx: agentsToolbarButtonSx,
                } }}
              >
                Load Group
              </MenuButton>
              <Menu placement='bottom-end' sx={{ minWidth: 260, maxHeight: 320, overflow: 'auto' }}>
                {!sortedSavedAgentGroups.length ? (
                  <MenuItem disabled>No saved groups yet</MenuItem>
                ) : sortedSavedAgentGroups.map(group => (
                  <MenuItem key={group.id} onClick={() => handleLoadAgentGroup(group)} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography level='body-sm' noWrap>{group.name}</Typography>
                    </Box>
                    <Button
                      size='sm'
                      variant='plain'
                      color='neutral'
                      onClick={event => {
                        event.stopPropagation();
                        void handleAgentGroupExport(group);
                      }}
                    >
                      Export
                    </Button>
                  </MenuItem>
                ))}
              </Menu>
            </Dropdown>
            <Dropdown>
              <MenuButton
                slots={{ root: Button }}
                slotProps={{ root: {
                  size: 'sm',
                  variant: 'soft',
                  color: 'neutral',
                  disabled: !savedAgentGroups.length,
                  startDecorator: <FileDownloadOutlinedIcon />,
                  endDecorator: <KeyboardArrowDownIcon />,
                  sx: agentsToolbarButtonSx,
                } }}
              >
                Export
              </MenuButton>
              <Menu placement='bottom-end' sx={{ minWidth: 220 }}>
                <MenuItem
                  disabled={!activeSavedAgentGroup}
                  onClick={() => activeSavedAgentGroup && void handleAgentGroupExport(activeSavedAgentGroup)}
                >
                  Export current group
                </MenuItem>
                <MenuItem onClick={handleAgentGroupsExport}>
                  Export all groups
                </MenuItem>
              </Menu>
            </Dropdown>
            <Dropdown>
              <MenuButton
                slots={{ root: Button }}
                slotProps={{ root: {
                  size: 'sm',
                  variant: 'soft',
                  color: 'neutral',
                  startDecorator: <FileUploadOutlinedIcon />,
                  endDecorator: <KeyboardArrowDownIcon />,
                  sx: agentsToolbarButtonSx,
                } }}
              >
                Import
              </MenuButton>
              <Menu placement='bottom-end' sx={{ minWidth: 220 }}>
                <MenuItem onClick={() => handleAgentGroupsImport('single')}>Import 1 group</MenuItem>
                <MenuItem onClick={() => handleAgentGroupsImport('all')}>Import all groups</MenuItem>
              </Menu>
            </Dropdown>
            <Button
              size='sm'
              variant='soft'
              color='primary'
              disabled={!props.conversationId}
              onClick={handleSaveAgentGroup}
              sx={agentsToolbarPrimaryButtonSx}
            >
              {agentGroupSaveMode.buttonLabel}
            </Button>
            <Button
              size='sm'
              variant='soft'
              color='danger'
              disabled={!assistantParticipants.length}
              onClick={handleClearAgents}
              sx={agentsToolbarDangerButtonSx}
            >
              Clear agents
            </Button>
          </Stack>
        </Stack>

        <ChatBarChatSettingsPanel
          agentGroupNameDraft={agentGroupNameDraft}
          onAgentGroupNameDraftChange={setAgentGroupNameDraft}
          turnTerminationMode={turnTerminationMode}
          onTurnTerminationModeChange={handleTurnTerminationModeChange}
          councilMaxRoundsDraft={councilMaxRoundsDraft}
          onCouncilMaxRoundsDraftChange={handleCouncilMaxRoundsDraftChange}
          onCouncilMaxRoundsCommit={handleCouncilMaxRoundsCommit}
          councilTraceAutoCollapsePreviousRounds={councilTraceAutoCollapsePreviousRounds}
          onCouncilTraceAutoCollapsePreviousRoundsChange={handleCouncilTraceAutoCollapsePreviousRoundsChange}
          councilTraceAutoExpandNewestRound={councilTraceAutoExpandNewestRound}
          onCouncilTraceAutoExpandNewestRoundChange={handleCouncilTraceAutoExpandNewestRoundChange}
          canBulkSetSpeakWhen={!!assistantParticipants.length}
          canSetAllParticipantsEveryTurn={!allAssistantsEveryTurn}
          canSetAllParticipantsOnlyMention={!allAssistantsOnlyMention}
          onSetAllParticipantsEveryTurn={() => handleSetAllParticipantsSpeakWhen('every-turn')}
          onSetAllParticipantsOnlyMention={() => handleSetAllParticipantsSpeakWhen('when-mentioned')}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.1,
          gridTemplateColumns: participantRosterGridTemplateColumns,
          alignItems: 'start',
        }}
      >
        {assistantParticipants.map((participant, index) => {
          const personaTitle = participant.personaId ? SystemPurposes[participant.personaId]?.title ?? participant.personaId : 'No persona';
          const participantLlm = participant.llmId ? visibleLLMs.find(llm => llm.id === participant.llmId) ?? null : null;
          const llmLabel = participantLlm ? getLLMLabel(participantLlm) : participant.llmId ?? 'Chat model';
          const reasoningLabel = participant.reasoningEffort ? PARTICIPANT_REASONING_EFFORT_META[participant.reasoningEffort].label : null;
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
          const effectiveParticipantLlmId = llmDraftValue || chatLLMId || null;
          const effectiveParticipantLlm = effectiveParticipantLlmId
            ? visibleLLMs.find(llm => llm.id === effectiveParticipantLlmId) ?? null
            : null;
          const participantReasoningConfig = getParticipantReasoningEffortOptions(effectiveParticipantLlm);
          const reasoningEffortDraftRaw = participantDraft?.reasoningEffort ?? participant.reasoningEffort ?? null;
          const {
            selectValue: reasoningEffortDraftValue,
            helperText: reasoningEffortHelperText,
            modelSettingLabel: reasoningEffortModelSettingLabel,
          } = getParticipantReasoningEffortSelectState({
            llm: effectiveParticipantLlm,
            parameterId: participantReasoningConfig.parameterId,
            options: participantReasoningConfig.options,
            selectedReasoningEffort: reasoningEffortDraftRaw,
          });
          const agentSaveMode = getAgentSaveMode({
            participantName: aliasDraft.trim() || participant.name,
            savedAgents,
          });
          const participantAccentColor = getParticipantAccentColor(participant.name, assistantParticipants);
          const participantAccentSoftSx = getParticipantAccentSx(participant.name, assistantParticipants, 'soft');
          const participantAccentOutlinedSx = getParticipantAccentSx(participant.name, assistantParticipants, 'outlined') as React.CSSProperties;
          return (
            <Box
              key={participant.id}
              draggable
              onDragStart={(event) => handleParticipantDragStart(event, participant.id)}
              onDragOver={(event) => handleParticipantDragOver(event, participant.id)}
              onDrop={(event) => handleParticipantDrop(event, participant.id)}
              onDragEnd={handleParticipantDragEnd}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                display: 'grid',
                gap: 0.95,
                minWidth: 0,
                p: 1.1,
                borderRadius: '20px',
                gridColumn: isExpanded ? '1 / -1' : 'auto',
                border: '1px solid',
                borderColor: isExpanded
                  ? participantAccentOutlinedSx.borderColor ?? `${participantAccentColor}.outlinedBorder`
                  : 'rgba(var(--joy-palette-neutral-mainChannel) / 0.12)',
                background: isExpanded
                  ? `linear-gradient(180deg, rgba(var(--joy-palette-${participantAccentColor}-mainChannel) / 0.12) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.035) 52%, rgba(var(--joy-palette-neutral-mainChannel) / 0.015) 100%)`
                  : `linear-gradient(180deg, rgba(var(--joy-palette-${participantAccentColor}-mainChannel) / 0.08) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.03) 54%, rgba(var(--joy-palette-neutral-mainChannel) / 0.01) 100%)`,
                boxShadow: isExpanded ? 'md' : 'xs',
                transition: 'box-shadow 140ms ease, border-color 140ms ease, background 140ms ease, transform 140ms ease',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '0 auto auto 0',
                  width: '100%',
                  height: '1px',
                  background: `linear-gradient(90deg, rgba(var(--joy-palette-${participantAccentColor}-mainChannel) / 0.7), transparent 75%)`,
                  opacity: isExpanded ? 1 : 0.85,
                  pointerEvents: 'none',
                },
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: 'md',
                  borderColor: isExpanded
                    ? participantAccentOutlinedSx.borderColor ?? `${participantAccentColor}.outlinedBorder`
                    : 'rgba(var(--joy-palette-neutral-mainChannel) / 0.22)',
                },
              }}
            >
              <Stack direction='row' spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip
                  size='sm'
                  variant='soft'
                  color='neutral'
                  sx={{
                    minWidth: 34,
                    justifyContent: 'center',
                    fontVariantNumeric: 'tabular-nums',
                    borderRadius: '999px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.1)',
                    boxShadow: 'xs',
                  }}
                >
                  {index + 1}
                </Chip>

                <Box
                  onClick={() => handleExpandedParticipantChange(participant.id)}
                  sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                >
                  <Stack direction='row' spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                    <Typography level='title-sm' sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>{participant.name}</Typography>
                    {participant.isLeader && <Chip size='sm' variant='solid' color={participantAccentColor}>Leader</Chip>}
                    {isExpanded && !participant.isLeader && (
                      <Button
                        size='sm'
                        variant='soft'
                        color='primary'
                        onClick={(event) => {
                          event.stopPropagation();
                          handleParticipantLeaderChange(participant.id);
                        }}
                      >
                        Make Leader
                      </Button>
                    )}
                    <Chip
                      size='sm'
                      variant='soft'
                      color={participantAccentColor}
                      sx={{
                        ...participantAccentSoftSx,
                        borderRadius: '999px',
                        fontWeight: 600,
                      }}
                    >
                      {summaryLabel}
                    </Chip>
                    {participantStatus?.isNextToSpeak && <Chip size='sm' variant='soft' color='primary'>Next</Chip>}
                    {participantStatus?.spokeThisTurn && <Chip size='sm' variant='soft' color='success'>Done</Chip>}
                    {participantStatus?.spokeLast && <Chip size='sm' variant='soft'>Latest</Chip>}
                    {participantStatus?.wasMentioned && <Chip size='sm' variant='soft' color='primary'>@mentioned</Chip>}
                    {hasCustomPrompt && <Chip size='sm' variant='soft' color='warning'>Custom prompt</Chip>}
                  </Stack>

                  <Typography level='body-sm' sx={{ color: 'text.secondary', mt: 0.45, fontWeight: 600 }}>
                    {personaTitle}
                  </Typography>
                  <Typography level='body-xs' sx={{ color: 'text.tertiary', mt: 0.15 }}>
                    {llmLabel}{reasoningLabel ? ` · ${reasoningLabel}` : ''}
                  </Typography>
                  <Typography
                    level='body-xs'
                    sx={{
                      color: participantStatus?.isNextToSpeak ? 'primary.600' : 'text.tertiary',
                      mt: 0.3,
                      fontWeight: participantStatus?.isNextToSpeak ? 700 : 500,
                    }}
                  >
                    {participantStatus?.reason ?? 'Ready'}
                  </Typography>
                </Box>

                <Stack direction='row' spacing={0.25} sx={{ alignItems: 'center' }}>
                  {isExpanded && (
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
                  )}
                  <Button
                    size='sm'
                    variant={isExpanded ? 'soft' : 'plain'}
                    color={isExpanded ? participantAccentColor : 'neutral'}
                    sx={{
                      borderRadius: '999px',
                      px: 1.1,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
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
                  <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: participantEditorGridTemplateColumns, minWidth: 0 }}>
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
                      onChange={(_event, value) => {
                        const nextLlmId = ((value as string | null) || null);
                        const nextLlm = (nextLlmId || chatLLMId)
                          ? visibleLLMs.find(llm => llm.id === (nextLlmId || chatLLMId)) ?? null
                          : null;
                        const nextReasoningConfig = getParticipantReasoningEffortOptions(nextLlm);
                        const currentReasoningEffort = participantDraft?.reasoningEffort ?? participant.reasoningEffort;
                        handleParticipantDraftChange(participant.id, {
                          llmId: nextLlmId,
                          ...(currentReasoningEffort && !nextReasoningConfig.options.some(option => option.value === currentReasoningEffort)
                            ? { reasoningEffort: undefined }
                            : {}),
                        });
                      }}
                    >
                      <Option value={''}>Current chat model</Option>
                      {visibleLLMs.map(llm => (
                        <Option key={llm.id} value={llm.id}>{getLLMLabel(llm)}</Option>
                      ))}
                    </Select>

                    <Select
                      size='sm'
                      value={speakWhenDraftValue}
                      sx={{ gridColumn: participantEditorSpeakWhenGridColumn }}
                      onChange={(_event, value) => handleParticipantDraftChange(participant.id, { speakWhen: ((value as DConversationParticipant['speakWhen'] | null) ?? 'every-turn') })}
                    >
                      <Option value='every-turn'>Every turn</Option>
                      <Option value='when-mentioned'>Only @mentioned</Option>
                    </Select>

                    <FormControl size='sm' sx={{ minWidth: 0 }}>
                      <FormLabel sx={{ gap: 0.5 }}>
                        {participantReasoningConfig.parameterLabel}
                        <InfoOutlinedIcon
                          sx={{ fontSize: 'md', color: 'text.tertiary' }}
                          titleAccess='Controls how much effort the model spends on reasoning'
                        />
                      </FormLabel>
                      <FormHelperText sx={{ minHeight: '2em' }}>
                        {reasoningEffortHelperText}
                      </FormHelperText>
                      <Select
                        size='sm'
                        value={reasoningEffortDraftValue}
                        onChange={(_event, value) => handleParticipantDraftChange(participant.id, {
                          reasoningEffort: value === PARTICIPANT_REASONING_MODEL_SETTING_VALUE
                            ? undefined
                            : (value as DConversationParticipant['reasoningEffort'] | null) ?? undefined,
                        })}
                        disabled={!participantReasoningConfig.parameterId}
                      >
                        <Option value={PARTICIPANT_REASONING_MODEL_SETTING_VALUE}>Use model setting ({reasoningEffortModelSettingLabel})</Option>
                        {participantReasoningConfig.options.map(option => (
                          <Option key={option.value} value={option.value}>{option.label}</Option>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  {isCustomPersonaSelected && <Input
                    size='sm'
                    value={customPromptDraft}
                    onChange={(event) => handleParticipantDraftChange(participant.id, { customPrompt: event.target.value })}
                    onBlur={() => handleParticipantDraftCommit(participant.id)}
                    placeholder='Optional custom prompt/persona instructions'
                  />}

                  <Stack direction='row' spacing={0.25} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Button
                        size='sm'
                        variant='soft'
                        color='neutral'
                        onClick={() => handleSaveAgent({
                          ...participant,
                          name: aliasDraft.trim() || participant.name,
                          personaId: personaDraftValue ?? null,
                          llmId: llmDraftValue || null,
                          customPrompt: customPromptDraft.trim() || undefined,
                          speakWhen: speakWhenDraftValue ?? 'every-turn',
                          reasoningEffort: reasoningEffortDraftRaw ?? undefined,
                        })}
                      >
                        {agentSaveMode.buttonLabel}
                      </Button>
                      <Button
                        size='sm'
                        variant='plain'
                        color='neutral'
                        onClick={() => void handleAgentExport({
                          ...participant,
                          name: aliasDraft.trim() || participant.name,
                          personaId: personaDraftValue ?? null,
                          llmId: llmDraftValue || null,
                          customPrompt: customPromptDraft.trim() || undefined,
                          speakWhen: speakWhenDraftValue ?? 'every-turn',
                          reasoningEffort: reasoningEffortDraftRaw ?? undefined,
                        })}
                        startDecorator={<FileDownloadOutlinedIcon />}
                      >
                        Export Agent
                      </Button>
                      <Button
                        size='sm'
                        variant='plain'
                        color='neutral'
                        onClick={() => void handleAgentImport(participant.id)}
                        startDecorator={<FileUploadOutlinedIcon />}
                      >
                        Import Agent
                      </Button>
                      <IconButton size='sm' variant='plain' disabled={index === 0} onClick={() => handleParticipantMove(participant.id, -1)}>
                        <ArrowUpwardIcon />
                      </IconButton>
                      <IconButton size='sm' variant='plain' disabled={index === assistantParticipants.length - 1} onClick={() => handleParticipantMove(participant.id, 1)}>
                        <ArrowDownwardIcon />
                      </IconButton>
                  </Stack>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 0.75,
          p: 1.05,
          borderRadius: '20px',
          border: '1px dashed',
          borderColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.18)',
          background: 'linear-gradient(180deg, rgba(var(--joy-palette-success-mainChannel) / 0.06) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.025) 100%)',
        }}
      >
        <Typography level='body-sm'>Add another agent</Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 0.75,
            gridTemplateColumns: {
              xs: '1fr',
              md: isDraftCustomPersonaSelected
                ? 'minmax(10rem, 1fr) minmax(10rem, 1fr) minmax(14rem, 1.4fr) auto'
                : 'minmax(10rem, 1fr) minmax(10rem, 1fr) auto',
            },
          }}
        >
          <Select
            placeholder='Persona'
            value={draftPersonaId || null}
            onChange={(_event, value) => {
              const nextPersonaId = (value as SystemPurposeId | null) ?? '';
              setDraftPersonaId(nextPersonaId);
              if (nextPersonaId !== 'Custom')
                setDraftCustomPrompt('');
            }}
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
              <Option key={llm.id} value={llm.id}>{getLLMLabel(llm)}</Option>
            ))}
          </Select>

          {isDraftCustomPersonaSelected && (
            <Input
              size='sm'
              value={draftCustomPrompt}
              onChange={(event) => setDraftCustomPrompt(event.target.value)}
              placeholder='Optional custom prompt/persona instructions'
            />
          )}

          <Button size='sm' onClick={handleParticipantAdd} disabled={!draftPersonaId} startDecorator={<SmartToyOutlinedIcon />}>
            Add agent
          </Button>
        </Box>
        <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
          {selectedParticipantLlm
            ? `New agent uses ${getLLMLabel(selectedParticipantLlm)}.${selectedParticipantReasoningConfig.parameterId ? ` ${selectedParticipantReasoningConfig.parameterLabel} can be set after adding.` : ''}`
            : 'New agent uses the current chat model.'}
        </Typography>
      </Box>
    </CloseablePopup>

    {/* Folder selector */}
    {folderDropdown}

  </>;
}
