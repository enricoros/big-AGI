/// <reference types="node" />

// The DeepSeek Messages request, checked against what api.deepseek.com rejects.
//
// Why: the request is the Anthropic adapter's, rewritten. What DeepSeek refuses on this wire is not what Anthropic refuses,
// and a miss is a 400 or a 422 on a user's chat. The rules were measured there on 2026-11-25 (kb/modules/LLM-deepseek-messages.md);
// `violations` states them on the body alone and shares no code with the adapter.
//
// Three groups:
// - "nothing DeepSeek rejects": every combination of model, effort, tool policy and history is run, and none may violate a rule
// - "what is sent": one fact per test, where a rule leaves a choice (which reasoning returns, what thinking off keeps)
// - "the Chat Completions wire sends the same request": both adapters on the same input, compared on what the model is given
//
// Not covered here: that a body with no violation is accepted. That was run live, 69 of 69 on both models.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage } from '../../../api/aix.wiretypes';

import { aixToDeepseekMessageCreate, type DeepseekMessagesRequest } from './deepseek.messageCreate';
import { aixToOpenAIChatCompletions } from './openai.chatCompletions';


// --- the rules ---

/** What the wire answers 4xx to, read off the request body. The quoted text is the vendor's. */
function violations(body: DeepseekMessagesRequest): string[] {
  const found: string[] = [];
  const thinkingOn = body.thinking?.type !== 'disabled'; // on is the default

  // 422 "tools[0]: unknown variant `custom`, expected one of `web_search_20250305`, ..., `deepseek_read_url`": a typed tool is a server tool
  const serverTools = (body.tools ?? []).flatMap(tool => 'type' in tool ? [tool.type] : []);
  const clientTools = (body.tools ?? []).filter(tool => !('type' in tool));
  const webTools = serverTools.filter(type => ['deepseek_web_search', 'deepseek_read_url'].includes(type)); // DeepSeek's own
  for (const type of serverTools)
    if (!webTools.includes(type) && type !== 'web_search_20250305')
      found.push(`a tool of type ${type}`);

  // 400 "tools: `deepseek_web_search` can only be declared once"
  if (new Set(serverTools).size !== serverTools.length)
    found.push('a server tool declared twice');
  // 400 "tools: other tools cannot be used together with `deepseek_web_search`, `deepseek_read_url`, `safety_check` or `title` yet"
  if (webTools.length && webTools.length !== serverTools.length)
    found.push('the standard search next to the web tools');
  // 400 "The server-side tool calls (deepseek_web_search, deepseek_read_url) ... are unavailable for model deepseek-v4-pro"
  if (webTools.length && body.model !== 'deepseek-flash')
    found.push(`web tools on ${body.model}`);
  // 400 "tools: client tools can only be used together with `deepseek_web_search` in thinking mode"
  if (webTools.includes('deepseek_web_search') && clientTools.length && !thinkingOn)
    found.push('web search next to client tools with thinking off');

  // 400 "Thinking mode does not support this tool_choice"
  if (thinkingOn && (body.tool_choice?.type === 'any' || body.tool_choice?.type === 'tool'))
    found.push('a forced call with thinking on');

  body.messages.forEach((message, index) => {
    if (message.role !== 'assistant') return;
    const callIds = message.content.flatMap(block => block.type === 'tool_use' ? [block.id] : []);
    if (!callIds.length) return;

    // 400 "The `content[].thinking` in the thinking mode must be passed back to the API."
    if (thinkingOn && !message.content.some(block => block.type === 'thinking'))
      found.push(`message ${index} calls a tool without its thinking`);

    // documented, not probed: the next message is the user's, with a result for every call
    const next = body.messages[index + 1];
    if (next) {
      const resultIds = next.role !== 'user' ? [] : next.content.flatMap(block => block.type === 'tool_result' ? [block.tool_use_id] : []);
      for (const id of callIds)
        if (!resultIds.includes(id))
          found.push(`the call ${id} of message ${index} has no result in the next message`);
    }
  });

  return found;
}

/** The top-level fields DeepSeek reads on this wire: anything else is Anthropic's alone */
const DEEPSEEK_FIELDS = ['model', 'system', 'messages', 'tools', 'tool_choice', 'max_tokens', 'temperature', 'top_p', 'thinking', 'output_config', 'stream'];


// --- the inputs ---

const WEATHER = { type: 'function_call' as const, function_call: { name: 'get_weather', description: 'Get the current weather for a city', input_schema: { properties: { city: { type: 'string' as const } }, required: ['city'] } } };
// a tool as the Anthropic programmatic-calling features describe it: the Anthropic adapter answers these with a code execution tool and a container
const WEATHER_PTC = { type: 'function_call' as const, function_call: { ...WEATHER.function_call, allowed_callers: ['code_execution' as const], input_examples: [{ city: 'Paris' }] } };

const user = (text: string): AixMessages_ChatMessage => ({ role: 'user', parts: [{ pt: 'text', text }] });
const model = (...parts: Extract<AixMessages_ChatMessage, { role: 'model' }>['parts']): AixMessages_ChatMessage => ({ role: 'model', parts });
const text = (value: string) => ({ pt: 'text' as const, text: value });
const reasoning = (aText: string) => ({ pt: 'ma' as const, aType: 'reasoning' as const, aText });
const call = (id: string, city: string) => ({ pt: 'tool_invocation' as const, id, invocation: { type: 'function_call' as const, name: 'get_weather', args: JSON.stringify({ city }) } });
const result = (id: string, value: string) => ({ pt: 'tool_response' as const, id, response: { type: 'function_call' as const, name: 'get_weather', result: value }, error: false });

const ASK = user('What is the weather in Paris and in Tokyo?');

/** Histories, by who wrote the assistant turns and how */
const HISTORIES: Record<string, AixMessages_ChatMessage[]> = {
  'a first message': [ASK],
  'a reply with reasoning, no tools': [user('Hi'), model(reasoning('A greeting.'), text('Hello.')), ASK],
  'a tool loop from the Chat Completions wire (unsigned reasoning)': [ASK, model(reasoning('Paris first.'), call('call_a', 'Paris')), model(result('call_a', '18 C'))],
  'a tool loop from Claude (signed and redacted reasoning)': [ASK, model({ ...reasoning('Paris first.'), textSignature: 'EqQBCkYIBBgCKkD-a-claude-signature', redactedData: ['opaque-redacted-data'] }, text('Checking.'), call('toolu_01A', 'Paris')), model(result('toolu_01A', '18 C'))],
  'a tool loop from a model that does not think': [ASK, model(call('call_a', 'Paris')), model(result('call_a', '18 C'))],
  'two calls in one step': [ASK, model(reasoning('Both at once.'), call('call_a', 'Paris'), call('call_b', 'Tokyo')), model(result('call_a', '18 C'), result('call_b', '22 C'))],
  'two steps in one message': [ASK, model(reasoning('Paris first.'), call('call_a', 'Paris'), result('call_a', '18 C'), reasoning('Now Tokyo.'), call('call_b', 'Tokyo'), result('call_b', '22 C'), text('18 C and 22 C.')), user('And tomorrow?')],
  'a turn that is reasoning only (stopped before answering)': [user('Hi'), model(reasoning('Thinking about it.')), ASK],
  'a spoken reply': [user('Hi'), model({ pt: 'inline_audio', mimeType: 'audio/wav', base64: 'UklGRg==' }, text('Hello.')), ASK],
};

const EFFORTS = [undefined, 'none', 'low', 'high', 'max'] as const;
const POLICIES = [undefined, 'auto', 'any'] as const;
// the models with the search each can have set: the listing gives the two web tools to deepseek-flash, the standard search to deepseek-v4-pro
const MODELS: [id: string, web: Partial<AixAPI_Model>][] = [
  ['deepseek-flash', {}],
  ['deepseek-flash', { vndDeepseekWebSearch: 'auto' }],
  ['deepseek-flash', { vndDeepseekReadUrl: 'auto' }],
  ['deepseek-flash', { vndDeepseekWebSearch: 'auto', vndDeepseekReadUrl: 'auto' }],
  ['deepseek-v4-pro', {}],
  ['deepseek-v4-pro', { vndAntWebSearch: 'auto' }],
];
const WEB = { vndDeepseekWebSearch: 'auto', vndDeepseekReadUrl: 'auto' } as const;

function request(history: AixMessages_ChatMessage[], policy: typeof POLICIES[number], tools = [WEATHER]): AixAPIChatGenerate_Request {
  return { systemMessage: { parts: [text('Be brief.')] }, chatSequence: history, ...(policy ? { tools, toolsPolicy: { type: policy } } : {}) };
}

function aixModel(id: string, effort: typeof EFFORTS[number], more?: Partial<AixAPI_Model>): AixAPI_Model {
  return { id, acceptsOutputs: ['text'], ...(effort ? { reasoningEffort: effort } : {}), ...more };
}

/** The thinking blocks that head the tool turns, in order */
function thinkingOnToolTurns(body: DeepseekMessagesRequest) {
  return body.messages.flatMap(message => message.role !== 'assistant' || !message.content.some(block => block.type === 'tool_use') ? []
    : message.content.flatMap(block => block.type === 'thinking' ? [block] : []));
}


describe('DeepSeek Messages request: nothing DeepSeek rejects', () => {

  for (const [name, history] of Object.entries(HISTORIES))
    test(name, () => {
      for (const [id, web] of MODELS)
        for (const effort of EFFORTS)
          for (const policy of POLICIES) {
            const body = aixToDeepseekMessageCreate(aixModel(id, effort, web), request(history, policy), true);
            assert.deepEqual(violations(body), [], `${id} ${JSON.stringify(web)}, effort ${effort}, policy ${policy}`);
          }
    });

  test('a model that carries Anthropic settings, and tools described for Anthropic code execution', () => {
    // the container id comes from the chat history whatever the model; the others are what a mis-set model could carry
    const leaky = aixModel('deepseek-flash', 'high', { vndAntContainerId: 'container_011', vndAntThinkingBudget: 'adaptive', vndAntWebFetch: 'auto', vndAntCodeSandbox: 'auto', vndAntInfSpeed: 'fast' });
    const body = aixToDeepseekMessageCreate(leaky, request(HISTORIES['a tool loop from Claude (signed and redacted reasoning)'], 'auto', [WEATHER_PTC]), true);
    assert.deepEqual(violations(body), []);
    assert.deepEqual(Object.keys(body).filter(key => !DEEPSEEK_FIELDS.includes(key)), [], 'fields DeepSeek does not read');
    assert.deepEqual(body.tools?.map(tool => Object.keys(tool).sort()), [['description', 'input_schema', 'name']], 'one client tool, with nothing but its definition');
    assert.equal(JSON.stringify(body).includes('cache_control'), false);
  });

});


describe('DeepSeek Messages request: what is sent', () => {

  test('each tool turn is headed by the reasoning of its own step', () => {
    const body = aixToDeepseekMessageCreate(aixModel('deepseek-flash', 'high'), request(HISTORIES['two steps in one message'], 'auto'), true);
    assert.deepEqual(thinkingOnToolTurns(body).map(block => block.thinking), ['Paris first.', 'Now Tokyo.']);
  });

  test('two calls of one step share one thinking block', () => {
    const body = aixToDeepseekMessageCreate(aixModel('deepseek-flash', 'high'), request(HISTORIES['two calls in one step'], 'auto'), true);
    assert.deepEqual(thinkingOnToolTurns(body).map(block => block.thinking), ['Both at once.']);
  });

  test('reasoning returns on tool turns only, and never signed: no other vendor\'s signature or redacted block is sent', () => {
    for (const [name, history] of Object.entries(HISTORIES)) {
      const body = aixToDeepseekMessageCreate(aixModel('deepseek-flash', 'high'), request(history, 'auto'), true);
      const thinking = body.messages.flatMap(message => message.content.flatMap(block => block.type === 'thinking' ? [block] : []));
      assert.deepEqual(thinking, thinkingOnToolTurns(body), `${name}: thinking outside a tool turn`);
      assert.deepEqual(thinking.map(block => block.signature).filter(Boolean), [], `${name}: a signature`);
      assert.equal(body.messages.some(message => message.content.some(block => block.type === 'redacted_thinking')), false, `${name}: a redacted block`);
    }
  });

  test('a call from a model that does not think is headed by empty thinking', () => {
    const body = aixToDeepseekMessageCreate(aixModel('deepseek-flash', undefined), request(HISTORIES['a tool loop from a model that does not think'], 'auto'), true);
    assert.deepEqual(thinkingOnToolTurns(body).map(block => block.thinking), ['']);
  });

  test('thinking is off for effort none and for a forced call, on otherwise; effort is sent only while on', () => {
    const body = (effort: typeof EFFORTS[number], policy: typeof POLICIES[number]) => aixToDeepseekMessageCreate(aixModel('deepseek-flash', effort), request([ASK], policy), true);
    assert.deepEqual([body('none', 'auto').thinking, body('none', 'auto').output_config], [{ type: 'disabled' }, undefined]);
    assert.deepEqual([body('max', 'any').thinking, body('max', 'any').output_config], [{ type: 'disabled' }, undefined]);
    assert.deepEqual([body(undefined, 'any').thinking, body(undefined, 'any').output_config], [{ type: 'disabled' }, undefined]);
    assert.deepEqual([body(undefined, 'auto').thinking, body(undefined, 'auto').output_config], [undefined, undefined]); // the vendor's defaults: on, high
    assert.deepEqual([body('max', 'auto').thinking, body('max', 'auto').output_config], [undefined, { effort: 'max' }]);
    assert.deepEqual(body('medium' as any, undefined).output_config, { effort: 'high' }); // the vendor's own table: medium is high
  });

  test('temperature and top_p are sent only with thinking off, where the vendor reads them', () => {
    const sampled = (effort: typeof EFFORTS[number]) => {
      const { temperature, top_p } = aixToDeepseekMessageCreate(aixModel('deepseek-flash', effort, { temperature: 0.3 }), request([ASK], undefined), true);
      return { temperature, top_p };
    };
    assert.deepEqual(sampled('none'), { temperature: 0.3, top_p: undefined });
    assert.deepEqual(sampled('high'), { temperature: undefined, top_p: undefined });
    assert.deepEqual(sampled(undefined), { temperature: undefined, top_p: undefined });
  });

  const typedTools = (body: DeepseekMessagesRequest) => (body.tools ?? []).flatMap(tool => 'type' in tool ? [tool.type] : []);

  test('each web tool is declared when its parameter is on, on its own', () => {
    const declared = (web: Partial<AixAPI_Model>) => typedTools(aixToDeepseekMessageCreate(aixModel('deepseek-flash', 'high', web), request([ASK], undefined), true));
    assert.deepEqual(declared({}), []);
    assert.deepEqual(declared({ vndDeepseekWebSearch: 'auto' }), ['deepseek_web_search']);
    assert.deepEqual(declared({ vndDeepseekReadUrl: 'auto' }), ['deepseek_read_url']);
    assert.deepEqual(declared(WEB), ['deepseek_web_search', 'deepseek_read_url']);
  });

  // measured: next to client tools DeepSeek's own search ran in 37 of 72 requests, the standard one in 80 of 80.
  // No violation tells the first: it is a 200 that does not search
  test('next to client tools the search is the standard one, the client tools stay, and a forced call takes no search', () => {
    const searching: [id: string, web: Partial<AixAPI_Model>][] = [['deepseek-flash', WEB], ['deepseek-v4-pro', { vndAntWebSearch: 'auto' }]];
    for (const effort of EFFORTS)
      for (const [id, web] of searching) {
        const sent = (policy: typeof POLICIES[number]) => aixToDeepseekMessageCreate(aixModel(id, effort, web), request([ASK], policy), true).tools?.map(tool => tool.name);
        assert.deepEqual(sent('auto'), ['web_search', 'get_weather'], `${id}, effort ${effort}`);
        assert.deepEqual(sent('any'), ['get_weather'], `${id}, effort ${effort}: forced`);
      }
  });

  test('max_tokens is the model\'s, and absent when it sets none: the vendor\'s limit then applies, not Anthropic\'s 8192', () => {
    assert.equal('max_tokens' in aixToDeepseekMessageCreate(aixModel('deepseek-flash', 'high'), request([ASK], undefined), true), false);
    assert.equal(aixToDeepseekMessageCreate(aixModel('deepseek-flash', 'high', { maxTokens: 32000 }), request([ASK], undefined), true).max_tokens, 32000);
  });

});


// --- parity with the wire in use until now ---

type Given = { calls: string[], results: string[], reasoningOnToolTurns: string, tools: string[], forced: boolean, thinkingOff: boolean, effort: string | undefined, maxTokens: number | undefined, temperature: number | undefined };

function givenOnMessages(body: DeepseekMessagesRequest): Given {
  const blocks = body.messages.flatMap(message => message.content);
  return {
    calls: blocks.flatMap(block => block.type === 'tool_use' ? [`${block.name}(${JSON.stringify(block.input)})`] : []),
    results: blocks.flatMap(block => block.type === 'tool_result' ? [JSON.stringify(block.content)] : []).map(content => /"text":"([^"]*)"/.exec(content)?.[1] ?? content),
    reasoningOnToolTurns: thinkingOnToolTurns(body).map(block => block.thinking).join(''),
    tools: (body.tools ?? []).map(tool => tool.name),
    forced: body.tool_choice?.type === 'any',
    thinkingOff: body.thinking?.type === 'disabled',
    effort: body.output_config?.effort,
    maxTokens: body.max_tokens,
    temperature: body.temperature,
  };
}

function givenOnChatCompletions(body: ReturnType<typeof aixToOpenAIChatCompletions>): Given {
  const assistantWithCalls = body.messages.flatMap(message => message.role === 'assistant' && message.tool_calls?.length ? [message] : []);
  return {
    calls: assistantWithCalls.flatMap(message => message.tool_calls!.flatMap(toolCall => toolCall.type === 'function' ? [`${toolCall.function.name}(${JSON.stringify(JSON.parse(toolCall.function.arguments || '{}'))})`] : [])),
    results: body.messages.flatMap(message => message.role === 'tool' ? [String(message.content)] : []),
    reasoningOnToolTurns: assistantWithCalls.map(message => message.reasoning_content ?? '').join(''),
    tools: (body.tools ?? []).flatMap(tool => tool.type === 'function' ? [tool.function.name] : []),
    forced: body.tool_choice === 'required',
    thinkingOff: body.thinking?.type === 'disabled',
    effort: body.reasoning_effort,
    maxTokens: body.max_tokens ?? undefined,
    temperature: body.temperature ?? undefined,
  };
}

describe('DeepSeek Messages request: the Chat Completions wire sends the same request', () => {

  // one step per message, as the app stores them. Two steps in one message is where the old wire loses the first step's
  // reasoning (AIX-ingestion Q9), and is checked on the new wire alone, above.
  const SHARED = ['a first message', 'a reply with reasoning, no tools', 'a tool loop from the Chat Completions wire (unsigned reasoning)', 'a tool loop from a model that does not think', 'two calls in one step'];

  for (const name of SHARED)
    test(name, () => {
      for (const id of ['deepseek-flash', 'deepseek-v4-pro'])
        for (const effort of EFFORTS)
          for (const policy of POLICIES) {
            const aix = aixModel(id, effort, { temperature: 0.3, maxTokens: 4096 });
            assert.deepEqual(
              givenOnMessages(aixToDeepseekMessageCreate(aix, request(HISTORIES[name], policy), true)),
              givenOnChatCompletions(aixToOpenAIChatCompletions('deepseek', aix, request(HISTORIES[name], policy), true)),
              `${id}, effort ${effort}, policy ${policy}`,
            );
          }
    });

});
