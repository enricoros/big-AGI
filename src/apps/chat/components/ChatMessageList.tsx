import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Chip, List, ListItem } from '@mui/joy';

import type { SystemPurposeExample } from '../../../data';

import type { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';
import { speakText } from '~/modules/speex/speex.client';

import type { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import type { DLLMContextTokens } from '~/common/stores/llms/llms.types';
import { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { clipboardInterceptCtrlCForCleanup } from '~/common/util/clipboardUtils';
import { convertFilesToDAttachmentFragments } from '~/common/attachment-drafts/attachment.pipeline';
import { createDMessageFromFragments, createDMessageTextContent, DMessage, DMessageId, DMessageUserFlag, DMetaReferenceItem, MESSAGE_FLAG_AIX_SKIP, messageHasUserFlag } from '~/common/stores/chat/chat.message';
import { createTextContentFragment, DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { openFileForAttaching } from '~/common/components/ButtonAttachFiles';
import { optimaOpenPreferences } from '~/common/layout/optima/useOptima';
import { useChatOverlayStore } from '~/common/chat-overlay/store-perchat_vanilla';
import type { DAgentGroupSnapshot } from '~/common/stores/chat/store-chat-agent-groups';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';
import { getParticipantAccentColor } from '~/common/util/dMessageUtils';

import { CMLZeroConversation } from './messages-list/CMLZeroConversation';
import { buildCouncilTraceRenderPlan, type CouncilTraceRenderItem } from './ChatMessageList.councilTrace';
import { ChatMessage, ChatMessageMemo } from './message/ChatMessage';
import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';
import { CouncilTraceMessage } from './message/CouncilTraceMessage';
import { Ephemerals } from './Ephemerals';
import { PersonaSelector } from './persona-selector/PersonaSelector';
import { useChatAutoSuggestHTMLUI, useChatShowSystemMessages } from '../store-app-chat';


const stableNoMessages: DMessage[] = [];
const stableNoParticipants = [] as const;
const stableNoRenderEntries: GroupedVisibleRenderEntry[] = [];
const stableNoVisibleEntries = [] as VisibleRenderEntry[];
const stableNoGroupMessages: RenderedGroupMessageEntry[] = [];
const publicBoardChannel = { channel: 'public-board' } as const;
const consensusGroupBoxSx = { display: 'grid', gap: 1, px: 2, pt: 0.5, pb: 0.75 } as const;
const consensusGroupHeaderSx = { display: 'flex', justifyContent: 'center' } as const;
const consensusGroupHeaderControlsSx = { display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'center' } as const;
const consensusGroupColumnsSx = {
  display: 'grid',
  gap: 1,
  alignItems: 'start',
} as const;
const consensusMessageColumnBaseSx = {
  minWidth: 0,
  borderRadius: 'lg',
  border: '1px solid',
  backgroundColor: 'background.surface',
  overflow: 'hidden',
} as const;

function normalizeMessageChannel(message: DMessage) {
  const channel = message.metadata?.councilChannel;
  return channel?.channel === 'system' ? channel : publicBoardChannel;
}

function getConsensusGroupLabel(messages: DMessage[]): string {
  if (!messages.length)
    return '';
  const passIndex = messages[0]?.metadata?.consensus?.passIndex ?? 0;
  return `Pass ${passIndex + 1}`;
}

function groupVisibleConsensusMessages(messages: DMessage[]): GroupedVisibleEntry[] {
  const grouped: GroupedVisibleEntry[] = [];

  for (const message of messages) {
    const consensus = message.metadata?.consensus;
    if (consensus?.kind === 'deliberation' && typeof consensus.passIndex === 'number') {
      const lastEntry = grouped[grouped.length - 1];
      if (lastEntry?.kind === 'group') {
        const lastPassIndex = lastEntry.messages[0]?.metadata?.consensus?.passIndex;
        if (lastPassIndex === consensus.passIndex) {
          lastEntry.messages.push(message);
          continue;
        }
      }

      grouped.push({
        kind: 'group',
        key: `consensus-pass-${consensus.phaseId}-${consensus.passIndex}`,
        label: getConsensusGroupLabel([message]),
        messages: [message],
        passIndex: consensus.passIndex,
      });
      continue;
    }

    grouped.push({ kind: 'message', key: message.id, message });
  }

  return grouped;
}

type MessageDecoratorKind = 'leader' | 'provisional' | 'system';

type ConsensusGroupEntry = {
  kind: 'group';
  key: string;
  label: string;
  messages: DMessage[];
  passIndex: number;
};

type SingleMessageEntry = {
  kind: 'message';
  key: string;
  message: DMessage;
};

type GroupedVisibleEntry = ConsensusGroupEntry | SingleMessageEntry;

type RenderedGroupMessageEntry = {
  message: DMessage;
  topDecoratorKind: MessageDecoratorKind | undefined;
  topDecoratorCompact: true;
  topDecoratorFirst: boolean;
};

type GroupedVisibleRenderEntry =
  | (ConsensusGroupEntry & { renderedMessages: RenderedGroupMessageEntry[] })
  | (SingleMessageEntry & { topDecoratorKind: MessageDecoratorKind | undefined });

type CouncilTraceVisibleEntry = {
  kind: 'council-trace';
  key: string;
  trace: CouncilTraceRenderItem;
};

type VisibleRenderEntry = GroupedVisibleRenderEntry | CouncilTraceVisibleEntry;

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

const ConsensusGroupEntryView = React.memo(function ConsensusGroupEntryView(props: {
  entry: ConsensusGroupEntry & { renderedMessages: RenderedGroupMessageEntry[] };
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
  } = props;

  const groupTone = isExpanded ? 'primary' : 'neutral';
  const groupVariant = isExpanded ? 'solid' : 'soft';
  const groupBorderColor = isExpanded ? 'primary.outlinedBorder' : 'divider';
  const columnsSx = React.useMemo(() => ({
    ...consensusGroupColumnsSx,
    gridTemplateColumns: {
      xs: '1fr',
      md: `repeat(${entry.messages.length}, ${getConsensusGroupColumnWidth(entry.messages.length)})`,
    },
  }), [entry.messages.length]);
  const renderedMessages = React.useMemo(() => entry.renderedMessages, [entry.renderedMessages]);

  return (
    <ListItem sx={{ display: 'block', px: 0, py: 0 }}>
      <Box sx={consensusGroupBoxSx}>
        <Box sx={consensusGroupHeaderSx}>
          <Box sx={consensusGroupHeaderControlsSx}>
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
                <Box key={`group-column-${message.id}`} sx={{ ...consensusMessageColumnBaseSx, borderColor: groupBorderColor }}>
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
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </ListItem>
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
    && prevProps.participants === nextProps.participants;
});

function getMessageDecoratorKind(message: DMessage): MessageDecoratorKind | undefined {
  const messageChannel = normalizeMessageChannel(message);
  if (messageChannel.channel === 'system')
    return 'system';
  if (messageChannel.channel !== 'public-board')
    return undefined;
  if (message.metadata?.consensus?.kind !== 'deliberation')
    return undefined;
  if (message.metadata?.consensus?.leaderParticipantId === message.metadata?.author?.participantId)
    return 'leader';
  if (message.metadata?.consensus?.provisional)
    return 'provisional';
  return undefined;
}

function getGroupedVisibleRenderEntries(messages: DMessage[]): GroupedVisibleRenderEntry[] {
  return groupVisibleConsensusMessages(messages).map(entry => {
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

function getConsensusGroupColumnWidth(messageCount: number): string {
  if (messageCount >= 4)
    return 'minmax(19rem, 1fr)';
  if (messageCount === 3)
    return 'minmax(17rem, 1fr)';
  return 'minmax(15rem, 1fr)';
}

function getCouncilVisibleMessages(messages: Readonly<DMessage[]>, showSystemMessages: boolean) {
  return messages.filter(message => {
    const channel = normalizeMessageChannel(message);

    if (message.role === 'system')
      return showSystemMessages || channel.channel === 'public-board' || channel.channel === 'system';

    return channel.channel === 'public-board' || channel.channel === 'system';
  });
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
  onConversationExecuteHistory: (conversationId: DConversationId) => Promise<void>,
  onConversationNew: (forceNoRecycle: boolean, isIncognito: boolean, agentGroupSnapshot?: DAgentGroupSnapshot | null) => void,
  onTextDiagram: (diagramConfig: DiagramConfig | null) => void,
  onTextImagine: (conversationId: DConversationId, selectedText: string) => Promise<void>,
  setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  sx?: SxProps,
}) {

  // state
  const [isImagining, setIsImagining] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());
  const [expandedConsensusGroupKeys, setExpandedConsensusGroupKeys] = React.useState<Set<string>>(new Set());

  // external state
  const { notifyBooting } = useScrollToBottom();
  const danger_experimentalHtmlWebUi = useChatAutoSuggestHTMLUI();
  const [showSystemMessages] = useChatShowSystemMessages();
  const conversation = useChatStore(React.useCallback(({ conversations }) =>
    conversations.find(conversation => conversation.id === props.conversationId) ?? null,
  [props.conversationId]));
  const conversationMessages = conversation?.messages ?? stableNoMessages;
  const historyTokenCount = conversation?.tokenCount ?? 0;
  const participants = React.useMemo<DConversationParticipant[]>(() => {
    const rawParticipants = conversation?.participants?.length
      ? conversation.participants
      : conversation
        ? [
          {
            id: `human:${conversation.id}`,
            kind: 'human' as const,
            name: conversation.userSymbol || 'You',
            personaId: null,
            llmId: null,
          },
          {
            id: `assistant:${conversation.id}`,
            kind: 'assistant' as const,
            name: conversation.systemPurposeId,
            personaId: conversation.systemPurposeId,
            llmId: null,
            speakWhen: 'every-turn' as const,
            isLeader: true,
          },
        ]
        : stableNoParticipants;

    return rawParticipants
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
  }, [conversation]);
  const { _composerInReferenceToCount, ephemerals, showConsensusDeliberation, toggleShowConsensusDeliberation, councilSession } = useChatOverlayStore(props.conversationHandler?.conversationOverlayStore ?? null, useShallow(state => ({
    _composerInReferenceToCount: state.inReferenceTo?.length ?? 0,
    ephemerals: state.ephemerals?.length ? state.ephemerals : null,
    showConsensusDeliberation: state.showConsensusDeliberation,
    toggleShowConsensusDeliberation: state.toggleShowConsensusDeliberation,
    councilSession: state.councilSession,
  })));

  // derived state
  const { conversationHandler, conversationId, capabilityHasT2I, onConversationBranch, onConversationExecuteHistory, onTextDiagram, onTextImagine } = props;
  const composerCanAddInReferenceTo = _composerInReferenceToCount < 5;
  const composerHasInReferenceto = _composerInReferenceToCount > 0;
  const humanParticipantIds = React.useMemo(() => new Set(participants.filter(participant => participant.kind === 'human').map(participant => participant.id)), [participants]);
  const participantNames = React.useMemo(() => new Map(participants.map(participant => [participant.id, participant.name])), [participants]);

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
      conversationHandler.historyTruncateTo(messageId, offset);
      await onConversationExecuteHistory(conversationId);
    }
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
  const listSx: SxProps = React.useMemo(() => ({
    p: 0,
    ...props.sx,

    // we added these after removing the minSize={20} (%) from the containing panel.
    minWidth: '18rem',
    // minHeight: '180px', // not need for this, as it's already an overflow scrolling container, so one can reduce it to a pixel

    // fix for the double-border on the last message (one by the composer, one to the bottom of the message)
    // marginBottom: '-1px',

    // layout
    display: 'flex',
    flexDirection: 'column',
  }), [props.sx]);

  const filteredMessages = React.useMemo(() => getCouncilVisibleMessages(conversationMessages, showSystemMessages), [conversationMessages, showSystemMessages]);
  const hasConsensusDeliberation = React.useMemo(() => filteredMessages.some(message => message.metadata?.consensus?.kind === 'deliberation'), [filteredMessages]);
  const councilTracePlan = React.useMemo(() => buildCouncilTraceRenderPlan({
    messages: filteredMessages,
    participants,
    councilSession,
  }), [councilSession, filteredMessages, participants]);
  const councilTraceItem = councilTracePlan.traceItem;
  const consensusGroupKeys = React.useMemo(() => getGroupedVisibleRenderEntries(filteredMessages)
    .filter((entry): entry is ConsensusGroupEntry & { renderedMessages: RenderedGroupMessageEntry[] } => entry.kind === 'group')
    .map(entry => entry.key), [filteredMessages]);
  const latestConsensusGroupKey = consensusGroupKeys.length ? consensusGroupKeys[consensusGroupKeys.length - 1] : null;
  React.useEffect(() => {
    if (!showConsensusDeliberation || councilTraceItem || !latestConsensusGroupKey)
      return;

    setExpandedConsensusGroupKeys(prev => {
      if (prev.size === 1 && prev.has(latestConsensusGroupKey))
        return prev;
      return new Set([latestConsensusGroupKey]);
    });
  }, [councilTraceItem, latestConsensusGroupKey, showConsensusDeliberation]);
  const handleToggleConsensusGroupExpanded = React.useCallback((groupKey: string) => {
    setExpandedConsensusGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(groupKey))
        next.delete(groupKey);
      else
        next.add(groupKey);
      return next;
    });
  }, []);
  const groupedVisibleRenderEntries = React.useMemo(() => {
    if (!filteredMessages.length)
      return stableNoRenderEntries;

    const nextVisibleMessages = filteredMessages.filter(message => {
      const consensus = message.metadata?.consensus;
      if (consensus?.kind === 'deliberation')
        return councilTracePlan.showLegacyDeliberationToggle ? showConsensusDeliberation : false;
      return true;
    });

    if (!nextVisibleMessages.length)
      return stableNoRenderEntries;

    return getGroupedVisibleRenderEntries(nextVisibleMessages);
  }, [councilTracePlan.showLegacyDeliberationToggle, filteredMessages, showConsensusDeliberation]);
  const visibleRenderEntries = React.useMemo<VisibleRenderEntry[]>(() => {
    if (!groupedVisibleRenderEntries.length && !councilTraceItem)
      return stableNoVisibleEntries;

    if (!councilTraceItem)
      return groupedVisibleRenderEntries;

    const traceEntry: CouncilTraceVisibleEntry = {
      kind: 'council-trace',
      key: `council-trace-${councilTraceItem.phaseId}`,
      trace: councilTraceItem,
    };

    if (councilTraceItem.placement.mode === 'after-phase')
      return [...groupedVisibleRenderEntries, traceEntry];

    const nextEntries: VisibleRenderEntry[] = [];
    let inserted = false;
    for (const entry of groupedVisibleRenderEntries) {
      if (!inserted && entry.kind === 'message' && entry.message.id === councilTraceItem.placement.anchorMessageId) {
        nextEntries.push(traceEntry);
        inserted = true;
      }
      nextEntries.push(entry);
    }

    return inserted ? nextEntries : [...groupedVisibleRenderEntries, traceEntry];
  }, [councilTraceItem, groupedVisibleRenderEntries]);
  const visibleMessageCount = React.useMemo(() => visibleRenderEntries.reduce((count, entry) => count + (entry.kind === 'group' ? entry.messages.length : 1), 0), [visibleRenderEntries]);


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
    <List role='chat-messages-list' sx={listSx} onCopy={clipboardInterceptCtrlCForCleanup}>

      {hasConsensusDeliberation && councilTracePlan.showLegacyDeliberationToggle && (
        <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, pt: 1, pb: 0.5 }}>
          <Button
            size='sm'
            variant={showConsensusDeliberation ? 'solid' : 'soft'}
            color='neutral'
            onClick={toggleShowConsensusDeliberation}
          >
            {showConsensusDeliberation ? 'Hide deliberation' : 'Show deliberation'}
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

      {visibleRenderEntries.map((entry, idx) => {
          if (entry.kind === 'council-trace')
            return <CouncilTraceMessage key={entry.key} trace={entry.trace} />;

          if (entry.kind === 'group') {
            return (
              <ConsensusGroupEntryView
                key={entry.key}
                entry={entry}
                isExpanded={expandedConsensusGroupKeys.has(entry.key)}
                onToggleExpanded={handleToggleConsensusGroupExpanded}
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

            <ChatMessageMemoOrNot
              key={'msg-' + message.id}
              message={message}
              fitScreen={props.fitScreen}
              hasInReferenceTo={composerHasInReferenceto}
              isMobile={props.isMobile}
              isBottom={idx === visibleRenderEntries.length - 1}
              isImagining={isImagining}
              isSpeaking={isSpeaking}
              showAntPromptCaching={props.chatLLMAntPromptCaching}
              showUnsafeHtmlCode={danger_experimentalHtmlWebUi}
              topDecoratorKind={entry.topDecoratorKind}
              onAddInReferenceTo={!composerCanAddInReferenceTo ? undefined : handleAddInReferenceTo}
              onMessageAssistantFrom={handleMessageAssistantFrom}
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
            />

          );
        },
      )}

      {/* Render ephemerals (sidebar ReAct output widgets) at the bottom */}
      {!!ephemerals?.length && !!conversationHandler && (
        <Ephemerals
          ephemerals={ephemerals}
          conversationHandler={conversationHandler}
          sx={{
            mt: 'auto',
            overflowY: 'auto',
          }}
        />
      )}

    </List>
  );
}
