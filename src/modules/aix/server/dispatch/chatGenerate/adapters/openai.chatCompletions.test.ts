import assert from 'node:assert/strict';
import test from 'node:test';

import { aixToOpenAIChatCompletions } from './openai.chatCompletions';


test('OpenAI chat completions ensures OpenRouter requests end with a user message', () => {
  const payload = aixToOpenAIChatCompletions(
    'openrouter',
    { id: 'anthropic/claude-opus-4.6', maxTokens: undefined, temperature: undefined, topP: undefined, acceptsOutputs: ['text'] } as any,
    {
      systemMessage: null,
      chatSequence: [{
        role: 'model',
        parts: [{ pt: 'text', text: 'Assistant reply.' }],
      }],
    },
    true,
  );

  assert.equal(payload.messages.at(-1)?.role, 'user');
});
