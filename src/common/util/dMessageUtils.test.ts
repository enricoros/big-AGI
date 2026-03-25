import assert from 'node:assert/strict';
import test from 'node:test';

import { createAssistantConversationParticipant } from '~/common/stores/chat/chat.conversation';

import {
  findParticipantMentionMatchIndex,
  findParticipantMentions,
  getChatMessageMinimapAccentDataAttributes,
  getParticipantAccentSx,
  getParticipantMentionAliases,
} from './dMessageUtils';


test('getParticipantMentionAliases includes slash-separated aliases after the full display name', () => {
  assert.deepEqual(
    getParticipantMentionAliases('Orquestador / Chief of Staff'),
    ['Orquestador / Chief of Staff', 'Orquestador', 'Chief of Staff'],
  );
});

test('findParticipantMentions matches slash-separated participant aliases', () => {
  const participants = [
    createAssistantConversationParticipant('Developer', 'test-llm', 'Orquestador / Chief of Staff', 'when-mentioned', true),
  ];

  const matches = findParticipantMentions('@Orquestador, añado capa de contexto.', participants);

  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.mentionText, '@Orquestador');
  assert.equal(matches[0]?.mentionName, 'Orquestador');
});

test('findParticipantMentions ignores non-existent mentions when no matching participant exists', () => {
  const participants = [
    createAssistantConversationParticipant('Developer', 'test-llm', 'Planificador', 'when-mentioned', true),
  ];

  assert.deepEqual(
    findParticipantMentions('Texto con @mentions y @Planificador.', participants),
    [{
      mentionText: '@Planificador',
      mentionName: 'Planificador',
      mentionStart: 22,
      mentionEnd: 35,
    }],
  );
});

test('findParticipantMentions does not detect arbitrary mentions without a participant roster', () => {
  assert.deepEqual(
    findParticipantMentions('Texto con @mentions y @fantasma.'),
    [],
  );
});

test('findParticipantMentions still detects @all without a participant roster', () => {
  assert.deepEqual(
    findParticipantMentions('Texto con @all para todos.'),
    [{
      mentionText: '@all',
      mentionName: 'all',
      mentionStart: 10,
      mentionEnd: 14,
    }],
  );
});

test('findParticipantMentionMatchIndex matches slash-separated aliases in direct mention form', () => {
  assert.equal(
    findParticipantMentionMatchIndex('@Orquestador, añado capa de contexto.', 'Orquestador / Chief of Staff'),
    0,
  );
});

test('chat message minimap attrs reuse the participant soft accent colors', () => {
  const participant = createAssistantConversationParticipant('Developer', 'test-llm', 'Planificador', 'every-turn', true, 210);
  const accentSx = getParticipantAccentSx(participant.name, [participant], 'soft') as Record<string, unknown>;

  assert.deepStrictEqual(getChatMessageMinimapAccentDataAttributes(true, 'primary', accentSx), {
    backgroundColor: 'var(--joy-palette-primary-softBg)',
    borderColor: 'var(--joy-palette-primary-outlinedBorder)',
  });
  assert.deepStrictEqual(getChatMessageMinimapAccentDataAttributes(false, 'primary', accentSx), {});
});
