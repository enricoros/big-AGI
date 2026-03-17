import assert from 'node:assert/strict';
import test from 'node:test';

import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent } from '~/common/stores/chat/chat.message';

import {
  getContinuousParticipants,
  getMentionedParticipants,
  getParticipantsRemainingThisTurn,
  getRunnableParticipants,
  hasStopToken,
  mergeParticipantsInRosterOrder,
} from './_handleExecute.multiAgent';


const humanParticipant: DConversationParticipant = {
  id: 'human-1',
  kind: 'human',
  name: 'You',
  personaId: null,
  llmId: null,
};

const alphaParticipant: DConversationParticipant = {
  id: 'assistant-alpha',
  kind: 'assistant',
  name: 'Alpha',
  personaId: 'Generic',
  llmId: 'model-alpha',
  speakWhen: 'every-turn',
};

const betaParticipant: DConversationParticipant = {
  id: 'assistant-beta',
  kind: 'assistant',
  name: 'Beta',
  personaId: 'Developer',
  llmId: 'model-beta',
  speakWhen: 'when-mentioned',
};

const gammaParticipant: DConversationParticipant = {
  id: 'assistant-gamma',
  kind: 'assistant',
  name: 'Gamma',
  personaId: 'Designer',
  llmId: 'model-gamma',
  speakWhen: 'every-turn',
};

const assistantParticipants = [alphaParticipant, betaParticipant, gammaParticipant];

test('getMentionedParticipants merges reply mentions, explicit mentions, and @all in roster order', () => {
  const latestMessage = createDMessageTextContent('user', 'Following up with @Gamma and @all');
  latestMessage.metadata = {
    inReferenceTo: [{
      mrt: 'dmsg',
      mText: 'previous answer',
      mRole: 'assistant',
      mAuthorParticipantId: betaParticipant.id,
      mAuthorParticipantName: betaParticipant.name,
      mCarryAuthorMention: true,
    }],
  };

  const participants = getMentionedParticipants(latestMessage, assistantParticipants);

  assert.deepEqual(participants.map(participant => participant.id), [
    betaParticipant.id,
    gammaParticipant.id,
    alphaParticipant.id,
  ]);
});

test('getMentionedParticipants ignores partial word matches', () => {
  const latestMessage = createDMessageTextContent('user', 'The alphabet soup should not ping anyone');

  const participants = getMentionedParticipants(latestMessage, assistantParticipants);

  assert.deepEqual(participants, []);
});

test('getRunnableParticipants only includes mention-only agents when they were mentioned', () => {
  const latestMessage = createDMessageTextContent('user', 'Please ask Beta to review this');

  const participants = getRunnableParticipants(assistantParticipants, latestMessage);

  assert.deepEqual(participants.map(participant => participant.id), [
    alphaParticipant.id,
    betaParticipant.id,
    gammaParticipant.id,
  ]);
});

test('getParticipantsRemainingThisTurn excludes assistants that already replied after the latest user message', () => {
  const latestUserMessage = createDMessageTextContent('user', 'What do you think?');
  latestUserMessage.id = 'user-1';

  const assistantReply = createDMessageTextContent('assistant', 'Alpha reply');
  assistantReply.metadata = {
    author: {
      participantId: alphaParticipant.id,
      participantName: alphaParticipant.name,
      personaId: alphaParticipant.personaId,
      llmId: alphaParticipant.llmId,
    },
  };

  const remaining = getParticipantsRemainingThisTurn([
    createDMessageTextContent('user', 'Earlier question'),
    latestUserMessage,
    assistantReply,
  ], latestUserMessage.id, assistantParticipants);

  assert.deepEqual(remaining.map(participant => participant.id), [
    betaParticipant.id,
    gammaParticipant.id,
  ]);
});

test('getContinuousParticipants rotates after the latest assistant speaker', () => {
  const latestUserMessage = createDMessageTextContent('user', 'Let the room continue');
  latestUserMessage.id = 'user-2';

  const alphaReply = createDMessageTextContent('assistant', 'Alpha reply');
  alphaReply.metadata = { author: { participantId: alphaParticipant.id } };

  const betaReply = createDMessageTextContent('assistant', 'Beta reply');
  betaReply.metadata = { author: { participantId: betaParticipant.id } };

  const rotated = getContinuousParticipants([
    latestUserMessage,
    alphaReply,
    betaReply,
  ], latestUserMessage.id, assistantParticipants);

  assert.deepEqual(rotated.map(participant => participant.id), [
    gammaParticipant.id,
    alphaParticipant.id,
    betaParticipant.id,
  ]);
});

test('mergeParticipantsInRosterOrder keeps primary and directly mentioned assistants in roster order', () => {
  const merged = mergeParticipantsInRosterOrder(
    assistantParticipants,
    [alphaParticipant, gammaParticipant],
    [betaParticipant],
  );

  assert.deepEqual(merged.map(participant => participant.id), [
    alphaParticipant.id,
    betaParticipant.id,
    gammaParticipant.id,
  ]);
});

test('hasStopToken only triggers on the explicit control mention', () => {
  assert.equal(hasStopToken(createDMessageTextContent('user', 'please @stop now')), true);
  assert.equal(hasStopToken(createDMessageTextContent('user', 'unstoppable momentum')), false);
  assert.equal(hasStopToken(null), false);
});

test('getRunnableParticipants ignores the human participant', () => {
  const latestMessage = createDMessageTextContent('user', 'Everyone can weigh in');

  const participants = getRunnableParticipants([humanParticipant, ...assistantParticipants], latestMessage);

  assert.deepEqual(participants.map(participant => participant.id), [
    alphaParticipant.id,
    gammaParticipant.id,
  ]);
});
