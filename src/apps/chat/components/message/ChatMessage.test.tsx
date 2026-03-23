import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createAssistantConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent } from '~/common/stores/chat/chat.message';

import { ChatMessage, shouldShowRestartInCouncilAction } from './ChatMessage';


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

function renderSingleAgentModelNamedAssistantChatMessageMarkup() {
  const participant = createAssistantConversationParticipant('Developer', 'openai-gpt-5.4', 'Echo Kernel', 'every-turn', true);
  const message = createDMessageTextContent('assistant', 'Respuesta con nombre de modelo.');
  message.metadata = {
    author: {
      participantId: participant.id,
      participantName: participant.name,
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
        participantDisplayNamesById={new Map([[participant.id, 'GPT 5.4']])}
        onAppendMention={() => undefined}
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

test('assistant messages can display a model label while keeping canonical mention text', () => {
  const markup = renderSingleAgentModelNamedAssistantChatMessageMarkup();
  const source = readFileSync(new URL('./ChatMessage.tsx', import.meta.url), 'utf8');

  assert.match(markup, />GPT 5\.4</);
  assert.match(markup, /Click to mention @GPT 5\.4/);
  assert.match(source, /onClick=\{\(\) => handleAppendMention\(`@\$\{messageAuthorName\}`\)\}/);
});

test('restart in council action is shown only for user messages with explicit participant recipients in council mode', () => {
  assert.equal(shouldShowRestartInCouncilAction({
    initialRecipients: [{ rt: 'participant', participantId: 'leader-1' }],
    messageRole: 'user',
    turnTerminationMode: 'council',
  }), true);

  assert.equal(shouldShowRestartInCouncilAction({
    initialRecipients: [{ rt: 'public-board' }],
    messageRole: 'user',
    turnTerminationMode: 'council',
  }), false);

  assert.equal(shouldShowRestartInCouncilAction({
    initialRecipients: [{ rt: 'participant', participantId: 'leader-1' }],
    messageRole: 'assistant',
    turnTerminationMode: 'council',
  }), false);

  assert.equal(shouldShowRestartInCouncilAction({
    initialRecipients: [{ rt: 'participant', participantId: 'leader-1' }],
    messageRole: 'user',
    turnTerminationMode: 'round-robin-per-human',
  }), false);
});

test('upstream resume block delegates to the message resume handler instead of placeholder console errors', () => {
  const source = readFileSync(new URL('./ChatMessage.tsx', import.meta.url), 'utf8');

  assert.match(source, /onResume=\{props\.onMessageUpstreamResume \? handleUpstreamResume : undefined\}/);
  assert.doesNotMatch(source, /onResume=\{console\.error\}/);
  assert.doesNotMatch(source, /onCancel=\{console\.error\}/);
  assert.doesNotMatch(source, /onDelete=\{console\.error\}/);
});
