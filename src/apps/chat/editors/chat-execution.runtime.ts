import type { DConversationId, DPersistedCouncilSession } from '~/common/stores/chat/chat.conversation';
import type { DMessage, DMessageGenerator } from '~/common/stores/chat/chat.message';
import type { DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import type { CouncilSessionState as OverlayCouncilSessionState } from '~/common/chat-overlay/store-perchat-composer_slice';
import type { CouncilOp } from './_handleExecute.council.log';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import type { DMessageCouncilChannel } from '~/common/stores/chat/chat.message';
import type { SystemPurposeId } from '../../../data';

import type { PersonaRunOptions, PersonaRunResult } from './chat-persona';


export interface ChatExecutionEphemeralHandle {
  updateText: (text: string) => void;
  updateState: (state: object) => void;
  markAsDone: () => void;
}

export interface ChatExecutionSession {
  readonly conversationId: DConversationId;

  historyViewHeadOrThrow: (scope: string) => Readonly<DMessage[]>;
  historyFindMessageOrThrow: (messageId: string) => Readonly<DMessage> | undefined;
  historyClear: () => void;

  messageAppend: (message: DMessage) => void;
  messageAppendAssistantText: (text: string, generatorName: Extract<DMessageGenerator, { mgt: 'named' }>['name']) => void;
  messageAppendAssistantPlaceholder: (placeholderText: string, update?: Partial<DMessage>) => { assistantMessageId: string; placeholderFragmentId: DMessageFragmentId };
  messageEdit: (messageId: string, update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>), messageComplete: boolean, touch: boolean) => void;
  messageFragmentAppend: (messageId: string, fragment: DMessageFragment, complete: boolean, touch: boolean) => void;
  messageFragmentDelete: (messageId: string, fragmentId: string, complete: boolean, touch: boolean) => void;
  messageFragmentReplace: (messageId: string, fragmentId: string, newFragment: DMessageFragment, messageComplete: boolean) => void;

  beamInvoke: (viewHistory: Readonly<DMessage[]>, importMessages: DMessage[], destReplaceMessageId: DMessage['id'] | null) => void;
  createEphemeralHandler: (title: string, initialText: string) => ChatExecutionEphemeralHandle;

  setAbortController: (abortController: AbortController | null, debugScope: string) => void;
  clearAbortController: (debugScope: string) => void;

  getCouncilSession: () => OverlayCouncilSessionState;
  setCouncilSession: (session: OverlayCouncilSessionState) => void;
  updateCouncilSession: (update: Partial<OverlayCouncilSessionState>) => void;
  resetCouncilSession: () => void;
  persistCouncilState: (session: DPersistedCouncilSession | null, councilOpLog: CouncilOp[] | null) => void;
}

export interface ChatExecutionRuntimeRunPersonaParams {
  assistantLlmId: DLLMId;
  conversationId: DConversationId;
  systemPurposeId: SystemPurposeId;
  keepAbortController?: boolean;
  sharedAbortController?: AbortController;
  participant?: DConversationParticipant;
  sourceHistory?: Readonly<DMessage[]>;
  createPlaceholder?: boolean;
  messageChannel?: DMessageCouncilChannel | null;
  runOptions?: PersonaRunOptions;
  session: ChatExecutionSession;
}

export interface ChatExecutionRuntime {
  getSession: (conversationId: DConversationId) => ChatExecutionSession;
  createAbortController: () => AbortController;
  runPersona: (params: ChatExecutionRuntimeRunPersonaParams) => Promise<PersonaRunResult>;
}
