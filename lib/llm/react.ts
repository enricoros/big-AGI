import { ChatModelId } from '@/lib/data';
import { OpenAI } from '@/lib/modules/openai/openai.types';
import { reActPrompt } from './prompts';
import { callChat } from '@/lib/modules/openai/openai.client';

const actionRe = /^Action: (\w+): (.*)$/;

class Agent {
  messages: OpenAI.Wire.Chat.Message[] = [{ role: 'system', content: reActPrompt }];

  async chat(prompt: string, modelId: ChatModelId): Promise<string> {
    this.messages.push({ role: 'user', content: prompt });
    let content: string;
    try {
      content = (await callChat(modelId, this.messages, 500)).message.content;
    } catch (error: any) {
      content = `Error in callChat: ${error}`;
    }
    this.messages.push({ role: 'assistant', content });
    return content;
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