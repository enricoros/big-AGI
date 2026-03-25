import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';


function escapeMentionToken(mention: string): string {
  return mention.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMentionMatchIndex(messageText: string, mention: string): number | null {
  const normalizedMention = mention.trim();
  if (!normalizedMention)
    return null;

  const explicitMentionRegex = new RegExp(`(^|[^\\p{L}\\p{N}])@${escapeMentionToken(normalizedMention)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const explicitMatch = explicitMentionRegex.exec(messageText);
  if (explicitMatch)
    return explicitMatch.index + ((explicitMatch[0] ?? '').length - (`@${normalizedMention}`).length);

  const bareMentionRegex = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeMentionToken(normalizedMention)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const bareMatch = bareMentionRegex.exec(messageText);
  if (bareMatch)
    return bareMatch.index + ((bareMatch[0] ?? '').length - normalizedMention.length);

  return null;
}

function getAssistantMessagesSinceLatestUser(messages: Readonly<DMessage[]>, latestUserMessageId: string | null): DMessage[] {
  if (!latestUserMessageId)
    return [];

  const latestUserIndex = messages.findIndex(message => message.id === latestUserMessageId);
  if (latestUserIndex < 0)
    return [];

  return messages.slice(latestUserIndex + 1)
    .filter(message => message.role === 'assistant' && !!message.metadata?.author?.participantId);
}

function wasParticipantMentioned(message: DMessage | null, participant: DConversationParticipant): boolean {
  return getMentionedParticipants(message, [participant]).length > 0;
}

export function getMentionedParticipants(
  message: DMessage | null,
  participants: DConversationParticipant[],
  excludeParticipantIds: ReadonlySet<string> = new Set(),
): DConversationParticipant[] {
  if (!message)
    return [];

  const messageText = messageFragmentsReduceText(message.fragments).trim();
  const implicitReplyParticipants = (message.metadata?.inReferenceTo ?? [])
    .filter(reference => reference.mCarryAuthorMention !== false)
    .map(reference => {
      const participantId = reference.mAuthorParticipantId?.trim() || null;
      if (participantId)
        return participants.find(participant => participant.id === participantId) ?? null;

      const participantName = reference.mAuthorParticipantName?.trim() || null;
      if (!participantName)
        return null;

      return participants.find(participant => participant.name?.trim() === participantName) ?? null;
    })
    .filter((participant): participant is DConversationParticipant => !!participant && !excludeParticipantIds.has(participant.id));

  const implicitReplyParticipantIds = new Set(implicitReplyParticipants.map(participant => participant.id));
  if (!messageText)
    return implicitReplyParticipants;

  const allMentionMatch = new RegExp(`(^|[^\\p{L}\\p{N}])@all(?=$|[^\\p{L}\\p{N}])`, 'iu').exec(messageText);
  const explicitMentions = participants
    .filter(participant => !excludeParticipantIds.has(participant.id) && !!participant.name?.trim())
    .map(participant => {
      const matchIndex = findMentionMatchIndex(messageText, participant.name ?? '');
      return matchIndex !== null ? { participant, index: matchIndex } : null;
    })
    .filter((entry): entry is { participant: DConversationParticipant; index: number } => !!entry)
    .sort((a, b) => a.index - b.index)
    .map(entry => entry.participant);

  const mergedExplicitMentions = [
    ...implicitReplyParticipants,
    ...explicitMentions.filter(participant => !implicitReplyParticipantIds.has(participant.id)),
  ];

  if (!allMentionMatch)
    return mergedExplicitMentions;

  const explicitMentionIds = new Set(mergedExplicitMentions.map(participant => participant.id));
  const remainingParticipants = participants.filter(participant => !excludeParticipantIds.has(participant.id) && !explicitMentionIds.has(participant.id));
  return [...mergedExplicitMentions, ...remainingParticipants];
}

export function hasStopToken(message: DMessage | null): boolean {
  if (!message)
    return false;

  const messageText = messageFragmentsReduceText(message.fragments).trim();
  return /(^|[^\p{L}\p{N}])@stop(?=$|[^\p{L}\p{N}])/iu.test(messageText);
}

export function getRunnableParticipants(participants: DConversationParticipant[], latestUserMessage: DMessage | null): DConversationParticipant[] {
  return participants.filter(participant => {
    if (!participant.personaId)
      return false;
    return participant.speakWhen !== 'when-mentioned' || wasParticipantMentioned(latestUserMessage, participant);
  });
}

export function mergeParticipantsInRosterOrder(
  roster: DConversationParticipant[],
  primaryParticipants: DConversationParticipant[],
  extraParticipants: DConversationParticipant[],
): DConversationParticipant[] {
  const primaryIds = new Set(primaryParticipants.map(participant => participant.id));
  const extraIds = new Set(extraParticipants.map(participant => participant.id));
  return roster.filter(participant => primaryIds.has(participant.id) || extraIds.has(participant.id));
}

export function getParticipantsRemainingThisTurn(
  messages: Readonly<DMessage[]>,
  latestUserMessageId: string | null,
  runnableParticipants: DConversationParticipant[],
): DConversationParticipant[] {
  if (!latestUserMessageId)
    return runnableParticipants;

  const spokenParticipantIds = new Set(getAssistantMessagesSinceLatestUser(messages, latestUserMessageId)
    .map(message => message.metadata?.author?.participantId)
    .filter((participantId): participantId is string => !!participantId));

  return runnableParticipants.filter(participant => !spokenParticipantIds.has(participant.id));
}

export function getContinuousParticipants(
  messages: Readonly<DMessage[]>,
  latestUserMessageId: string | null,
  runnableParticipants: DConversationParticipant[],
): DConversationParticipant[] {
  if (!latestUserMessageId || runnableParticipants.length <= 1)
    return runnableParticipants;

  const assistantMessagesThisTurn = getAssistantMessagesSinceLatestUser(messages, latestUserMessageId);
  const latestAssistantParticipantId = assistantMessagesThisTurn.at(-1)?.metadata?.author?.participantId ?? null;
  if (!latestAssistantParticipantId)
    return runnableParticipants;

  const latestSpeakerIndex = runnableParticipants.findIndex(participant => participant.id === latestAssistantParticipantId);
  if (latestSpeakerIndex < 0)
    return runnableParticipants;

  return [
    ...runnableParticipants.slice(latestSpeakerIndex + 1),
    ...runnableParticipants.slice(0, latestSpeakerIndex + 1),
  ];
}
