/*
 * porting of implementation from here: https://til.simonwillison.net/llms/python-react-pattern
 */

import type { DLLMId } from '~/modules/llms/store-llms';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';
import { callApiSearchGoogle } from '~/modules/google/search.client';
import { callBrowseFetchPage } from '~/modules/browse/browse.client';
import { llmChatGenerateOrThrow, VChatMessageIn } from '~/modules/llms/llm.client';

import { frontendSideFetch } from '~/common/util/clientFetchers';


// prompt to implement the ReAct paradigm: https://arxiv.org/abs/2210.03629
const reActPrompt = (enableBrowse: boolean): string =>
  `You are a Question Answering AI with reasoning ability.
You will receive a Question from the User.
In order to answer any Question, you run in a loop of Thought, Action, PAUSE, Observation.
If from the Thought or Observation you can derive the answer to the Question, you MUST also output an "Answer: ", followed by the answer and the answer ONLY, without explanation of the steps used to arrive at the answer.
You will use "Thought: " to describe your thoughts about the question being asked.
You will use "Action: " to run one of the actions available to you - then return PAUSE. NEVER continue generating "Observation: " or "Answer: " in the same response that contains PAUSE.
"Observation" will be presented to you as the result of previous "Action".
If the "Observation" you received is not related to the question asked, or you cannot derive the answer from the observation, change the Action to be performed and try again.

ALWAYS assume today as {{Today}} when dealing with questions regarding dates.
Never mention your knowledge cutoff date

Your available "Actions" are:

google:
e.g. google: Django
Returns google custom search results
ALWAYS look up on google when the question is related to live events or factual information, such as sports, news, or weather.

` + (enableBrowse ? `loadUrl:
e.g. loadUrl: https://arxiv.org/abs/1706.03762
Opens the given URL and displays it

` : '') + `calculate:
e.g. calculate: 4 * 7 / 3
Runs a calculation and returns the number - uses Python so be sure to use floating point syntax if necessary

wikipedia:
e.g. wikipedia: Django
Returns a summary from searching Wikipedia

ONLY look things up on Wikipedia when explicitly asked to do so.

Example session:

Question: What is the capital of France?
Thought: I should look up France on Wikipedia
Action: wikipedia: France

You will be called again with the following, along with all previous messages between the User and You:

Observation: France is a country. The capital is Paris.

You then output:
Answer: The capital of France is Paris
`;


const actionRe = /^Action: (\w+): (.*)$/;


/**
 * State - Abstraction used for serialization, save/restore, inspection, debugging, rendering, etc.
 *
 * Keep this as minimal and flat as possible
 *   - initialize(): will create the state with initial values
 *   - loop() is a function that will update the state (in place)
 */
interface State {
  messages: VChatMessageIn[];
  nextPrompt: string;
  lastObservation: string;
  result: string | undefined;
}

export class Agent {

  // NOTE: this is here for demo, but the whole loop could be moved to the caller's event loop
  async reAct(question: string, llmId: DLLMId, maxTurns = 5, enableBrowse = false,
              appendLog: (...data: any[]) => void = console.log,
              showState: (state: object) => void): Promise<string> {
    let i = 0;
    // TODO: to initialize with previous chat messages to provide context.
    const S: State = this.initialize(`Question: ${question}`, llmId, enableBrowse, appendLog);
    showState(S);
    while (i < maxTurns && S.result === undefined) {
      i++;
      appendLog(`\n## Turn ${i}`);
      await this.step(S, llmId, appendLog);
      showState(S);
    }
    // return only the 'Answer: ' part of the result
    if (S.result) {
      const idx = S.result.indexOf('Answer: ');
      if (idx !== -1)
        return S.result.slice(idx + 8);
    }
    return S.result || 'No result';
  }

  initialize(question: string, assistantLLMId: DLLMId, enableBrowse: boolean, log: (...data: any[]) => void = console.log): State {
    const state: State = {
      messages: [{ role: 'system', content: bareBonesPromptMixer(reActPrompt(enableBrowse), assistantLLMId) }],
      nextPrompt: question,
      lastObservation: '',
      result: undefined,
    };
    log('## Prepare Buffer');
    for (let i = 0; i < state.messages.length; i++)
      log('→ ' + state.messages[i].role + ' [' + (i + 1) + ']: "' + state.messages[i].content.slice(0, 86).replaceAll('\n', ' ') + ' ..."');
    return state;
  }

  truncateStringAfterPause(input: string): string {
    const pauseKeyword = 'PAUSE';
    const pauseIndex = input.indexOf(pauseKeyword);

    if (pauseIndex === -1) {
      return input;
    }

    const endIndex = pauseIndex + pauseKeyword.length;
    return input.slice(0, endIndex);
  }

  async chat(S: State, prompt: string, llmId: DLLMId): Promise<string> {
    S.messages.push({ role: 'user', content: prompt });
    let content: string;
    try {
      content = (await llmChatGenerateOrThrow(llmId, S.messages, 'chat-react-turn', null, null, null, 500)).content;
    } catch (error: any) {
      content = `Error in llmChatGenerateOrThrow: ${error}`;
    }
    // process response, strip out potential hallucinated response after PAUSE is detected
    content = this.truncateStringAfterPause(content);
    S.messages.push({ role: 'assistant', content });
    return content;
  }

  async step(S: State, llmId: DLLMId, log: (...data: any[]) => void = console.log) {
    log('→ ' + (S.lastObservation ? 'action' : 'user') + ' [' + (S.messages.length + 1) + ']: "' + S.nextPrompt + '"');
    const result = await this.chat(S, S.nextPrompt, llmId);
    log('← reAct [' + (S.messages.length) + ']: "' + result + '"');
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
      log(`⚡ __${action}__("${actionInput}") → Observation`);
      S.lastObservation = await knownActions[action](actionInput);
      S.nextPrompt = `Observation: ${S.lastObservation}`;
      // will be displayed in the next step
      // log('=>' + S.nextPrompt);
    } else {
      log('↙ done');
      // already displayed (← react)
      // log(`Result: ${result}`);
      S.result = result;
    }
  }
}


type ActionFunction = (input: string) => Promise<string>;

async function wikipedia(q: string): Promise<string> {
  const response = await frontendSideFetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`,
  );
  const data = await response.json();
  return data.query.search[0].snippet;
}

async function search(query: string): Promise<string> {
  try {
    const data = await callApiSearchGoogle(query);
    return JSON.stringify(data);
  } catch (error: any) {
    console.error('Error fetching search results:', error);
    return 'An error occurred while searching the internet. Missing Google API Key? Google error: ' + (error?.message || error?.toString() || 'Unknown error');
  }
}

async function browse(url: string): Promise<string> {
  try {
    const page = await callBrowseFetchPage(url);
    const pageContent = page.content.markdown || page.content.text || page.content.html || '';
    return JSON.stringify(pageContent ? { text: pageContent } : { error: 'Issue reading the page' });
  } catch (error) {
    console.error('Error browsing:', (error as Error).message);
    return 'An error occurred while browsing to the URL. Missing WSS Key?';
  }
}

const calculate = async (what: string): Promise<string> => String(eval(what));

const knownActions: { [key: string]: ActionFunction } = {
  wikipedia: wikipedia,
  google: search,
  loadUrl: browse,
  calculate: calculate,
};