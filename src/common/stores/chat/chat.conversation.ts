import { defaultSystemPurposeId, SystemPurposeId, SystemPurposes } from '../../../data';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DModelReasoningEffort } from '~/common/stores/llms/llms.parameters';
import { agiUuid } from '~/common/util/idUtils';

import { DMessage, DMessageId, duplicateDMessage } from './chat.message';


/// Conversation

export type DConversationParticipantSpeakWhen = 'every-turn' | 'when-mentioned';
export type DConversationTurnTerminationMode = 'round-robin-per-human' | 'continuous' | 'council';
export type DConversationTurnTerminationModeLegacy = DConversationTurnTerminationMode | 'consensus';
export type DPersistedCouncilSessionStatus = 'paused' | 'interrupted' | 'stopped' | 'completed';

export const DEFAULT_COUNCIL_MAX_ROUNDS = null;
export const MIN_COUNCIL_MAX_ROUNDS = 1;
export const MAX_COUNCIL_MAX_ROUNDS = 99;
export const DEFAULT_COUNCIL_TRACE_AUTO_COLLAPSE_PREVIOUS_ROUNDS = true;
export const DEFAULT_COUNCIL_TRACE_AUTO_EXPAND_NEWEST_ROUND = true;

export function sanitizeCouncilMaxRounds(value: unknown): number | null {
  if (value == null || value === '')
    return DEFAULT_COUNCIL_MAX_ROUNDS;

  const parsedValue = typeof value === 'string' && value.trim()
    ? Number(value)
    : typeof value === 'number'
      ? value
      : NaN;

  if (!Number.isFinite(parsedValue))
    return DEFAULT_COUNCIL_MAX_ROUNDS;

  return Math.min(MAX_COUNCIL_MAX_ROUNDS, Math.max(MIN_COUNCIL_MAX_ROUNDS, Math.round(parsedValue)));
}

export function resolveCouncilMaxRounds(value: unknown): number {
  return sanitizeCouncilMaxRounds(value) ?? Number.POSITIVE_INFINITY;
}

export function sanitizeCouncilTraceAutoCollapsePreviousRounds(value: unknown): boolean {
  return typeof value === 'boolean'
    ? value
    : DEFAULT_COUNCIL_TRACE_AUTO_COLLAPSE_PREVIOUS_ROUNDS;
}

export function sanitizeCouncilTraceAutoExpandNewestRound(value: unknown): boolean {
  return typeof value === 'boolean'
    ? value
    : DEFAULT_COUNCIL_TRACE_AUTO_EXPAND_NEWEST_ROUND;
}

export function sanitizeConversationTurnTerminationMode(value: unknown): DConversationTurnTerminationMode {
  if (value === 'continuous')
    return 'continuous';
  if (value === 'council' || value === 'consensus')
    return 'council';
  return 'round-robin-per-human';
}

export interface DPersistedCouncilSession {
  status: DPersistedCouncilSessionStatus;
  executeMode: 'generate-content' | null;
  mode: DConversationTurnTerminationMode | null;
  phaseId: string | null;
  passIndex: number | null;
  workflowState?: import('../../../apps/chat/editors/_handleExecute.council').CouncilSessionState | null;
  canResume: boolean;
  interruptionReason: string | null;
  updatedAt: number | null;
}

export interface DConversationParticipant {
  id: string;
  kind: 'human' | 'assistant';
  name: string;
  personaId: SystemPurposeId | null;
  llmId: DLLMId | null;
  accentHue?: number;
  customPrompt?: string;
  speakWhen?: DConversationParticipantSpeakWhen;
  reasoningEffort?: DModelReasoningEffort;
  isLeader?: boolean;
}

export interface DConversation {
  id: DConversationId;                // unique identifier for this conversation

  messages: DMessage[];               // linear list of messages in this conversation

  // editable
  userTitle?: string;
  autoTitle?: string;

  isArchived?: boolean;               // TODO: this is too simple - convert to improved meta information - for now this will do

  // temp flags
  _isIncognito?: boolean;             // simple implementation: won't store this conversation (note: side effects should be evaluated, images seem to be gc'd correctly, but not sure if this is really incognito)
  userSymbol?: string;                // TODO: let the user customize this - there may be a mapping elsewhere, but this is small enough and will do for now

  // TODO: [x Head] - this should be the system purpose of current head of the conversation
  // there should be the concept of the audience of the current head
  systemPurposeId: SystemPurposeId;   // primary AI participant persona for backward compatibility
  participants?: DConversationParticipant[]; // persistent AI participant roster, primary participant first
  turnTerminationMode?: DConversationTurnTerminationMode;
  councilMaxRounds?: number | null;
  councilTraceAutoCollapsePreviousRounds?: boolean;
  councilTraceAutoExpandNewestRound?: boolean;
  agentGroupId?: string | null;
  councilSession?: DPersistedCouncilSession | null;
  councilOpLog?: import('../../../apps/chat/editors/_handleExecute.council.log').CouncilOp[] | null;

  // when updated is null, we don't have messages yet (timestamps as Date.now())
  created: number;                    // creation timestamp
  updated: number | null;             // last update timestamp

  // TODO: @deprecated - should be a view-related cache
  tokenCount: number;                 // f(messages, llmId)

  // Not persisted, used while in-memory, or temporarily by the UI
  // TODO: @deprecated - shouls not be in here - it's actually a per-message/operation thing
  _abortController: AbortController | null;

  // future additions:
  // draftUserMessage?: { text: string; attachments: any[] };
  // isMuted: boolean; isStarred: boolean;
  // participants: personaIds...[];
}

export type DConversationId = string;
const AGENT_ALIAS_ADJECTIVES = [
  'Amber',
  'Brisk',
  'Clever',
  'Delta',
  'Echo',
  'Fuzzy',
  'Golden',
  'Helix',
  'Iris',
  'Jade',
  'Keen',
  'Lunar',
  'Mosaic',
  'Nova',
  'Onyx',
  'Pixel',
  'Quartz',
  'Rapid',
  'Solar',
  'Turbo',
  'Ultra',
  'Velvet',
  'Wired',
  'Xeno',
  'Yonder',
  'Zen',
] as const;

const AGENT_ALIAS_NOUNS = [
  'Arrow',
  'Beacon',
  'Circuit',
  'Drift',
  'Engine',
  'Falcon',
  'Glyph',
  'Harbor',
  'Index',
  'Junction',
  'Kernel',
  'Lantern',
  'Matrix',
  'Node',
  'Orbit',
  'Pulse',
  'Quill',
  'Radar',
  'Signal',
  'Tensor',
  'Unit',
  'Vector',
  'Wave',
  'Yield',
  'Zenith',
] as const;


export function createHumanConversationParticipant(name: string = 'You'): DConversationParticipant {
  return {
    id: agiUuid('chat-participant-human'),
    kind: 'human',
    name,
    personaId: null,
    llmId: null,
  };
}

export function createAssistantConversationParticipant(personaId: SystemPurposeId, llmId: DLLMId | null = null, name?: string, speakWhen: DConversationParticipantSpeakWhen = 'every-turn', isLeader: boolean = false, accentHue?: number, reasoningEffort?: DModelReasoningEffort): DConversationParticipant {
  return {
    id: agiUuid('chat-participant-assistant'),
    kind: 'assistant',
    name: name || generateAssistantParticipantName(personaId),
    personaId,
    llmId,
    accentHue,
    speakWhen,
    reasoningEffort,
    isLeader,
  };
}

export function generateAssistantParticipantName(personaId: SystemPurposeId, existingNames: string[] = []): string {
  const normalizedExistingNames = new Set(existingNames.map(name => name.trim().toLowerCase()).filter(Boolean));
  const aliasPoolSize = AGENT_ALIAS_ADJECTIVES.length * AGENT_ALIAS_NOUNS.length;

  for (let attempt = 0; attempt < aliasPoolSize; attempt++) {
    const adjective = AGENT_ALIAS_ADJECTIVES[Math.floor(Math.random() * AGENT_ALIAS_ADJECTIVES.length)];
    const noun = AGENT_ALIAS_NOUNS[Math.floor(Math.random() * AGENT_ALIAS_NOUNS.length)];
    const candidate = `${adjective} ${noun}`;
    if (!normalizedExistingNames.has(candidate.toLowerCase()))
      return candidate;
  }

  const personaTitle = SystemPurposes[personaId]?.title || personaId;
  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${personaTitle} ${suffix}`;
    if (!normalizedExistingNames.has(candidate.toLowerCase()))
      return candidate;
  }

  return `${personaTitle} ${agiUuid('chat-participant-assistant').slice(0, 4)}`;
}

export function createDConversation(systemPurposeId?: SystemPurposeId): DConversation {
  return {
    id: agiUuid('chat-dconversation'),

    messages: [],

    // absent
    // userTitle: undefined,
    // autoTitle: undefined,
    // userSymbol: undefined,
    // isArchived: undefined,

    // @deprecated
    systemPurposeId: systemPurposeId || defaultSystemPurposeId,
    participants: [
      createHumanConversationParticipant(),
      createAssistantConversationParticipant(systemPurposeId || defaultSystemPurposeId, null, undefined, 'every-turn', true),
    ],
    turnTerminationMode: 'round-robin-per-human',
    // @deprecated
    tokenCount: 0,

    created: Date.now(),
    updated: Date.now(),

    _abortController: null,
  };
}

export function duplicateDConversation(conversation: DConversation, lastMessageId: undefined | DMessageId, skipVoid: boolean): DConversation {

  // cut short messages, if requested
  let messagesToKeep = conversation.messages.length; // By default, include all messages if messageId is null
  if (lastMessageId) {
    const messageIndex = conversation.messages.findIndex(_m => _m.id === lastMessageId);
    if (messageIndex >= 0)
      messagesToKeep = messageIndex + 1;
  }

  // auto-increment title (1)
  const newTitle = getNextBranchTitle(conversationTitle(conversation));

  return {
    id: agiUuid('chat-dconversation'),

    messages: conversation.messages
      .slice(0, messagesToKeep)
      .map(message => duplicateDMessage(message, skipVoid)), // [*] duplicate conversation - see downstream

    // userTitle: conversation.userTitle, // undefined
    autoTitle: newTitle,
    userSymbol: conversation.userSymbol,
    ...(conversation.isArchived !== undefined ? { isArchived: conversation.isArchived } : {}), // copy archival state if set

    systemPurposeId: conversation.systemPurposeId,
    ...(conversation.participants?.length ? {
      participants: conversation.participants.map(participant => ({ ...participant })),
    } : {}),
    ...(conversation.agentGroupId !== undefined ? { agentGroupId: conversation.agentGroupId } : {}),
    ...(conversation.councilOpLog?.length ? {
      councilOpLog: structuredClone(conversation.councilOpLog),
    } : {}),
    turnTerminationMode: conversation.turnTerminationMode ?? 'round-robin-per-human',
    councilMaxRounds: sanitizeCouncilMaxRounds(conversation.councilMaxRounds),
    councilTraceAutoCollapsePreviousRounds: sanitizeCouncilTraceAutoCollapsePreviousRounds(conversation.councilTraceAutoCollapsePreviousRounds),
    councilTraceAutoExpandNewestRound: sanitizeCouncilTraceAutoExpandNewestRound(conversation.councilTraceAutoExpandNewestRound),
    tokenCount: conversation.tokenCount,

    created: conversation.created,
    updated: Date.now(),

    _abortController: null,
  };
}


// helpers - title

export const conversationTitle = (conversation: DConversation, fallback?: string): string =>
  conversation.userTitle || conversation.autoTitle || fallback || ''; // 👋💬🗨️

function getNextBranchTitle(currentTitle: string): string {
  const numberPrefixRegex = /^\((\d+)\)\s+/; // Regex to find "(number) " at the beginning of the title
  const match = currentTitle.match(numberPrefixRegex);

  if (match) {
    const number = parseInt(match[1], 10) + 1;
    return currentTitle.replace(numberPrefixRegex, `(${number}) `);
  } else
    return `(1) ${currentTitle}`;
}


// helpers - System Instruction

export function hasSystemMessageInHistory(chatHistory: Readonly<DMessage[]>): boolean {
  return !!chatHistory?.length && chatHistory[0].role === 'system';
}

export function isSystemMessageUserEdited(message: DMessage): boolean {
  // make it explicit that '.updated' is the key to check for
  return message.role === 'system' && !!message.updated;
}

export function splitSystemMessageFromHistory(chatHistory: Readonly<DMessage[]>): {
  chatSystemInstruction: DMessage | null,
  chatHistory: Readonly<DMessage[]>,
} {
  const chatSystemInstruction = hasSystemMessageInHistory(chatHistory) ? chatHistory[0] : null;
  return {
    chatSystemInstruction,
    chatHistory: chatSystemInstruction ? chatHistory.slice(1) : chatHistory,
  };
}

export function excludeSystemMessages(messages: Readonly<DMessage[]>, showAll?: boolean): Readonly<DMessage[]> {
  if (showAll) return messages;
  return messages.filter(_m => _m.role !== 'system');
}

export function remapMessagesSysToUsr(messages: Readonly<DMessage[]> | null): DMessage[] {
  return (messages || []).map(_m => _m.role === 'system' ? { ..._m, role: 'user' as const } : _m); // (MUST: [0] is the system message of the original chat) cast system chat messages to the user role
}
