import { ApiChatInput, ApiChatResponse } from '../../pages/api/openai/chat';
import { ChatModelId } from '@/lib/data';
import { OpenAIAPI } from '@/types/api-openai';
import { getOpenAIConfiguration } from '@/lib/stores/store-settings';
import { reActPrompt } from './prompts';

const actionRe = /^Action: (\w+): (.*)$/;

class Agent {
  messages: OpenAIAPI.Chat.Message[] = [{ role: 'system', content: reActPrompt }];

  async chat(prompt: string, modelId: string): Promise<string> {
    this.messages.push({ role: 'user', content: prompt });
    const input: ApiChatInput = {
      api: getOpenAIConfiguration(),
      model: modelId,
      messages: this.messages,
      max_tokens: 500,
    };

    const response = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      console.error('Error from API call: ', response.status, response.statusText);
      return '';
    }

    const data: ApiChatResponse = await response.json();
    this.messages.push({ role: 'assistant', content: data.message.content });
    return data.message.content;
  }

  async reAct(question: string, modelId: ChatModelId, maxTurns = 5, log = console.log): Promise<string> {
    let i = 0;
    let nextPrompt = question;
    let lastObservation = '';

    while (i < maxTurns) {
      i += 1;
      log(`\n## Turn ${i}`);
      const result = await this.chat(nextPrompt, modelId);
      log(result);
      const actions = result
        .split('\n')
        .map((a: string) => actionRe.exec(a))
        .filter((a: RegExpExecArray | null) => a !== null) as RegExpExecArray[];
      if (actions.length > 0) {
        const action = actions[0][1];
        const actionInput = actions[0][2];
        if (!(action in knownActions)) {
          throw new Error(`Unknown action: ${action}: ${actionInput}`);
        }
        log(` -- running ${action} ${actionInput}`);
        const observation = await knownActions[action](actionInput);
        log(`Observation: ${observation}`);
        nextPrompt = `Observation: ${observation}`;
        lastObservation = observation;
      } else {
        log(`Result: ${result}`);
        return result;
      }
    }

    return lastObservation;
  }
}

export { Agent };

async function wikipedia(q: string): Promise<string> {
  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      q,
    )}&format=json&origin=*`,
  );
  const data = await response.json();
  return data.query.search[0].snippet;
}

function calculate(what: string): string {
  return String(eval(what));
}

type ActionFunction = (input: string) => Promise<string>;

const knownActions: { [key: string]: ActionFunction } = {
  wikipedia: wikipedia,
  calculate: async (what: string) => String(calculate(what)),
};