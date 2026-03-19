import assert from 'node:assert/strict';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createAssistantConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent } from '~/common/stores/chat/chat.message';

import { ChatMessage } from './ChatMessage';


function renderChatMessageMarkup(updated: number | null) {
  const message = createDMessageTextContent('system', 'Council exhausted after 1 rounds.');
  message.created = 100;
  message.updated = updated;

  return renderToStaticMarkup(
    <ul>
      <ChatMessage
        message={message}
        fitScreen={false}
        isMobile={false}
        topDecoratorKind='system'
      />
    </ul>,
  );
}

function renderUserChatMessageMarkup() {
  const message = createDMessageTextContent('user', 'Ideas de negocio de suscripcion SaaS para Canarias');

  return renderToStaticMarkup(
    <ul>
      <ChatMessage
        message={message}
        fitScreen={false}
        isMobile={false}
      />
    </ul>,
  );
}

function renderRenamedAssistantChatMessageMarkup() {
  const participant = createAssistantConversationParticipant('Developer', 'test-llm', 'Planificador', 'every-turn', true);
  const message = createDMessageTextContent('assistant', 'Respuesta del lider.');
  message.metadata = {
    author: {
      participantId: participant.id,
      participantName: 'Leader',
      personaId: participant.personaId,
      llmId: participant.llmId,
    },
  };

  return renderToStaticMarkup(
    <ul>
      <ChatMessage
        message={message}
        fitScreen={false}
        isMobile={false}
        participants={[participant]}
      />
    </ul>,
  );
}

test('system messages created with updated equal to created do not show the edited warning', () => {
  const markup = renderChatMessageMarkup(100);

  assert.match(markup, /System notification/);
  assert.doesNotMatch(markup, /Council notification/);
  assert.doesNotMatch(markup, /modified by user - auto-update disabled/);
});

test('system messages updated after creation still show the edited warning', () => {
  const markup = renderChatMessageMarkup(101);

  assert.match(markup, /modified by user - auto-update disabled/);
});

test('user messages publish their bubble color to the conversation minimap', () => {
  const markup = renderUserChatMessageMarkup();

  assert.match(markup, /data-chat-minimap-background-color="var\(--joy-palette-primary-plainHoverBg\)"/);
  assert.match(markup, /data-chat-minimap-border-color="var\(--joy-palette-primary-plainHoverBg\)"/);
});

test('assistant messages prefer the current participant name over stale author metadata', () => {
  const markup = renderRenamedAssistantChatMessageMarkup();

  assert.match(markup, />Planificador</);
  assert.doesNotMatch(markup, /aria-label="Leader"/);
  assert.doesNotMatch(markup, />Leader</);
});
