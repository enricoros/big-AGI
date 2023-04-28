import { OpenAI } from '@/modules/openai/openai.types';
import { callApiSearchGoogle } from '@/modules/search/search.client';
import { callChat } from '@/modules/openai/openai.client';

import { ChatModelId } from '../../data';
import { reActPrompt } from './prompts';


const actionRe = /^Action: (\w+): (.*)$/;


/**
 * State - Abstraction used for serialization, save/restore, inspection, debugging, rendering, etc.
 *
 * Keep this as minimal and flat as possible
 *   - initialize(): will create the state with initial values
 *   - loop() is a function that will update the state (in place)
 */
export interface State {
  messages: OpenAI.Wire.Chat.Message[];
  nextPrompt: string;
  lastObservation: string;
  result: string | undefined;
}

export class Agent {

  // NOTE: this is here for demo, but the whole loop could be moved to the caller's event loop
  async reAct(question: string, modelId: ChatModelId, maxTurns = 5, log: (...data: any[]) => void = console.log): Promise<string> {
    let i = 0;
    // TODO: to initialize with previous chat messages to provide context.
    const S: State = await this.initialize(question);
    while (i < maxTurns && S.result === undefined) {
      i++;
      log(`\n## Turn ${i}`);
      await this.step(S, modelId, log);
    }
    return S.result?.startsWith('Answer: ') ? S.result.slice(8) : S.result || 'No result';
  }

  initialize(question: string): State {
    return {
      messages: [{ role: 'system', content: reActPrompt }],
      nextPrompt: question,
      lastObservation: '',
      result: undefined,
    };
  }

  async chat(S: State, prompt: string, modelId: ChatModelId): Promise<string> {
    S.messages.push({ role: 'user', content: prompt });
    let content: string;
    try {
      content = (await callChat(modelId, S.messages, 500)).message.content;
    } catch (error: any) {
      content = `Error in callChat: ${error}`;
    }
    S.messages.push({ role: 'assistant', content });
    return content;
  }

  async step(S: State, modelId: ChatModelId, log: (...data: any[]) => void = console.log) {
    log('→ reAct [...' + (S.messages.length + 1) + ']: ' + S.nextPrompt);
    const result = await this.chat(S, S.nextPrompt, modelId);
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
      log(`→ running ${action} "${actionInput}"`);
      const observation = await knownActions[action](actionInput);
      log(`Observation: ${observation}`);
      S.nextPrompt = `Observation: ${observation}`;
      S.lastObservation = observation;
    } else {
      log('↙ done');
      // log(`Result: ${result}`);
      S.result = result;
    }
  }
}


type ActionFunction = (input: string) => Promise<string>;

async function wikipedia(q: string): Promise<string> {
  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`,
  );
  const data = await response.json();
  return data.query.search[0].snippet;
}

async function search(query: string): Promise<string> {
  try {
    const data = await callApiSearchGoogle(query);
    return JSON.stringify(data);
  } catch (error) {
    console.error('Error fetching search results:', (error as Error).message);
    return 'An error occurred while searching the internet. Missing API Key?';
  }
}

const calculate = async (what: string): Promise<string> => String(eval(what));

const knownActions: { [key: string]: ActionFunction } = {
  wikipedia: wikipedia,
  google: search,
  calculate: calculate,
};