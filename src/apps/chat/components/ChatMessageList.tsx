import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Chip, List, ListItem } from '@mui/joy';

import type { SystemPurposeExample, SystemPurposeId } from '../../../data';

import type { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';
import { speakText } from '~/modules/speex/speex.client';

import type { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import type { DLLMContextTokens } from '~/common/stores/llms/llms.types';
import { getLLMLabel } from '~/common/stores/llms/llms.types';
import { useVisibleLLMs } from '~/common/stores/llms/llms.hooks';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';
import { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DConversationParticipant, DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import { PerfProfiler } from '~/common/components/perf/PerfProfiler';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { clipboardInterceptCtrlCForCleanup } from '~/common/util/clipboardUtils';
import { convertFilesToDAttachmentFragments } from '~/common/attachment-drafts/attachment.pipeline';
import { createDMessageFromFragments, createDMessageTextContent, DMessage, DMessageId, DMessageMetadata, DMessageUserFlag, DMetaReferenceItem, duplicateDMessageMetadata, MESSAGE_FLAG_AIX_SKIP, messageHasUserFlag } from '~/common/stores/chat/chat.message';
import { createTextContentFragment, DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { openFileForAttaching } from '~/common/components/ButtonAttachFiles';
import { optimaOpenPreferences } from '~/common/layout/optima/useOptima';
import { useChatOverlayStore } from '~/common/chat-overlay/store-perchat_vanilla';
import type { DAgentGroupSnapshot } from '~/common/stores/chat/store-chat-agent-groups';
import {
  getConversationCouncilTraceAutoCollapsePreviousRounds,
  getConversationCouncilTraceAutoExpandNewestRound,
  useChatStore,
} from '~/common/stores/chat/store-chats';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';
import { getParticipantAccentColor } from '~/common/util/dMessageUtils';
import { perfMeasureSync } from '~/common/util/perfRegistry';

import { CMLZeroConversation } from './messages-list/CMLZeroConversation';
import {
  getChatMessageListContainerSx,
  getChatMessageListConversationOverlayMode,
  getChatMessageListMinimapOverlaySx,
  shouldShowConversationMinimapTrack,
} from './ChatMessageList.layout';
import { ConversationMinimap } from './ConversationMinimap';
import { getCouncilGroupLabel, getNextAutoExpandedCouncilGroupKeys } from './ChatMessageList.council';
import { buildCouncilTraceRenderPlan } from './ChatMessageList.councilTrace';
import {
  countVisibleRenderEntryUnits,
  type CouncilGroupEntry,
  type CouncilTraceVisibleEntry,
  type GroupedVisibleEntry,
  type GroupedVisibleRenderEntry,
  type MessageDecoratorKind,
  type RenderedGroupMessageEntry,
  sliceVisibleRenderEntriesFromEnd,
  type VisibleRenderEntry,
} from './ChatMessageList.windowing';
import { getCouncilVisibleMessages } from './ChatMessageList.visibility';
import { ChatMessage, ChatMessageMemo } from './message/ChatMessage';
import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';
import { CouncilTraceMessage } from './message/CouncilTraceMessage';
import { Ephemerals } from './Ephemerals';
import { PersonaSelector } from './persona-selector/PersonaSelector';
import { useChatAutoSuggestHTMLUI, useChatShowConversationMinimap, useChatShowSystemMessages } from '../store-app-chat';
import type { DEphemeral } from '~/common/chat-overlay/store-perchat-ephemerals_slice';


const stableNoMessages: DMessage[] = [];
const stableNoParticipants: DConversationParticipant[] = [];
const stableNoRenderEntries: GroupedVisibleRenderEntry[] = [];
const stableNoVisibleEntries = [] as VisibleRenderEntry[];
const stableNoGroupMessages: RenderedGroupMessageEntry[] = [];
const stableNoCouncilTracePlan = { traceItem: null, showLegacyDeliberationToggle: false } as const;
const stableNoEphemerals = [] as DEphemeral[];
const publicBoardChannel = { channel: 'public-board' } as const;
const INITIAL_VISIBLE_ENTRY_UNITS = 48;
const councilGroupBoxSx = { display: 'grid', gap: 1, px: 2, pt: 0.5, pb: 0.75 } as const;
const councilGroupHeaderSx = { display: 'flex', justifyContent: 'center' } as const;
const councilGroupHeaderControlsSx = { display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'center' } as const;
const councilGroupColumnsSx = {
  display: 'grid',
  gap: 1,
  alignItems: 'start',
} as const;
const councilMessageColumnBaseSx = {
  minWidth: 0,
  borderRadius: 'lg',
  border: '1px solid',
  backgroundColor: 'background.surface',
  overflow: 'hidden',
} as const;

export function getRestartInCouncilMessageMetadata(
  metadata?: Readonly<DMessageMetadata>,
  leaderParticipantId?: string | null,
): DMessageMetadata {
  return {
    ...(metadata ? duplicateDMessageMetadata(metadata) : {}),
    councilChannel: { channel: 'public-board' },
    initialRecipients: leaderParticipantId
      ? [{ rt: 'participant', participantId: leaderParticipantId }]
      : [{ rt: 'public-board' }],
  };
}

export function getRestartToCouncilMessageMetadata(
  metadata?: Readonly<DMessageMetadata>,
): DMessageMetadata {
  return {
    ...(metadata ? duplicateDMessageMetadata(metadata) : {}),
    councilChannel: { channel: 'public-board' },
    initialRecipients: [{ rt: 'public-board' }],
  };
}

export function getRenderableConversationParticipants(params: {
  conversationId: DConversationId | null;
  participants: DConversationParticipant[] | null | undefined;
  userSymbol?: string | null;
  systemPurposeId?: SystemPurposeId | null;
}): DConversationParticipant[] {
  const { conversationId, participants, userSymbol, systemPurposeId } = params;

  if (!participants?.length) {
    if (!conversationId || !systemPurposeId)
      return stableNoParticipants;

    return [
      {
        id: `human:${conversationId}`,
        kind: 'human',
        name: userSymbol || 'You',
        personaId: null,
        llmId: null,
      },
      {
        id: `assistant:${conversationId}`,
        kind: 'assistant',
        name: systemPurposeId,
        personaId: systemPurposeId,
        llmId: null,
        speakWhen: 'every-turn',
        isLeader: true,
      },
    ];
  }

  let requiresNormalization = false;
  let sawAssistant = false;

  for (const participant of participants) {
    if (participant.kind === 'assistant') {
      sawAssistant = true;
      if (participant.speakWhen !== 'every-turn' && participant.speakWhen !== 'when-mentioned') {
        requiresNormalization = true;
        break;
      }
      continue;
    }

    if (sawAssistant) {
      requiresNormalization = true;
      break;
    }
  }

  if (!requiresNormalization)
    return participants;

  return participants
    .map<DConversationParticipant>(participant => participant.kind === 'assistant'
      ? {
        ...participant,
        speakWhen: participant.speakWhen === 'when-mentioned' ? 'when-mentioned' : 'every-turn',
      }
      : participant,
    )
    .sort((a, b) => {
      if (a.kind !== b.kind)
        return a.kind === 'human' ? -1 : 1;
      return 0;
    });
}

export function getSingleAgentHumanDrivenParticipantNameOverrides(params: {
  participants: readonly DConversationParticipant[];
  turnTerminationMode: 'round-robin-per-human' | 'continuous' | 'council';
  llmLabelsById: ReadonlyMap<string, string>;
  chatModelLabel: string;
}): {
  displayNamesById: ReadonlyMap<string, string>;
} {
  if (params.turnTerminationMode !== 'round-robin-per-human')
    return { displayNamesById: new Map() };

  const assistantParticipants = params.participants.filter(participant => participant.kind === 'assistant');
  if (assistantParticipants.length !== 1)
    return { displayNamesById: new Map() };

  const participant = assistantParticipants[0];
  if (!participant)
    return { displayNamesById: new Map() };

  const modelLabel = participant.llmId
    ? params.llmLabelsById.get(participant.llmId) ?? participant.llmId
    : params.chatModelLabel;
  const displayName = modelLabel.trim();

  if (!displayName || displayName === participant.name.trim())
    return { displayNamesById: new Map() };

  return {
    displayNamesById: new Map([[participant.id, displayName]]),
  };
}

function normalizeMessageChannel(message: DMessage) {
  const channel = message.metadata?.councilChannel;
  return channel?.channel === 'system' ? channel : publicBoardChannel;
}

function getCouncilMessageGroupLabel(messages: DMessage[]): string {
  if (!messages.length)
    return '';
  const passIndex = messages[0]?.metadata?.council?.passIndex ?? 0;
  return getCouncilGroupLabel(passIndex);
}

function groupVisibleCouncilMessages(messages: DMessage[]): GroupedVisibleEntry[] {
  const grouped: GroupedVisibleEntry[] = [];

  for (const message of messages) {
    const council = message.metadata?.council;
    if (council?.kind === 'deliberation' && typeof council.passIndex === 'number') {
      const lastEntry = grouped[grouped.length - 1];
      if (lastEntry?.kind === 'group') {
        const lastPassIndex = lastEntry.messages[0]?.metadata?.council?.passIndex;
        if (lastPassIndex === council.passIndex) {
          lastEntry.messages.push(message);
          continue;
        }
      }

      grouped.push({
        kind: 'group',
        key: `council-pass-${council.phaseId}-${council.passIndex}`,
        label: getCouncilMessageGroupLabel([message]),
        messages: [message],
        passIndex: council.passIndex,
      });
      continue;
    }

    grouped.push({ kind: 'message', key: message.id, message });
  }

  return grouped;
}

function areRenderedGroupMessagesEqual(prev: ReadonlyArray<RenderedGroupMessageEntry>, next: ReadonlyArray<RenderedGroupMessageEntry>): boolean {
  if (prev === next)
    return true;
  if (prev.length !== next.length)
    return false;
  for (let index = 0; index < prev.length; index++) {
    const prevEntry = prev[index];
    const nextEntry = next[index];
    if (!prevEntry || !nextEntry)
      return false;
    if (prevEntry.message !== nextEntry.message
      || prevEntry.topDecoratorKind !== nextEntry.topDecoratorKind
      || prevEntry.topDecoratorCompact !== nextEntry.topDecoratorCompact
      || prevEntry.topDecoratorFirst !== nextEntry.topDecoratorFirst)
      return false;
  }
  return true;
}

const CouncilGroupEntryView = React.memo(function CouncilGroupEntryView(props: {
  entry: CouncilGroupEntry & { renderedMessages: RenderedGroupMessageEntry[] };
  isExpanded: boolean;
  onToggleExpanded: (groupKey: string) => void;
  isMessageSelectionMode: boolean;
  historyTokenCount: number;
  remainingTokens: number | undefined;
  selectedMessages: Set<string>;
  handleSelectMessage: (messageId: DMessageId, selected: boolean) => void;
  fitScreen: boolean;
  hasInReferenceTo: boolean;
  isMobile: boolean;
  isImagining: boolean;
  isSpeaking: boolean;
  showAntPromptCaching: boolean;
  showUnsafeHtmlCode: boolean;
  composerCanAddInReferenceTo: boolean;
  handleAddInReferenceTo?: (item: DMetaReferenceItem) => void;
  handleMessageAssistantFrom: (messageId: DMessageId, offset: number) => Promise<void>;
  handleMessageAssistantFromInCouncil: (messageId: DMessageId, offset: number) => Promise<void>;
  handleMessageAssistantToCouncil: (messageId: DMessageId, offset: number) => Promise<void>;
  handleMessageUpstreamResume: (messageId: DMessageId) => Promise<void>;
  handleMessageBeam: (messageId: DMessageId) => Promise<void>;
  handleMessageBranch: (messageId: DMessageId) => void;
  handleMessageContinue: (_messageId: DMessageId, continueText: null | string) => Promise<void>;
  handleMessageDelete: (messageId: DMessageId) => void;
  handleMessageAppendFragment: (messageId: DMessageId, fragment: DMessageFragment) => void;
  handleMessageDeleteFragment: (messageId: DMessageId, fragmentId: DMessageFragmentId) => void;
  handleMessageReplaceFragment: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void;
  handleMessageToggleUserFlag: (messageId: DMessageId, userFlag: DMessageUserFlag, _maxPerConversation?: number) => void;
  handleMessageTruncate: (messageId: DMessageId) => void;
  handleTextDiagram: (messageId: DMessageId, text: string) => Promise<void>;
  handleTextImagine?: (text: string) => Promise<void>;
  handleTextSpeak: (text: string) => Promise<void>;
  handleAppendMention: (mentionText: string) => void;
  participants: DConversationParticipant[];
  participantDisplayNamesById: ReadonlyMap<string, string>;
  ephemeralsByMessageId: ReadonlyMap<string, DEphemeral[]>;
  conversationHandler?: ConversationHandler | null;
}) {
  const {
    entry,
    isExpanded,
    onToggleExpanded,
    isMessageSelectionMode,
    historyTokenCount,
    remainingTokens,
    selectedMessages,
    handleSelectMessage,
    fitScreen,
    hasInReferenceTo,
    isMobile,
    isImagining,
    isSpeaking,
    showAntPromptCaching,
    showUnsafeHtmlCode,
    composerCanAddInReferenceTo,
    handleAddInReferenceTo,
    handleMessageAssistantFrom,
    handleMessageAssistantFromInCouncil,
    handleMessageAssistantToCouncil,
    handleMessageUpstreamResume,
    handleMessageBeam,
    handleMessageBranch,
    handleMessageContinue,
    handleMessageDelete,
    handleMessageAppendFragment,
    handleMessageDeleteFragment,
    handleMessageReplaceFragment,
    handleMessageToggleUserFlag,
    handleMessageTruncate,
    handleTextDiagram,
    handleTextImagine,
    handleTextSpeak,
    handleAppendMention,
    participants,
    participantDisplayNamesById,
    ephemeralsByMessageId,
    conversationHandler,
  } = props;

  const groupTone = isExpanded ? 'primary' : 'neutral';
  const groupVariant = isExpanded ? 'solid' : 'soft';
  const groupBorderColor = isExpanded ? 'primary.outlinedBorder' : 'divider';
  const columnsSx = React.useMemo(() => ({
    ...councilGroupColumnsSx,
    gridTemplateColumns: {
      xs: '1fr',
      md: `repeat(${entry.messages.length}, ${getCouncilGroupColumnWidth(entry.messages.length)})`,
    },
  }), [entry.messages.length]);
  const renderedMessages = React.useMemo(() => entry.renderedMessages, [entry.renderedMessages]);

  return (
    <PerfProfiler id='CouncilGroupEntryView'>
      <ListItem data-chat-minimap-entry='group' sx={{ display: 'block', px: 0, py: 0 }}>
        <Box sx={councilGroupBoxSx}>
        <Box sx={councilGroupHeaderSx}>
          <Box sx={councilGroupHeaderControlsSx}>
            <Chip size='sm' variant={groupVariant} color={groupTone}>
              {entry.label} · {entry.messages.length} draft{entry.messages.length === 1 ? '' : 's'}
            </Chip>
            <Button
              size='sm'
              variant={isExpanded ? 'solid' : 'soft'}
              color={groupTone}
              onClick={() => onToggleExpanded(entry.key)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </Box>
        </Box>
        {isExpanded && (
          <Box sx={columnsSx}>
            {renderedMessages.map(({ message, topDecoratorKind, topDecoratorCompact, topDecoratorFirst }) => {
              const ChatMessageMemoOrNot = !message.pendingIncomplete ? ChatMessageMemo : ChatMessage;

              return (
                <Box key={`group-column-${message.id}`} sx={{ ...councilMessageColumnBaseSx, borderColor: groupBorderColor }}>
                  {isMessageSelectionMode ? (
                    <CleanerMessage
                      key={'sel-' + message.id}
                      message={message}
                      remainingTokens={remainingTokens}
                      selected={selectedMessages.has(message.id)} onToggleSelected={handleSelectMessage}
                    />
                  ) : (
                    <ChatMessageMemoOrNot
                      key={'msg-' + message.id}
                      message={message}
                      fitScreen={fitScreen}
                      hasInReferenceTo={hasInReferenceTo}
                      isMobile={isMobile}
                      isBottom={false}
                      isImagining={isImagining}
                      isSpeaking={isSpeaking}
                      showAntPromptCaching={showAntPromptCaching}
                      showUnsafeHtmlCode={showUnsafeHtmlCode}
                      topDecoratorKind={topDecoratorKind}
                      topDecoratorCompact={topDecoratorCompact}
                      topDecoratorFirst={topDecoratorFirst}
                      onAddInReferenceTo={!composerCanAddInReferenceTo ? undefined : handleAddInReferenceTo}
                      onMessageAssistantFrom={handleMessageAssistantFrom}
                      onMessageAssistantFromInCouncil={handleMessageAssistantFromInCouncil}
                      onMessageAssistantToCouncil={handleMessageAssistantToCouncil}
                      onMessageUpstreamResume={handleMessageUpstreamResume}
                      onMessageBeam={handleMessageBeam}
                      onMessageBranch={handleMessageBranch}
                      onMessageContinue={handleMessageContinue}
                      onMessageDelete={handleMessageDelete}
                      onMessageFragmentAppend={handleMessageAppendFragment}
                      onMessageFragmentDelete={handleMessageDeleteFragment}
                      onMessageFragmentReplace={handleMessageReplaceFragment}
                      onMessageToggleUserFlag={handleMessageToggleUserFlag}
                      onMessageTruncate={handleMessageTruncate}
                      onTextDiagram={handleTextDiagram}
                      onTextImagine={handleTextImagine}
                      onTextSpeak={handleTextSpeak}
                      onAppendMention={handleAppendMention}
                      participants={participants}
                      participantDisplayNamesById={participantDisplayNamesById}
                      turnTerminationMode='council'
                      ephemerals={ephemeralsByMessageId.get(message.id) ?? stableNoEphemerals}
                      conversationHandler={conversationHandler}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        )}
        </Box>
      </ListItem>
    </PerfProfiler>
  );
}, (prevProps, nextProps) => {
  return prevProps.entry.key === nextProps.entry.key
    && prevProps.entry.label === nextProps.entry.label
    && prevProps.entry.messages.length === nextProps.entry.messages.length
    && areRenderedGroupMessagesEqual(prevProps.entry.renderedMessages, nextProps.entry.renderedMessages)
    && prevProps.isExpanded === nextProps.isExpanded
    && prevProps.onToggleExpanded === nextProps.onToggleExpanded
    && prevProps.isMessageSelectionMode === nextProps.isMessageSelectionMode
    && prevProps.remainingTokens === nextProps.remainingTokens
    && prevProps.selectedMessages === nextProps.selectedMessages
    && prevProps.fitScreen === nextProps.fitScreen
    && prevProps.hasInReferenceTo === nextProps.hasInReferenceTo
    && prevProps.isMobile === nextProps.isMobile
    && prevProps.isImagining === nextProps.isImagining
    && prevProps.isSpeaking === nextProps.isSpeaking
    && prevProps.showAntPromptCaching === nextProps.showAntPromptCaching
    && prevProps.showUnsafeHtmlCode === nextProps.showUnsafeHtmlCode
    && prevProps.composerCanAddInReferenceTo === nextProps.composerCanAddInReferenceTo
    && prevProps.handleAddInReferenceTo === nextProps.handleAddInReferenceTo
    && prevProps.handleMessageAssistantFrom === nextProps.handleMessageAssistantFrom
    && prevProps.handleMessageAssistantToCouncil === nextProps.handleMessageAssistantToCouncil
    && prevProps.handleMessageBeam === nextProps.handleMessageBeam
    && prevProps.handleMessageBranch === nextProps.handleMessageBranch
    && prevProps.handleMessageContinue === nextProps.handleMessageContinue
    && prevProps.handleMessageDelete === nextProps.handleMessageDelete
    && prevProps.handleMessageAppendFragment === nextProps.handleMessageAppendFragment
    && prevProps.handleMessageDeleteFragment === nextProps.handleMessageDeleteFragment
    && prevProps.handleMessageReplaceFragment === nextProps.handleMessageReplaceFragment
    && prevProps.handleMessageToggleUserFlag === nextProps.handleMessageToggleUserFlag
    && prevProps.handleMessageTruncate === nextProps.handleMessageTruncate
    && prevProps.handleTextDiagram === nextProps.handleTextDiagram
    && prevProps.handleTextImagine === nextProps.handleTextImagine
    && prevProps.handleTextSpeak === nextProps.handleTextSpeak
    && prevProps.handleAppendMention === nextProps.handleAppendMention
    && prevProps.participants === nextProps.participants
    && prevProps.ephemeralsByMessageId === nextProps.ephemeralsByMessageId
    && prevProps.conversationHandler === nextProps.conversationHandler;
});

function getMessageDecoratorKind(message: DMessage): MessageDecoratorKind | undefined {
  const messageChannel = normalizeMessageChannel(message);
  if (messageChannel.channel === 'system')
    return 'system';
  if (messageChannel.channel !== 'public-board')
    return undefined;
  if (message.metadata?.council?.kind !== 'deliberation')
    return undefined;
  if (message.metadata?.council?.leaderParticipantId === message.metadata?.author?.participantId)
    return 'leader';
  if (message.metadata?.council?.provisional)
    return 'provisional';
  return undefined;
}

function getGroupedVisibleRenderEntries(messages: DMessage[]): GroupedVisibleRenderEntry[] {
  return groupVisibleCouncilMessages(messages).map(entry => {
    if (entry.kind === 'group') {
      return {
        ...entry,
        renderedMessages: entry.messages.map((message, groupMessageIndex) => ({
          message,
          topDecoratorKind: getMessageDecoratorKind(message),
          topDecoratorCompact: true,
          topDecoratorFirst: groupMessageIndex === 0,
        })),
      };
    }

    return {
      ...entry,
      topDecoratorKind: getMessageDecoratorKind(entry.message),
    };
  });
}

export function getNonCouncilRenderEntries(messages: readonly DMessage[], maxUnits: number | null): Exclude<GroupedVisibleRenderEntry, { kind: 'group' }>[] {
  const normalizedMaxUnits = maxUnits === null
    ? null
    : Math.max(1, Math.floor(maxUnits));
  const windowedMessages = normalizedMaxUnits === null
    ? messages
    : messages.slice(Math.max(0, messages.length - normalizedMaxUnits));

  return windowedMessages.map(message => ({
    kind: 'message' as const,
    key: message.id,
    message,
    topDecoratorKind: getMessageDecoratorKind(message),
  }));
}

function getCouncilGroupColumnWidth(messageCount: number): string {
  if (messageCount >= 4)
    return 'minmax(19rem, 1fr)';
  if (messageCount === 3)
    return 'minmax(17rem, 1fr)';
  return 'minmax(15rem, 1fr)';
}

function getEphemeralParentMessageId(ephemeral: DEphemeral): string | null {
  const parentMessageId = (ephemeral.state as { parentMessageId?: unknown } | null | undefined)?.parentMessageId;
  return typeof parentMessageId === 'string' && parentMessageId.trim() ? parentMessageId : null;
}

export function ChatMessageList(props: {
  conversationId: DConversationId | null,
  conversationHandler: ConversationHandler | null,
  capabilityHasT2I: boolean,
  chatLLMAntPromptCaching: boolean,
  chatLLMContextTokens: DLLMContextTokens,
  chatLLMSupportsImages: boolean,
  fitScreen: boolean,
  isMobile: boolean,
  isMessageSelectionMode: boolean,
  onConversationBranch: (conversationId: DConversationId, messageId: string, addSplitPane: boolean) => void,
  onConversationExecuteHistory: (conversationId: DConversationId, executeCallerNameDebug?: string) => Promise<void>,
  onConversationNew: (forceNoRecycle: boolean, isIncognito: boolean, agentGroupSnapshot?: DAgentGroupSnapshot | null) => void,
  onTextDiagram: (diagramConfig: DiagramConfig | null) => void,
  onTextImagine: (conversationId: DConversationId, selectedText: string) => Promise<void>,
  setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  sx?: SxProps,
}) {

  const { conversationHandler, conversationId, capabilityHasT2I, onConversationBranch, onConversationExecuteHistory, onTextDiagram, onTextImagine } = props;

  // state
  const [isImagining, setIsImagining] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());
  const [expandedCouncilGroupKeys, setExpandedCouncilGroupKeys] = React.useState<Set<string>>(new Set());
  const [visibleEntryUnitLimit, setVisibleEntryUnitLimit] = React.useState<number | null>(INITIAL_VISIBLE_ENTRY_UNITS);
  const previousLatestCouncilGroupKeyRef = React.useRef<string | null>(null);
  const previousConversationIdRef = React.useRef<DConversationId | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);

  // external state
  const { notifyBooting } = useScrollToBottom();
  const { llms: visibleLLMs } = useVisibleLLMs(null, false, false);
  const { domainModelId: chatLLMId } = useModelDomain('primaryChat');
  const danger_experimentalHtmlWebUi = useChatAutoSuggestHTMLUI();
  const [showSystemMessages] = useChatShowSystemMessages();
  const [showConversationMinimap] = useChatShowConversationMinimap();
  const {
    conversationMessages,
    historyTokenCount,
    storedParticipants,
    conversationUserSymbol,
    conversationSystemPurposeId,
    turnTerminationMode,
    councilTraceAutoCollapsePreviousRounds,
    councilTraceAutoExpandNewestRound,
  } = useChatStore(useShallow(React.useCallback(({ conversations }) => {
    const conversation = conversations.find(item => item.id === props.conversationId) ?? null;
    const turnTerminationMode: DConversationTurnTerminationMode = conversation?.turnTerminationMode === 'continuous'
      ? 'continuous'
      : conversation?.turnTerminationMode === 'council'
        ? 'council'
        : 'round-robin-per-human';
    return {
      conversationMessages: conversation?.messages ?? stableNoMessages,
      historyTokenCount: conversation?.tokenCount ?? 0,
      storedParticipants: conversation?.participants ?? null,
      conversationUserSymbol: conversation?.userSymbol ?? null,
      conversationSystemPurposeId: conversation?.systemPurposeId ?? null,
      turnTerminationMode,
      councilTraceAutoCollapsePreviousRounds: getConversationCouncilTraceAutoCollapsePreviousRounds(props.conversationId),
      councilTraceAutoExpandNewestRound: getConversationCouncilTraceAutoExpandNewestRound(props.conversationId),
    };
  }, [props.conversationId])));
  const participants = React.useMemo<DConversationParticipant[]>(() => {
    return getRenderableConversationParticipants({
      conversationId,
      participants: storedParticipants,
      userSymbol: conversationUserSymbol,
      systemPurposeId: conversationSystemPurposeId,
    });
  }, [conversationId, conversationSystemPurposeId, conversationUserSymbol, storedParticipants]);
  const leaderParticipant = React.useMemo(
    () => participants.find(participant => participant.kind === 'assistant' && participant.isLeader) ?? participants.find(participant => participant.kind === 'assistant') ?? null,
    [participants],
  );
  const { _composerInReferenceToCount, ephemerals, showCouncilDeliberation, toggleShowCouncilDeliberation, councilSession } = useChatOverlayStore(props.conversationHandler?.conversationOverlayStore ?? null, useShallow(state => ({
    _composerInReferenceToCount: state.inReferenceTo?.length ?? 0,
    ephemerals: state.ephemerals?.length ? state.ephemerals : null,
    showCouncilDeliberation: state.showCouncilDeliberation,
    toggleShowCouncilDeliberation: state.toggleShowCouncilDeliberation,
    councilSession: state.councilSession,
  })));

  // derived state
  const isCouncilRenderMode = turnTerminationMode === 'council';
  const composerCanAddInReferenceTo = _composerInReferenceToCount < 5;
  const composerHasInReferenceto = _composerInReferenceToCount > 0;
  const ephemeralsByMessageId = React.useMemo(() => {
    const grouped = new Map<string, DEphemeral[]>();
    if (!ephemerals?.length)
      return grouped;

    for (const ephemeral of ephemerals) {
      const parentMessageId = getEphemeralParentMessageId(ephemeral);
      if (!parentMessageId)
        continue;
      const current = grouped.get(parentMessageId);
      if (current)
        current.push(ephemeral);
      else
        grouped.set(parentMessageId, [ephemeral]);
    }

    return grouped;
  }, [ephemerals]);
  const unboundEphemerals = React.useMemo(
    () => ephemerals?.filter(ephemeral => !getEphemeralParentMessageId(ephemeral)) ?? null,
    [ephemerals],
  );
  const handleCouncilTraceAutoCollapsePreviousRoundsChange = React.useCallback((value: boolean) => {
    if (!conversationId)
      return;
    useChatStore.getState().setCouncilTraceAutoCollapsePreviousRounds(conversationId, value);
  }, [conversationId]);
  const handleCouncilTraceAutoExpandNewestRoundChange = React.useCallback((value: boolean) => {
    if (!conversationId)
      return;
    useChatStore.getState().setCouncilTraceAutoExpandNewestRound(conversationId, value);
  }, [conversationId]);

  // text actions

  const handleRunExample = React.useCallback(async (example: SystemPurposeExample) => {
    if (!conversationId || !conversationHandler) return;

    // Simple Example Prompt (User text message)
    if (typeof example === 'string') {
      conversationHandler.messageAppend(createDMessageTextContent('user', example)); // [chat] append user:persona question
      await onConversationExecuteHistory(conversationId);
      return;
    }

    // User-Action Example Prompts (User text message + File attachments)
    switch (example.action) {
      case 'require-data-attachment':
        await openFileForAttaching(true, async (filesWithHandle) => {

          // Retrieve fully-fledged Attachment Fragments (converted/extracted, with sources, mimes, etc.) from the selected files
          const attachmentFragments = await convertFilesToDAttachmentFragments('file-open', filesWithHandle, {
            hintAddImages: props.chatLLMSupportsImages,
          });

          // Create a User message with the prompt and the attachment fragments
          if (attachmentFragments.length) {
            conversationHandler.messageAppend(createDMessageFromFragments('user', [ // [chat] append user:persona question + attachment(s)
              createTextContentFragment(example.prompt),
              ...attachmentFragments,
            ]));
            await onConversationExecuteHistory(conversationId);
          }
        });
        break;
    }
  }, [conversationHandler, conversationId, onConversationExecuteHistory, props.chatLLMSupportsImages]);

  const handleMessageContinue = React.useCallback(async (_messageId: DMessageId /* Ignored for now */, continueText: null | string) => {
    if (conversationId && conversationHandler) {
      conversationHandler.messageAppend(createDMessageTextContent('user', continueText || 'Continue')); // [chat] append user:Continue (or custom text, likely from an 'option')
      await onConversationExecuteHistory(conversationId);
    }
  }, [conversationHandler, conversationId, onConversationExecuteHistory]);


  // message menu methods proxy

  const handleMessageAssistantFrom = React.useCallback(async (messageId: DMessageId, offset: number) => {
    if (conversationId && conversationHandler) {
      const targetMessage = conversationHandler.historyFindMessageOrThrow(messageId);
      conversationHandler.historyTruncateTo(messageId, offset);
      if (targetMessage?.role === 'assistant')
        conversationHandler.messagesDelete([messageId]);
      await onConversationExecuteHistory(conversationId, targetMessage?.role === 'assistant' ? `chat-retry-message:${messageId}` : undefined);
    }
  }, [conversationHandler, conversationId, onConversationExecuteHistory]);

  const handleMessageAssistantFromInCouncil = React.useCallback(async (messageId: DMessageId, offset: number) => {
    if (conversationId && conversationHandler) {
      conversationHandler.historyTruncateTo(messageId, offset);
      const truncatedMessage = conversationHandler.historyFindMessageOrThrow(messageId);
      if (truncatedMessage?.role === 'user') {
        conversationHandler.messageEdit(messageId, {
          metadata: getRestartInCouncilMessageMetadata(truncatedMessage.metadata, leaderParticipant?.id),
        }, false, true);
      }
      await onConversationExecuteHistory(conversationId);
    }
  }, [conversationHandler, conversationId, leaderParticipant?.id, onConversationExecuteHistory]);

  const handleMessageAssistantToCouncil = React.useCallback(async (messageId: DMessageId, offset: number) => {
    if (conversationId && conversationHandler) {
      conversationHandler.historyTruncateTo(messageId, offset);
      const truncatedMessage = conversationHandler.historyFindMessageOrThrow(messageId);
      if (truncatedMessage?.role === 'user') {
        conversationHandler.messageEdit(messageId, {
          metadata: getRestartToCouncilMessageMetadata(truncatedMessage.metadata),
        }, false, true);
      }
      await onConversationExecuteHistory(conversationId);
    }
  }, [conversationHandler, conversationId, onConversationExecuteHistory]);

  const handleMessageUpstreamResume = React.useCallback(async (_messageId: DMessageId) => {
    if (conversationId && conversationHandler)
      await onConversationExecuteHistory(conversationId);
  }, [conversationHandler, conversationId, onConversationExecuteHistory]);

  const handleMessageBeam = React.useCallback(async (messageId: DMessageId) => {
    // Message option menu Beam
    if (!conversationId || !conversationHandler || !conversationHandler.isValid()) return;
    const inputHistory = conversationHandler.historyViewHeadOrThrow('chat-beam-message');
    if (!inputHistory.length) return;

    // TODO: replace the Persona and Auto-Cache-hint in the history?

    // truncate the history to the given message (may or may not have more after)
    const truncatedHistory = inputHistory.slice(0, inputHistory.findIndex(m => m.id === messageId) + 1);
    const lastTruncatedMessage = truncatedHistory[truncatedHistory.length - 1];
    if (!lastTruncatedMessage) return;

    // assistant: do an in-place beam
    if (lastTruncatedMessage.role === 'assistant') {
      if (truncatedHistory.length >= 2)
        conversationHandler.beamInvoke(truncatedHistory.slice(0, -1), [lastTruncatedMessage], lastTruncatedMessage.id);
    } else if (lastTruncatedMessage.role === 'user') {
      // user: truncate and append (but if the next message is an assistant message, import it)
      const possibleNextMessage = inputHistory[truncatedHistory.length];
      if (possibleNextMessage?.role === 'assistant')
        conversationHandler.beamInvoke(truncatedHistory, [possibleNextMessage], null);
      else
        conversationHandler.beamInvoke(truncatedHistory, [], null);
    }
  }, [conversationHandler, conversationId]);

  const handleMessageBranch = React.useCallback((messageId: DMessageId) => {
    conversationId && onConversationBranch(conversationId, messageId, true);
  }, [conversationId, onConversationBranch]);

  const handleMessageTruncate = React.useCallback((messageId: DMessageId) => {
    conversationHandler?.historyTruncateTo(messageId, 0);
  }, [conversationHandler]);

  const handleMessageDelete = React.useCallback((messageId: DMessageId) => {
    conversationHandler?.messagesDelete([messageId]);
  }, [conversationHandler]);

  const handleMessageAppendFragment = React.useCallback((messageId: DMessageId, fragment: DMessageFragment) => {
    conversationHandler?.messageFragmentAppend(messageId, fragment, false, false);
  }, [conversationHandler]);

  const handleMessageDeleteFragment = React.useCallback((messageId: DMessageId, fragmentId: DMessageFragmentId) => {
    conversationHandler?.messageFragmentDelete(messageId, fragmentId, false, true);
  }, [conversationHandler]);

  const handleMessageReplaceFragment = React.useCallback((messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => {
    conversationHandler?.messageFragmentReplace(messageId, fragmentId, newFragment, true);
  }, [conversationHandler]);

  const handleMessageToggleUserFlag = React.useCallback((messageId: DMessageId, userFlag: DMessageUserFlag, _maxPerConversation?: number) => {
    conversationHandler?.messageToggleUserFlag(messageId, userFlag, true /* touch */);
    // Note: we don't support 'maxPerConversation' yet, which is supposed to turn off the flag from the beginning if it's too numerous
    // if (_maxPerConversation) {
    //   ...
    // }
  }, [conversationHandler]);

  const handleAddInReferenceTo = React.useCallback((item: DMetaReferenceItem) => {
    conversationHandler?.overlayActions.addInReferenceTo(item);
  }, [conversationHandler]);

  const handleAppendMention = React.useCallback((mentionText: string) => {
    conversationHandler?.overlayActions.appendComposerDraftText(mentionText);
  }, [conversationHandler]);

  const handleTextDiagram = React.useCallback(async (messageId: DMessageId, text: string) => {
    conversationId && onTextDiagram({ conversationId: conversationId, messageId, text });
  }, [conversationId, onTextDiagram]);

  const handleTextImagine = React.useCallback(async (text: string) => {
    if (!capabilityHasT2I)
      return optimaOpenPreferences('draw');
    if (conversationId) {
      setIsImagining(true);
      await onTextImagine(conversationId, text);
      setIsImagining(false);
    }
  }, [capabilityHasT2I, conversationId, onTextImagine]);

  const handleTextSpeak = React.useCallback(async (text: string) => {
    // sandwich the speaking with the indicator
    setIsSpeaking(true);
    const result = await speakText(text, undefined, { label: 'Chat speak' });
    setIsSpeaking(false);

    // open voice preferences
    if (!result.success && (result.errorType === 'tts-no-engine' || result.errorType === 'tts-unconfigured'))
      optimaOpenPreferences('voice');
  }, []);


  // operate on the local selection set

  const areAllSelectedMessagesHidden = React.useMemo(() => {
    if (selectedMessages.size === 0) return false;
    for (const messageId of selectedMessages) {
      const message = conversationMessages.find(m => m.id === messageId);
      if (message && !messageHasUserFlag(message, MESSAGE_FLAG_AIX_SKIP))
        return false;
    }
    return true;
  }, [selectedMessages, conversationMessages]);

  const handleSelectAll = (selected: boolean) => {
    const newSelected = new Set<string>();
    if (selected)
      for (const message of conversationMessages)
        newSelected.add(message.id);
    setSelectedMessages(newSelected);
  };

  const handleSelectMessage = (messageId: DMessageId, selected: boolean) => {
    const newSelected = new Set(selectedMessages);
    selected ? newSelected.add(messageId) : newSelected.delete(messageId);
    setSelectedMessages(newSelected);
  };

  const handleSelectionDelete = React.useCallback(() => {
    conversationHandler?.messagesDelete(Array.from(selectedMessages));
    setSelectedMessages(new Set());
  }, [conversationHandler, selectedMessages]);

  const handleSelectionToggleVisibility = React.useCallback(() => {
    for (let selectedMessage of Array.from(selectedMessages))
      conversationHandler?.messageSetUserFlag(selectedMessage, MESSAGE_FLAG_AIX_SKIP, !areAllSelectedMessagesHidden, true);
    setSelectedMessages(new Set());
  }, [conversationHandler, selectedMessages, areAllSelectedMessagesHidden]);

  const { isMessageSelectionMode, setIsMessageSelectionMode } = props;

  useGlobalShortcuts('ChatMessageList_Selection', React.useMemo(() => !isMessageSelectionMode ? [] : [
    { key: ShortcutKey.Esc, action: () => setIsMessageSelectionMode(false), description: 'Close Cleanup', level: 10 - 1 },
  ], [isMessageSelectionMode, setIsMessageSelectionMode]));


  // text-diff functionality: only diff the last complete message, and they're similar in size

  // const { diffTargetMessage, diffPrevText } = React.useMemo(() => {
  //   const [msgB, msgA] = conversationMessages.filter(m => m.role === 'assistant').reverse();
  //   const textB = msgB ? singleTextOrThrow(msgB) : undefined;
  //   const textA = msgA ? singleTextOrThrow(msgA) : undefined;
  //   if (textB && textA && !msgB?.pendingIncomplete) {
  //     const lenA = textA.length, lenB = textB.length;
  //     if (lenA > 80 && lenB > 80 && lenA > lenB / 3 && lenB > lenA / 3)
  //       return { diffTargetMessage: msgB, diffPrevText: textA };
  //   }
  //   return { diffTargetMessage: undefined, diffPrevText: undefined };
  // }, [conversationMessages]);


  // scroll to the very bottom of a new chat
  React.useEffect(() => {
    if (conversationId)
      notifyBooting();
  }, [conversationId, notifyBooting]);


  // style memo
  const minimapOverlaySx: SxProps = React.useMemo(() => getChatMessageListMinimapOverlaySx(), []);
  const listSx: SxProps = React.useMemo(() => ({
    p: 0,
    px: { xs: 0.5, md: 1 },
    py: 1,

    // we added these after removing the minSize={20} (%) from the containing panel.
    minWidth: { xs: 0, md: '18rem' },
    // minHeight: '180px', // not need for this, as it's already an overflow scrolling container, so one can reduce it to a pixel

    // fix for the double-border on the last message (one by the composer, one to the bottom of the message)
    // marginBottom: '-1px',

    // layout
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  }), []);

  const filteredMessages = React.useMemo(() => perfMeasureSync(
    'derive:ChatMessageList.getCouncilVisibleMessages',
    () => getCouncilVisibleMessages(conversationMessages, showSystemMessages),
  ), [conversationMessages, showSystemMessages]);
  const llmLabelsById = React.useMemo(
    () => new Map(visibleLLMs.map(llm => [llm.id, getLLMLabel(llm)])),
    [visibleLLMs],
  );
  const chatModelLabel = React.useMemo(
    () => chatLLMId ? llmLabelsById.get(chatLLMId) ?? chatLLMId : 'Chat model',
    [chatLLMId, llmLabelsById],
  );
  const remainingTokens = React.useMemo(
    () => props.chatLLMContextTokens ? (props.chatLLMContextTokens - historyTokenCount) : undefined,
    [historyTokenCount, props.chatLLMContextTokens],
  );
  const { displayNamesById: participantDisplayNamesById } = React.useMemo(
    () => getSingleAgentHumanDrivenParticipantNameOverrides({
      participants,
      turnTerminationMode,
      llmLabelsById,
      chatModelLabel,
    }),
    [chatModelLabel, llmLabelsById, participants, turnTerminationMode],
  );
  const hasCouncilDeliberation = React.useMemo(
    () => isCouncilRenderMode && filteredMessages.some(message => message.metadata?.council?.kind === 'deliberation'),
    [filteredMessages, isCouncilRenderMode],
  );
  const councilTracePlan = React.useMemo(() => {
    if (!isCouncilRenderMode)
      return stableNoCouncilTracePlan;

    return perfMeasureSync(
      'derive:ChatMessageList.buildCouncilTraceRenderPlan',
      () => buildCouncilTraceRenderPlan({
        messages: filteredMessages,
        participants,
        llmLabelsById,
        chatModelLabel,
        councilSession,
        autoCollapsePreviousRounds: councilTraceAutoCollapsePreviousRounds,
        autoExpandNewestRound: councilTraceAutoExpandNewestRound,
      }),
    );
  }, [chatModelLabel, councilSession, councilTraceAutoCollapsePreviousRounds, councilTraceAutoExpandNewestRound, filteredMessages, isCouncilRenderMode, llmLabelsById, participants]);
  const councilTraceItem = councilTracePlan.traceItem;
  const groupedVisibleRenderEntries = React.useMemo(() => {
    if (!isCouncilRenderMode)
      return stableNoRenderEntries;

    return perfMeasureSync(
      'derive:ChatMessageList.getGroupedVisibleRenderEntries',
      () => {
        if (!filteredMessages.length)
          return stableNoRenderEntries;

        const nextVisibleMessages = filteredMessages.filter(message => {
          const council = message.metadata?.council;
          if (council?.kind === 'deliberation')
            return councilTracePlan.showLegacyDeliberationToggle ? showCouncilDeliberation : false;
          return true;
        });

        if (!nextVisibleMessages.length)
          return stableNoRenderEntries;

        return getGroupedVisibleRenderEntries(nextVisibleMessages);
      },
    );
  }, [councilTracePlan.showLegacyDeliberationToggle, filteredMessages, isCouncilRenderMode, showCouncilDeliberation]);
  const latestCouncilGroupKey = React.useMemo(() => {
    if (!isCouncilRenderMode)
      return null;

    for (let index = groupedVisibleRenderEntries.length - 1; index >= 0; index--) {
      const entry = groupedVisibleRenderEntries[index];
      if (entry?.kind === 'group')
        return entry.key;
    }
    return null;
  }, [groupedVisibleRenderEntries, isCouncilRenderMode]);
  React.useEffect(() => {
    if (!isCouncilRenderMode)
      return;

    const nextAutoExpandedKeys = getNextAutoExpandedCouncilGroupKeys({
      previousLatestCouncilGroupKey: previousLatestCouncilGroupKeyRef.current,
      latestCouncilGroupKey,
      showCouncilDeliberation,
      hasCouncilTrace: !!councilTraceItem,
    });

    if (!showCouncilDeliberation || councilTraceItem || !latestCouncilGroupKey)
      return;

    previousLatestCouncilGroupKeyRef.current = latestCouncilGroupKey;
    if (!nextAutoExpandedKeys)
      return;

    setExpandedCouncilGroupKeys(prev =>
      prev.size === nextAutoExpandedKeys.size
        && [...nextAutoExpandedKeys].every(key => prev.has(key))
        ? prev
        : nextAutoExpandedKeys,
    );
  }, [councilTraceItem, isCouncilRenderMode, latestCouncilGroupKey, showCouncilDeliberation]);
  const handleToggleCouncilGroupExpanded = React.useCallback((groupKey: string) => {
    setExpandedCouncilGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(groupKey))
        next.delete(groupKey);
      else
        next.add(groupKey);
      return next;
    });
  }, []);
  const visibleRenderEntries = React.useMemo<VisibleRenderEntry[]>(() => {
    if (!isCouncilRenderMode)
      return getNonCouncilRenderEntries(filteredMessages, visibleEntryUnitLimit);

    return perfMeasureSync(
      'derive:ChatMessageList.visibleRenderEntries',
      () => {
        if (!groupedVisibleRenderEntries.length && !councilTraceItem)
          return stableNoVisibleEntries;

        if (!councilTraceItem)
          return visibleEntryUnitLimit === null
            ? groupedVisibleRenderEntries
            : sliceVisibleRenderEntriesFromEnd(groupedVisibleRenderEntries, visibleEntryUnitLimit);

        const traceEntry: CouncilTraceVisibleEntry = {
          kind: 'council-trace',
          key: `council-trace-${councilTraceItem.phaseId}`,
          trace: councilTraceItem,
        };

        const fullEntries: VisibleRenderEntry[] = councilTraceItem.placement.mode === 'after-phase'
          ? [...groupedVisibleRenderEntries, traceEntry]
          : (() => {
            const nextEntries: VisibleRenderEntry[] = [];
            let inserted = false;
            for (const entry of groupedVisibleRenderEntries) {
              if (!inserted && entry.kind === 'message' && entry.message.id === councilTraceItem.placement.anchorMessageId) {
                nextEntries.push(traceEntry);
                inserted = true;
              }
              nextEntries.push(entry);
            }
            return inserted ? nextEntries : [...nextEntries, traceEntry];
          })();

        return visibleEntryUnitLimit === null
          ? fullEntries
          : sliceVisibleRenderEntriesFromEnd(fullEntries, visibleEntryUnitLimit);
      },
    );
  }, [councilTraceItem, filteredMessages, groupedVisibleRenderEntries, isCouncilRenderMode, visibleEntryUnitLimit]);
  const totalVisibleRenderEntryUnits = React.useMemo(
    () => isCouncilRenderMode
      ? groupedVisibleRenderEntries.reduce((count, entry) => count + countVisibleRenderEntryUnits(entry), 0) + (councilTraceItem ? 1 : 0)
      : filteredMessages.length,
    [councilTraceItem, filteredMessages.length, groupedVisibleRenderEntries, isCouncilRenderMode],
  );
  React.useEffect(() => {
    if (props.isMessageSelectionMode) {
      setVisibleEntryUnitLimit(null);
      return;
    }

    if (totalVisibleRenderEntryUnits <= INITIAL_VISIBLE_ENTRY_UNITS)
      setVisibleEntryUnitLimit(null);
  }, [props.isMessageSelectionMode, totalVisibleRenderEntryUnits]);
  React.useEffect(() => {
    if (!conversationId)
      return;
    if (previousConversationIdRef.current === conversationId)
      return;

    previousConversationIdRef.current = conversationId;

    setVisibleEntryUnitLimit(totalVisibleRenderEntryUnits > INITIAL_VISIBLE_ENTRY_UNITS
      ? INITIAL_VISIBLE_ENTRY_UNITS
      : null);
  }, [conversationId, totalVisibleRenderEntryUnits]);
  const renderedVisibleEntries = visibleRenderEntries;
  const renderedVisibleEntryUnits = React.useMemo(
    () => renderedVisibleEntries.reduce((count, entry) => count + countVisibleRenderEntryUnits(entry), 0),
    [renderedVisibleEntries],
  );
  const hasDeferredOlderEntries = React.useMemo(
    () => visibleEntryUnitLimit !== null && renderedVisibleEntryUnits < totalVisibleRenderEntryUnits,
    [renderedVisibleEntryUnits, totalVisibleRenderEntryUnits, visibleEntryUnitLimit],
  );
  const visibleMessageCount = React.useMemo(
    () => isCouncilRenderMode
      ? groupedVisibleRenderEntries.reduce((count, entry) => count + (entry.kind === 'group' ? entry.messages.length : 1), 0) + (councilTraceItem ? 1 : 0)
      : filteredMessages.length,
    [councilTraceItem, filteredMessages.length, groupedVisibleRenderEntries, isCouncilRenderMode],
  );
  const showConversationMinimapTrack = React.useMemo(() => shouldShowConversationMinimapTrack({
    showConversationMinimap,
    hasDeferredOlderEntries,
    renderedEntryUnits: renderedVisibleEntryUnits,
  }), [hasDeferredOlderEntries, renderedVisibleEntryUnits, showConversationMinimap]);
  const conversationOverlayMode = getChatMessageListConversationOverlayMode({
    isMobile: props.isMobile,
    isMessageSelectionMode: props.isMessageSelectionMode,
    showConversationMinimap,
    showConversationMinimapTrack,
    visibleMessageCount,
  });
  const containerSx: SxProps = React.useMemo(() => getChatMessageListContainerSx({
    reserveMinimapGutter: conversationOverlayMode === 'minimap',
    baseSx: props.sx,
  }), [conversationOverlayMode, props.sx]);


  // no conversation: sine qua non
  if (!conversationId)
    return <CMLZeroConversation onConversationNew={props.onConversationNew} />;


  // no content: show the persona selector
  if (!visibleMessageCount)
    return (
      <Box sx={{ ...props.sx }}>
        <PersonaSelector conversationId={conversationId} isMobile={props.isMobile} runExample={handleRunExample} />
      </Box>
    );

  return (
    <PerfProfiler id='ChatMessageList'>
      <Box sx={containerSx}>
      {conversationOverlayMode !== 'hidden' && (
        <Box sx={minimapOverlaySx}>
          <ConversationMinimap listRef={listRef} showTrack={showConversationMinimapTrack} />
        </Box>
      )}
      <List ref={listRef} role='chat-messages-list' sx={listSx} onCopy={clipboardInterceptCtrlCForCleanup}>

      {hasCouncilDeliberation && councilTracePlan.showLegacyDeliberationToggle && (
        <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, pt: 1, pb: 0.5 }}>
          <Button
            size='sm'
            variant={showCouncilDeliberation ? 'solid' : 'soft'}
            color='neutral'
            onClick={toggleShowCouncilDeliberation}
          >
            {showCouncilDeliberation ? 'Hide deliberation' : 'Show deliberation'}
          </Button>
        </Box>
      )}

      {props.isMessageSelectionMode && (
        <MessagesSelectionHeader
          hasSelected={selectedMessages.size > 0}
          sumTokens={historyTokenCount}
          onClose={() => props.setIsMessageSelectionMode(false)}
          onSelectAll={handleSelectAll}
          onDeleteMessages={handleSelectionDelete}
          onToggleVisibility={handleSelectionToggleVisibility}
          areAllMessagesHidden={areAllSelectedMessagesHidden}
        />
      )}

      {hasDeferredOlderEntries && !props.isMessageSelectionMode && (
        <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, pt: 1, pb: 0.5 }}>
          <Button
            size='sm'
            variant='soft'
            color='neutral'
            onClick={() => setVisibleEntryUnitLimit(null)}
          >
            Load older messages
          </Button>
        </Box>
      )}

      {renderedVisibleEntries.map((entry, idx) => {
          if (entry.kind === 'council-trace')
            return (
              <CouncilTraceMessage
                key={entry.key}
                trace={entry.trace}
                autoCollapsePreviousRounds={councilTraceAutoCollapsePreviousRounds}
                autoExpandNewestRound={councilTraceAutoExpandNewestRound}
                onAutoCollapsePreviousRoundsChange={handleCouncilTraceAutoCollapsePreviousRoundsChange}
                onAutoExpandNewestRoundChange={handleCouncilTraceAutoExpandNewestRoundChange}
              />
            );

          if (entry.kind === 'group') {
            return (
              <CouncilGroupEntryView
                key={entry.key}
                entry={entry}
                isExpanded={expandedCouncilGroupKeys.has(entry.key)}
                onToggleExpanded={handleToggleCouncilGroupExpanded}
                isMessageSelectionMode={props.isMessageSelectionMode}
                historyTokenCount={historyTokenCount}
                remainingTokens={props.chatLLMContextTokens ? (props.chatLLMContextTokens - historyTokenCount) : undefined}
                selectedMessages={selectedMessages}
                handleSelectMessage={handleSelectMessage}
                fitScreen={props.fitScreen}
                hasInReferenceTo={composerHasInReferenceto}
                isMobile={props.isMobile}
                isImagining={isImagining}
                isSpeaking={isSpeaking}
                showAntPromptCaching={props.chatLLMAntPromptCaching}
                showUnsafeHtmlCode={danger_experimentalHtmlWebUi}
                composerCanAddInReferenceTo={composerCanAddInReferenceTo}
                handleAddInReferenceTo={handleAddInReferenceTo}
                handleMessageAssistantFrom={handleMessageAssistantFrom}
                handleMessageAssistantFromInCouncil={handleMessageAssistantFromInCouncil}
                handleMessageAssistantToCouncil={handleMessageAssistantToCouncil}
                handleMessageUpstreamResume={handleMessageUpstreamResume}
                handleMessageBeam={handleMessageBeam}
                handleMessageBranch={handleMessageBranch}
                handleMessageContinue={handleMessageContinue}
                handleMessageDelete={handleMessageDelete}
                handleMessageAppendFragment={handleMessageAppendFragment}
                handleMessageDeleteFragment={handleMessageDeleteFragment}
                handleMessageReplaceFragment={handleMessageReplaceFragment}
                handleMessageToggleUserFlag={handleMessageToggleUserFlag}
                handleMessageTruncate={handleMessageTruncate}
                handleTextDiagram={handleTextDiagram}
                handleTextImagine={capabilityHasT2I ? handleTextImagine : undefined}
                handleTextSpeak={handleTextSpeak}
                handleAppendMention={handleAppendMention}
                participants={participants}
                participantDisplayNamesById={participantDisplayNamesById}
                ephemeralsByMessageId={ephemeralsByMessageId}
                conversationHandler={conversationHandler}
              />
            );
          }

          const message = entry.message;
          const ChatMessageMemoOrNot = !message.pendingIncomplete ? ChatMessageMemo : ChatMessage;

          return props.isMessageSelectionMode ? (

            <CleanerMessage
              key={'sel-' + message.id}
              message={message}
              remainingTokens={props.chatLLMContextTokens ? (props.chatLLMContextTokens - historyTokenCount) : undefined}
              selected={selectedMessages.has(message.id)} onToggleSelected={handleSelectMessage}
            />

          ) : (
            <PerfProfiler key={'msg-' + message.id} id='ChatMessageRow'>
              <ChatMessageMemoOrNot
                message={message}
                fitScreen={props.fitScreen}
                hasInReferenceTo={composerHasInReferenceto}
                isMobile={props.isMobile}
                isBottom={idx === renderedVisibleEntries.length - 1}
                isImagining={isImagining}
                isSpeaking={isSpeaking}
                showAntPromptCaching={props.chatLLMAntPromptCaching}
                showUnsafeHtmlCode={danger_experimentalHtmlWebUi}
                topDecoratorKind={entry.topDecoratorKind}
                onAddInReferenceTo={!composerCanAddInReferenceTo ? undefined : handleAddInReferenceTo}
                onMessageAssistantFrom={handleMessageAssistantFrom}
                onMessageAssistantFromInCouncil={handleMessageAssistantFromInCouncil}
                onMessageAssistantToCouncil={handleMessageAssistantToCouncil}
                onMessageUpstreamResume={handleMessageUpstreamResume}
                onMessageBeam={handleMessageBeam}
                onMessageBranch={handleMessageBranch}
                onMessageContinue={handleMessageContinue}
                onMessageDelete={handleMessageDelete}
                onMessageFragmentAppend={handleMessageAppendFragment}
                onMessageFragmentDelete={handleMessageDeleteFragment}
                onMessageFragmentReplace={handleMessageReplaceFragment}
                onMessageToggleUserFlag={handleMessageToggleUserFlag}
                onMessageTruncate={handleMessageTruncate}
                onTextDiagram={handleTextDiagram}
                onTextImagine={capabilityHasT2I ? handleTextImagine : undefined}
                onTextSpeak={handleTextSpeak}
                onAppendMention={handleAppendMention}
                participants={participants}
                participantDisplayNamesById={participantDisplayNamesById}
                turnTerminationMode={turnTerminationMode}
                ephemerals={ephemeralsByMessageId.get(message.id) ?? stableNoEphemerals}
                conversationHandler={conversationHandler}
              />
            </PerfProfiler>
          );
        },
      )}

      {/* Render ephemerals (sidebar ReAct output widgets) at the bottom */}
      {!!unboundEphemerals?.length && !!conversationHandler && (
        <Ephemerals
          ephemerals={unboundEphemerals}
          conversationHandler={conversationHandler}
          sx={{
            mt: 'auto',
            overflowY: 'auto',
          }}
        />
      )}

      </List>
      </Box>
    </PerfProfiler>
  );
}
