/// <reference types="node" />

// Replays captured vendor responses through the real chat-generate chain: continuation -> operation retry ->
// executor -> demuxer -> parser -> transmitter. Only the network is replaced, through the dispatch's `customConnect`.
// Run: `npx tsx --test src/modules/aix/server/dispatch/chatGenerate/chatGenerate.replay.test.ts`, from the repository root
//
// A test states what is right, from the vendor's own data or from a written rule (kb/modules/AIX-ingestion.md,
// AIX-outcome.md), never from what the chain does today. Where the chain does not do it yet the test is marked `notYet`,
// with what happens instead: it runs, and is reported as skipped with that reason as long as it fails. The day it passes
// it fails, to have the mark removed. Where nothing is decided, nothing is asserted.
//
// Four groups:
// 1. "all captures: invariants": rules that hold for any vendor response, one test per rule over the captures of all vendors. Each
//    is checked against the capture itself, read by a few lines that share no code with the parsers, so no expectation is
//    written by hand and a capture added to a folder is checked from then on.
// 2. "unclean endings": every ending that is not a clean finish, one row per ending.
// 3. one group per vendor API: what only that API does. What a hosted tool run counts as, what a paused turn sends back,
//    what a failed step leaves behind. One row per fact, with the calls on the wire in its name.
// 4. "not covered yet": what this file does not check, listed so that a green run is not read as more than it is.
//
// Captures are in tools/data/aix-replay/generations/<vendor>, as received (see the README there); a test whose capture
// is not there is reported as skipped. What a request body does not show about how a capture was made (a request header,
// a manual step, a cut) is in its .req.json, and repeated on its row here.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, test, type TestContext } from 'node:test';

import { AixWire_Particles, type AixWire_Vendors } from '../../api/aix.wiretypes';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch, ChatGenerateParseFunction } from './chatGenerate.dispatch';
import { createAnthropicMessageParser, createAnthropicMessageParserNS } from './parsers/anthropic.parser';
import { createGeminiGenerateContentResponseParser } from './parsers/gemini.parser';
import { createOpenAIChatCompletionsChunkParser, createOpenAIChatCompletionsParserNS } from './parsers/openai.parser';
import { createOpenAIResponseParserNS, createOpenAIResponsesEventParser } from './parsers/openai.responses.parser';
import { executeChatGenerateWithContinuation } from './chatGenerate.continuation';

// Unknown vendor shapes throw in development and only warn in production (aixResilientUnknownValue, which reads the mode
// on every call). That strictness is part of what these tests assert, so the file turns it on itself: it runs the same
// from `npm test`, from the command line and from an IDE run configuration with no environment set.
Object.assign(process.env, { NODE_ENV: 'development' });


// --- replay ---

const CAPTURES = 'tools/data/aix-replay/generations/';

type Op = AixWire_Particles.ChatGenerateOp;

const _d: AixDebugObject = { prettyDialect: 'Replay', echoRequest: false, requestBodyOverride: undefined, consoleLogErrors: false, profiler: undefined, wire: undefined };

function capture(file: string): string {
  return readFileSync(CAPTURES + file, 'utf8');
}

/** node:test skip reason when a capture is missing, false to run */
function missing(...files: string[]): string | false {
  const absent = files.find(file => !existsSync(CAPTURES + file));
  return absent ? `capture not found: ${CAPTURES}${absent}` : false;
}

/**
 * Runs one generation: each upstream request the chain makes is answered with the next response, in order.
 * Returns the particles the client would receive, and the request bodies the chain sent (the first is `requestBody`).
 */
async function replay(responses: string[], streaming: boolean, createParser: () => ChatGenerateParseFunction, requestBody: object = {}): Promise<{ particles: Op[], requestBodies: any[] }> {
  const particles: Op[] = [];
  const requestBodies: any[] = [];
  const dispatchCreator = async (): Promise<ChatGenerateDispatch> => {
    const dispatch: ChatGenerateDispatch = {
      request: { url: 'https://capture.invalid', method: 'POST', headers: {}, body: structuredClone(requestBody) },
      demuxerFormat: streaming ? 'fast-sse' : null,
      chatGenerateParse: createParser(),
      customConnect: async () => {
        // read the body at connect time: a continuation mutates it after this creator returns
        requestBodies.push('body' in dispatch.request ? dispatch.request.body : undefined);
        const response = responses[requestBodies.length - 1];
        assert.ok(response !== undefined, `the chain made request #${requestBodies.length}, with ${responses.length} response(s) to replay`);
        return new Response(response);
      },
    };
    return dispatch;
  };

  // the chain logs issues and dev notes as it goes: keep the test output to the results
  const { log, warn } = console;
  console.log = console.warn = () => undefined;
  try {
    for await (const op of executeChatGenerateWithContinuation(dispatchCreator, new AbortController().signal, _d))
      particles.push(structuredClone(op)); // a snapshot: the metrics particle carries the transmitter's live object
  } finally {
    console.log = log;
    console.warn = warn;
  }
  return { particles, requestBodies };
}

const isControl = <T extends AixWire_Particles.ChatControlOp['cg']>(cg: T) =>
  (op: Op): op is Extract<AixWire_Particles.ChatControlOp, { cg: T }> => 'cg' in op && op.cg === cg;

const isPart = <T extends AixWire_Particles.PartParticleOp['p']>(p: T) =>
  (op: Op): op is Extract<AixWire_Particles.PartParticleOp, { p: T }> => 'p' in op && op.p === p;

const isText = (op: Op): op is AixWire_Particles.TextParticleOp => 't' in op;

const isStream = (file: string) => file.endsWith('.sse');

/** The metrics as the client last received them */
function finalMetrics(particles: Op[]): AixWire_Particles.CGSelectMetrics {
  const metrics = particles.filter(isControl('set-metrics')).at(-1)?.metrics;
  assert.ok(metrics, 'no metrics were sent');
  return metrics;
}

/** The single end of the generation: nothing is sent after it, whatever the vendor's stream still carries */
function theEnd(particles: Op[]) {
  const ends = particles.filter(isControl('end'));
  assert.equal(ends.length, 1, 'expected exactly one end');
  assert.equal(particles.at(-1), ends[0], 'particles were sent after the end');
  return ends[0];
}

function issueTexts(particles: Op[]): string[] {
  return particles.filter(isControl('issue')).map(issue => issue.issueText);
}

/** What the user is told about a bad ending: the error parts, and the explanation sent with the end */
function explanations(particles: Op[]): string[] {
  const end = particles.filter(isControl('end')).at(-1);
  return [...issueTexts(particles), ...(end?.tokenStopError ? [end.tokenStopError] : [])];
}

/** Issues the chain raises about itself: a response it could not read or parse, as opposed to what the vendor reported */
const CHAIN_FAILURE = /\b(Parsing|Reading|Streaming|Configuration) Issue]/;

/** The first object, anywhere in a JSON value, that matches: reads a vendor's own field out of a capture */
function findObject(value: unknown, matches: (object: Record<string, unknown>) => boolean): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (!Array.isArray(value) && matches(value as Record<string, unknown>)) return value as Record<string, unknown>;
  for (const child of Object.values(value)) {
    const found = findObject(child, matches);
    if (found) return found;
  }
  return undefined;
}

/**
 * The JSON payloads of a captured event stream, in order (a `[DONE]` terminator is not one).
 * Only the events the stream completed, with their blank line: a connection cut mid-event leaves a partial one that no reader dispatches.
 */
function sseData(stream: string): any[] {
  const completed = stream.slice(0, Math.max(stream.lastIndexOf('\n\n'), stream.lastIndexOf('\n\r\n')) + 1);
  return completed.split(/\r?\n/).filter(line => line.startsWith('data:') && line.slice(5).trim() !== '[DONE]').map(line => JSON.parse(line.slice(5)));
}

/** Server-sent events, framed as a vendor stream */
function sse(events: { event?: string, data: object }[]): string {
  return events.map(({ event, data }) => `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`).join('');
}

/** Runs a check on each file and fails once, with every file that failed and why */
async function eachCapture(files: string[], check: (file: string) => Promise<void>): Promise<void> {
  const failures: string[] = [];
  for (const file of files)
    await check(file).catch(error => failures.push(`${file}: ${String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 400)}`));
  assert.ok(!failures.length, `${failures.length} of ${files.length}:\n${failures.join('\n')}`);
}

/**
 * A rule the chain does not follow yet. The check runs: while it fails the test is reported as skipped, with what happens
 * today; the day it passes the test fails, so that the mark is removed (and the item it names closed).
 */
function unlessNotYet(notYet: string | undefined, check: () => Promise<void>) {
  if (!notYet) return check;
  return async (t: TestContext) => {
    const failure = await check().then(() => null, (error: unknown) => error instanceof Error ? error : new Error(String(error)));
    assert.ok(failure, `this holds now: remove its notYet mark (${notYet})`);
    t.diagnostic(failure.message);
    t.skip(`not yet. ${notYet}`);
  };
}


// --- vendors ---

// How a folder of captures is replayed, and how the vendor's own facts are read off its raw payloads.
// A new vendor folder needs a row here.

type VendorReplay = {
  parser: (streaming: boolean, file: string) => ChatGenerateParseFunction,
  /** the answer text the vendor sent */
  answerText: (payloads: any[], streaming: boolean) => string,
  /** the vendor's own token totals for the request, when the response carries them; no output when it reports none */
  usage: (payloads: any[], streaming: boolean) => { input: number, output: number | undefined } | undefined,
  /** the messages of the errors the vendor sent for the response as a whole (not for one tool call or one image) */
  errors: (payloads: any[], streaming: boolean) => string[],
  /** the reasoning text the vendor sent (summaries included, signatures and encrypted reasoning not) */
  reasoningText: (payloads: any[], streaming: boolean) => string,
  /** the function calls the vendor asked the client to run, in order, as `callKey` */
  calls: (payloads: any[], streaming: boolean) => string[],
};

/** A function call as one comparable string: the arguments as JSON when they parse, as received when they do not */
function callKey(name: string, args: unknown): string {
  if (typeof args !== 'string') return `${name}(${JSON.stringify(args ?? {})})`;
  try {
    return `${name}(${JSON.stringify(JSON.parse(args || '{}'))})`;
  } catch {
    return `${name}(${args})`;
  }
}

const responsesApi = (rspVendor: AixWire_Vendors.RspVendor): VendorReplay => ({
  parser: streaming => streaming ? createOpenAIResponsesEventParser(rspVendor) : createOpenAIResponseParserNS(rspVendor),
  answerText: (payloads, streaming) => streaming
    ? payloads.filter(event => event.type === 'response.output_text.delta').map(event => event.delta).join('')
    : (payloads[0].output ?? []).filter((item: any) => item.type === 'message').flatMap((item: any) => item.content).filter((part: any) => part.type === 'output_text').map((part: any) => part.text).join(''),
  usage: (payloads, streaming) => {
    const usage = streaming ? payloads.filter(event => event.response?.usage).at(-1)?.response.usage : payloads[0].usage;
    return usage ? { input: usage.input_tokens, output: usage.output_tokens } : undefined;
  },
  // the `error` event, and the failed response that normally follows it with the same message
  errors: (payloads, streaming) => streaming
    ? payloads.flatMap(event => event.type === 'error' ? [event.error?.message] : event.type === 'response.failed' ? [event.response.error?.message] : []).filter(Boolean)
    : [payloads[0].error?.message].filter(Boolean),
  reasoningText: (payloads, streaming) => streaming
    ? payloads.filter(event => event.type === 'response.reasoning_summary_text.delta' || event.type === 'response.reasoning_text.delta').map(event => event.delta).join('')
    : (payloads[0].output ?? []).filter((item: any) => item.type === 'reasoning').flatMap((item: any) => [...(item.summary ?? []), ...(item.content ?? [])]).map((part: any) => part.text ?? '').join(''),
  calls: (payloads, streaming) => (streaming ? payloads.filter(event => event.type === 'response.output_item.done').map(event => event.item) : (payloads[0].output ?? []))
    .filter((item: any) => item.type === 'function_call').map((item: any) => callKey(item.name, item.arguments)),
});

const VENDORS: Record<string, VendorReplay> = {
  anthropic: {
    parser: streaming => streaming ? createAnthropicMessageParser() : createAnthropicMessageParserNS(),
    answerText: (payloads, streaming) => streaming
      ? payloads.filter(event => event.type === 'content_block_delta' && event.delta?.type === 'text_delta').map(event => event.delta.text).join('')
      : payloads[0].content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join(''),
    usage: (payloads, streaming) => {
      // streaming: the start carries the input side, the last delta the final counts
      const usage = streaming
        ? { ...payloads.find(event => event.type === 'message_start')?.message?.usage, ...payloads.filter(event => event.type === 'message_delta').at(-1)?.usage }
        : payloads[0].usage;
      return usage?.output_tokens === undefined ? undefined
        : { input: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0), output: usage.output_tokens };
    },
    errors: payloads => payloads.filter(event => event.type === 'error').map(event => event.error?.message).filter(Boolean),
    reasoningText: (payloads, streaming) => streaming
      ? payloads.filter(event => event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta').map(event => event.delta.thinking).join('')
      : payloads[0].content.filter((block: any) => block.type === 'thinking').map((block: any) => block.thinking).join(''),
    calls: (payloads, streaming) => {
      if (!streaming) return payloads[0].content.filter((block: any) => block.type === 'tool_use').map((block: any) => callKey(block.name, block.input));
      const calls = new Map<number, { name: string, args: string }>(); // by block index: the arguments stream as partial JSON
      for (const event of payloads)
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') calls.set(event.index, { name: event.content_block.name, args: '' });
        else if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta' && calls.has(event.index)) calls.get(event.index)!.args += event.delta.partial_json;
      return [...calls.values()].map(call => callKey(call.name, call.args));
    },
  },
  openai: responsesApi('openai'),
  xai: responsesApi('xai'),
  sakanaai: responsesApi('sakanaai'),
  gemini: {
    parser: (streaming, file) => createGeminiGenerateContentResponseParser(`models/${file.split('/').at(-1)!.split('_')[0]}`, streaming),
    answerText: payloads => payloads.flatMap(chunk => chunk.candidates?.[0]?.content?.parts ?? []).filter((part: any) => typeof part.text === 'string' && !part.thought).map((part: any) => part.text).join(''),
    usage: payloads => {
      const usage = payloads.map(chunk => chunk.usageMetadata).filter(Boolean).at(-1);
      // a filtered or malformed ending can come with no output counts at all
      const hasOutput = usage?.candidatesTokenCount !== undefined || usage?.thoughtsTokenCount !== undefined;
      return usage ? { input: (usage.promptTokenCount ?? 0) + (usage.toolUsePromptTokenCount ?? 0), output: hasOutput ? (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0) : undefined } : undefined;
    },
    errors: payloads => payloads.map(chunk => chunk.error?.message).filter(Boolean),
    reasoningText: payloads => payloads.flatMap(chunk => chunk.candidates?.[0]?.content?.parts ?? []).filter((part: any) => part.thought && typeof part.text === 'string').map((part: any) => part.text).join(''),
    calls: payloads => payloads.flatMap(chunk => chunk.candidates?.[0]?.content?.parts ?? []).filter((part: any) => part.functionCall).map((part: any) => callKey(part.functionCall.name, part.functionCall.args)),
  },
  openrouter: {
    parser: streaming => streaming ? createOpenAIChatCompletionsChunkParser() : createOpenAIChatCompletionsParserNS(),
    answerText: (payloads, streaming) => streaming
      ? payloads.map(chunk => chunk.choices?.[0]?.delta?.content).filter(content => typeof content === 'string').join('')
      : (payloads[0].choices?.[0]?.message?.content ?? ''),
    usage: payloads => {
      const usage = payloads.map(chunk => chunk.usage).filter(Boolean).at(-1);
      return usage ? { input: usage.prompt_tokens, output: usage.completion_tokens } : undefined;
    },
    errors: payloads => payloads.map(chunk => chunk.error?.message).filter(Boolean),
    reasoningText: (payloads, streaming) => streaming
      ? payloads.map(chunk => chunk.choices?.[0]?.delta?.reasoning).filter(text => typeof text === 'string').join('')
      : (payloads[0].choices?.[0]?.message?.reasoning ?? ''),
    calls: (payloads, streaming) => {
      if (!streaming) return (payloads[0].choices?.[0]?.message?.tool_calls ?? []).map((call: any) => callKey(call.function.name, call.function.arguments));
      const calls = new Map<number, { name: string, args: string }>(); // by tool call index: name first, then argument chunks
      for (const chunk of payloads)
        for (const delta of chunk.choices?.[0]?.delta?.tool_calls ?? []) {
          const call = calls.get(delta.index) ?? calls.set(delta.index, { name: '', args: '' }).get(delta.index)!;
          if (delta.function?.name) call.name = delta.function.name;
          if (delta.function?.arguments) call.args += delta.function.arguments;
        }
      return [...calls.values()].map(call => callKey(call.name, call.args));
    },
  },
};

const vendorOf = (file: string) => VENDORS[file.split('/')[0]];

/** Replays one capture alone, with its vendor's parser */
async function replayCapture(file: string): Promise<Op[]> {
  const streaming = isStream(file);
  return (await replay([capture(file)], streaming, () => vendorOf(file).parser(streaming, file))).particles;
}

type Counts = Pick<AixWire_Particles.CGSelectMetrics, 'nWebSearch' | 'nWebFetch' | 'nCodeExec'>;

/**
 * One test per row: the hosted tool counters the client is given. A counter the row does not name must be absent.
 * What counts as a search, a fetch or a code run on each vendor is in kb/modules/LLM-pricing-pipeline.md, "Usage parsing".
 * `fetchCountable` is what the OpenRouter dispatch tells its parser about the request (see the OpenRouter rows).
 */
function hostedToolCounts(rows: readonly (readonly [file: string, expected: Counts, calls: string, fetchCountable?: boolean])[]) {
  for (const [file, expected, calls, fetchCountable] of rows)
    test(`hosted tool counts: ${calls} (${isStream(file) ? 'streaming' : 'non-streaming'})`, { skip: missing(file) }, async () => {
      const streaming = isStream(file);
      const createParser = fetchCountable === undefined ? () => vendorOf(file).parser(streaming, file)
        : () => streaming ? createOpenAIChatCompletionsChunkParser(fetchCountable) : createOpenAIChatCompletionsParserNS(fetchCountable);
      const { particles } = await replay([capture(file)], streaming, createParser);

      const { nWebSearch, nWebFetch, nCodeExec } = finalMetrics(particles);
      assert.deepEqual({ nWebSearch, nWebFetch, nCodeExec }, { nWebSearch: undefined, nWebFetch: undefined, nCodeExec: undefined, ...expected });
    });
}


// --- unclean endings: the table ---

// What the client is told when the vendor does not simply finish. The stop reason sent with the end decides the outcome
// shown and stored (kb/modules/AIX-outcome.md); the words are the vendor's wherever it gave any, in an error part or with
// the end. One row per ending as we class it. A capture that is in no row must end clean (an invariant checks it), so
// the table is the whole list. A row always states what is right: when the chain does not do that yet, the row says why in
// `notYet`, and its test is reported as skipped with that reason for as long as it fails.

const NOT_CLEAN = 'anything but a clean finish', UNDECIDED = 'not decided, not asserted';
/** The message is failed, either way AIX-outcome.md derives it: a stop reason of the error class, or none and an error part as the last content */
const FAILED = 'failed';

type Ending = {
  ending: string,
  /** the stop reason sent with the end, or one of the three above */
  stop: AixWire_Particles.GCTokenStopReason | typeof FAILED | typeof NOT_CLEAN | typeof UNDECIDED,
  /** what the user reads about it; null when nothing is said, left out when not asserted */
  says?: RegExp | null,
  /** set when the chain does not do this yet: what it does today */
  notYet?: string,
  files: string[],
};

const ENDINGS: Ending[] = [
  {
    ending: 'cut by the output limit, in text, in thinking, in a tool call: what arrived is kept and marked truncated',
    stop: 'out-of-tokens', says: null,
    files: [
      'anthropic/haiku-5.5_max-tokens-mid-text.sse',
      'anthropic/haiku-5.5_max-tokens-in-tool-input.sse',
      'openai/gpt-6-luna_incomplete-max-output-tokens-mid-text.sse',
      'openai/gpt-6-luna_incomplete-max-output-tokens-mid-text_nonstream.json',
      'openai/gpt-6-luna_incomplete-max-output-tokens-in-function-args.sse',
      'openai/gpt-6-luna_incomplete-max-output-tokens-in-function-args_nonstream.json',
      'xai/grok-4.3-none_incomplete-max-output-tokens-mid-text.sse',
      'xai/grok-4.3_incomplete-max-output-tokens-1_nonstream.json',
      'gemini/gemini-3.8-flash_MAX_TOKENS-mid-text.sse',
      'gemini/gemini-3.5-flash-lite_MAX_TOKENS-in-thinking_no-text.sse',
      'gemini/gemini-3.5-flash-lite_MAX_TOKENS-during-code-cell_dropped.sse',
      'gemini/gemini-2.5-flash_functionCall-cut-by-MAX_TOKENS_invalid-args.sse',
      // Argon's per-request cap: MAX_TOKENS or CONTINUATION with a continuationToken we do not resume from (#1240)
      'gemini/gemini-4-argon_MAX_TOKENS-with-continuationToken.sse',
      'gemini/gemini-4-argon_finish-CONTINUATION.json',
      'openrouter/gpt-5-nano_length-during-reasoning_no-content.sse',
    ],
  },
  {
    ending: 'refused by the model\'s classifier: the vendor\'s explanation travels with the end',
    stop: 'filter-refusal', says: /^Refusal: \[reasoning_extraction] This request was blocked/,
    files: ['anthropic/fable-5.2_refusal-reasoning-extraction_at-start.sse', 'anthropic/sonnet-5.5_refusal-reasoning-extraction_nonstream.json'],
  },
  {
    ending: 'stopped as recitation: the text before the stop is kept',
    stop: 'filter-recitation', says: /Generation stopped due to RECITATION/,
    files: ['gemini/gemini-2.5-flash-lite_finish-RECITATION.sse'],
  },
  {
    ending: 'stopped by the safety filter, with the category and its level',
    stop: 'filter-content', says: /Generation stopped due to SAFETY: HARM_CATEGORY_HARASSMENT \(medium\)/,
    files: ['gemini/gemini-3.5-flash-lite_finish-SAFETY_after-text.sse', 'gemini/gemini-2.5-pro_finish-SAFETY_no-content.sse'],
  },
  {
    ending: 'a function call the model wrote wrong',
    stop: 'cg-issue', says: /MALFORMED_FUNCTION_CALL: Malformed function call: /,
    files: ['gemini/gemini-2.5-flash-lite_finish-MALFORMED_FUNCTION_CALL.sse'],
  },
  {
    ending: 'a function call with no tools in the request',
    stop: 'cg-issue', says: /Generation stopped: tool call made but no tools enabled/,
    files: ['gemini/gemini-2.5-flash-lite_finish-UNEXPECTED_TOOL_CALL.sse'],
  },
  {
    // #1286. How this stop is classed is not decided (an error today, AIX-outcome.md "tool-budget stops" proposes truncated)
    ending: 'the hosted-tool step budget ran out: the vendor\'s reason, with its counts',
    stop: UNDECIDED, says: /TOO_MANY_TOOL_CALLS: The request reached the tool-use step limit/,
    files: [
      'gemini/gemini-3.5-flash-lite_tool-limit_code-execution.sse',
      'gemini/gemini-3.6-flash_tool-limit_code-execution.sse',
      'gemini/gemini-3.6-flash_tool-limit_code-execution-2.sse',
      'gemini/gemini-3.8-flash_tool-limit_search.sse',
    ],
  },
  {
    // rejected parameters, a container deleted mid-run (by hand, for the capture), a dead sandbox, a context that overflows
    // inside the tool loop: HTTP 200, an `error` event before or after answer text, then a failed response (#1211)
    ending: 'failed by the vendor inside the stream',
    stop: FAILED, says: /: (Container with id 'cntr_\w+' not found\.|Invalid service_tier argument|There was an issue with your request\.|Your input exceeds the context window of this model\.)/,
    files: [
      'openai/gpt-6.1-terra_ultrafast-rejected_error-then-failed.sse',
      'openai/gpt-6-luna-pro_container-deleted_error-before-text-then-failed.sse',
      'openai/gpt-6-luna_container-deleted_error-after-text-then-failed.sse',
      'openai/gpt-6-luna_sandbox-oom_error-after-text-then-failed.sse',
      'openai/gpt-5-nano_context-overflow-in-tool-loop_error-then-failed.sse',
    ],
  },
  {
    // #1288. Both captures are the container stream above, cut by hand after its error event: at the event boundary, and
    // 160 bytes into the next event
    ending: 'failed by the vendor inside the stream, when the stream ends right after the error #1288',
    stop: FAILED, says: /: Container with id 'cntr_\w+' not found\./,
    files: ['openai/gpt-6-luna_error-after-text-then-eof_synthetic.sse', 'openai/gpt-6-luna_error-after-text-then-cut-midframe_synthetic.sse'],
  },
  {
    // #1149: a rate limit hit after the last text, the final message item is completed. Whether the vendor's error is
    // also shown is not asserted: today it is dropped, which AIX-ingestion.md lists as P21.
    // The capture has the organization id in its error message masked.
    ending: 'failed by the vendor after the answer was written in full: the answer stands',
    stop: 'ok',
    files: ['openai/gpt-5-nano_rate-limit-error-after-complete-answer_then-failed.sse'],
  },
  {
    // #1287. Gemini repeats the error as bare JSON after the frame; OpenRouter sends a finish reason and the billed usage
    // after the error chunk, and no [DONE]. Neither is read. The Gemini 504s were made with the request header
    // X-Server-Timeout, the only way found to get this error on purpose: 10 seconds or more (less is refused), expiring
    // after content has streamed (before any, the answer is an HTTP 504). The 503 is the frame logged in the ticket, which
    // Gemini does not send on request, at the end of a cut recording.
    ending: 'an error sent inside a 200 stream, as the first event or after content: the message fails, with the vendor\'s words',
    stop: FAILED, says: /DEADLINE_EXCEEDED \(504\): Deadline expired before operation could complete\.|UNAVAILABLE \(503\): This model is currently experiencing high demand\.|Model call failed: invalid request \(400\)/,
    files: [
      'gemini/gemini-3.5-flash-lite_inband-504-after-text.sse',
      'gemini/gemini-3.5-flash-lite_inband-504-during-code-run.sse',
      'gemini/gemini-3.5-flash-lite_inband-503-after-text_synthetic.sse',
      'openrouter/qwen-2.5-7b_inband-error-400-before-content_no-done.sse',
      'openrouter/qwen-2.5-7b_inband-error-400-after-content_no-done.sse',
    ],
  },
  {
    // finish_reason 'error' with native_finish_reason RECITATION and no error object
    ending: 'a provider filter that OpenRouter reports as finish_reason error ends as a filtered answer, naming the reason',
    stop: 'filter-recitation', says: /RECITATION/,
    files: ['openrouter/gemini-2.5-flash-lite_finish-error-native-recitation.sse', 'openrouter/gemini-2.5-flash-lite_finish-error-native-recitation_nonstream.json'],
  },
  {
    // native_finish_reason pause_turn: Anthropic stopped mid-loop and expects the turn to be sent back, which Chat
    // Completions cannot do
    ending: 'a paused Anthropic turn that OpenRouter reports as stop does not read as a finished answer',
    stop: NOT_CLEAN,
    notYet: 'native_finish_reason is not read: the turn ends ok, the streamed one with no answer text at all',
    files: ['openrouter/claude-haiku-5.5_native-fetch-loop_pause-turn-as-stop.sse', 'openrouter/claude-haiku-5.5_native-fetch-loop_pause-turn-as-stop_nonstream.json'],
  },
  {
    // status completed, no incomplete_details: the answer stops mid-sentence.
    // Made by sizing the input to leave about 4,800 tokens of the window.
    ending: 'an answer cut at the context window that xAI reports as completed does not read as a finished answer',
    stop: NOT_CLEAN,
    notYet: 'only the usage tells (255,994 of 256,000 tokens) and it is not read: the answer ends ok',
    files: ['xai/grok-build-0.1_context-window-cut_ends-completed.sse'],
  },
];

const endingOf = (file: string) => ENDINGS.find(ending => ending.files.includes(file));


// --- all captures: invariants ---

/** The response captures of a vendor folder: `<name>.sse|.json`, minus the saved requests */
function capturesOf(folder: string): string[] {
  if (!existsSync(CAPTURES + folder)) return [];
  return readdirSync(CAPTURES + folder).filter(name => /\.(sse|json)$/.test(name) && !name.endsWith('.req.json')).sort().map(name => `${folder}/${name}`);
}

/** Replays a capture as the generation it belongs to, with its saved request; keeps the vendor's raw payloads next to the result */
async function replayGeneration(file: string) {
  const vendor = vendorOf(file);
  const streaming = isStream(file);

  // a `_1-initial` response is replayed with the responses that continue it (`_2-continuation`, ...), as one generation
  const chain = file.includes('_1-initial') ? [file, ...capturesOf(file.split('/')[0]).filter(other => other.startsWith(file.slice(0, file.indexOf('_1-initial') + 1)) && /_\d+-continuation/.test(other))] : [file];
  const responses = chain.map(capture);
  // the saved request is the body alone, or { body, betas?, headers?, note? }; the body is null when it was not saved
  const requestFile = file.replace(/\.(sse|json)$/, '.req.json');
  const savedRequest = existsSync(CAPTURES + requestFile) ? JSON.parse(capture(requestFile)) : {};

  const { particles } = await replay(responses, streaming, () => vendor.parser(streaming, file), 'body' in savedRequest ? savedRequest.body ?? {} : savedRequest);
  const payloads: any[][] = responses.map(response => streaming ? sseData(response) : [JSON.parse(response)]);
  return { file, vendor, streaming, particles, payloads };
}

type Generation = Awaited<ReturnType<typeof replayGeneration>>;

/** Each capture is replayed once, however many rules read it */
const replayed = new Map<string, Promise<Generation>>();

function generationOf(file: string): Promise<Generation> {
  let generation = replayed.get(file);
  if (!generation) replayed.set(file, generation = replayGeneration(file));
  return generation;
}

/** Runs a rule over captures. A rule returns false for a capture that has nothing for it to compare; one at least must have. */
async function overCaptures(files: string[], holds: (generation: Generation) => boolean | void): Promise<void> {
  let compared = 0;
  await eachCapture(files, async file => {
    if (holds(await generationOf(file)) !== false) compared++;
  });
  assert.ok(compared > 0, 'no capture has anything for this rule to compare');
}

// the rules that have known exceptions, by name: the exceptions run them too, below

const squash = (text: string) => text.replace(/\s+/g, ''); // whitespace is compared apart, in the exact comparison

const sentAnswer = (g: Generation) => g.payloads.map(payload => g.vendor.answerText(payload, g.streaming)).join('');
const receivedAnswer = (g: Generation) => g.particles.filter(isText).map(op => op.t).join('');

function answerArrives(g: Generation) {
  const sent = squash(sentAnswer(g)), received = squash(receivedAnswer(g));
  assert.ok(received === sent, received.length > sent.length
    ? `the client receives ${received.length - sent.length} characters of answer text the vendor did not send`
    : `${sent.length - received.length} of ${sent.length} characters of the vendor's answer did not reach the client`);
}

function answerIsExact(g: Generation) {
  const sent = sentAnswer(g), received = receivedAnswer(g);
  assert.ok(received === sent, `sent ${sent.length} characters, delivered ${received.length}`);
}

function tokenTotalsAreTheVendors(g: Generation) {
  const usages = g.payloads.map(payload => g.vendor.usage(payload, g.streaming));
  if (!usages.every(usage => usage !== undefined)) return false;
  const metrics = g.particles.filter(isControl('set-metrics')).at(-1)?.metrics;
  const reported = metrics && { input: (metrics.TIn ?? 0) + (metrics.TCacheRead ?? 0) + (metrics.TCacheWrite ?? 0), output: metrics.TOut };
  const vendorTotal = {
    input: usages.reduce((sum, usage) => sum + usage!.input, 0),
    output: usages.some(usage => usage!.output !== undefined) ? usages.reduce((sum, usage) => sum + (usage!.output ?? 0), 0) : undefined,
  };
  assert.deepEqual(reported, vendorTotal, 'reported input (new + cache read + cache write) and output tokens differ from the vendor\'s usage');
}

function receivedCalls(particles: Op[]): string[] {
  const calls: { name: string, args: string }[] = [];
  for (const op of particles)
    if (isPart('fci')(op)) calls.push({ name: op.name, args: op.i_args ?? '' });
    else if (isPart('_fci')(op)) calls[calls.length - 1].args += op._args;
  return calls.map(call => callKey(call.name, call.args));
}

// Captures where a rule is known not to hold. Each list has its own test below, marked notYet; the rule skips them.

// Gemini 2.x streams send finishReason STOP on every code cell after the first, then carry on with the cell's result, the
// rest of the answer and the final usage. Not seen on 3.x and 4, nor without streaming.
const GEMINI_2X_EARLY_STOP = [
  'gemini/gemini-2.5-flash-lite_code-execution_intermediate-STOP.sse',
  'gemini/gemini-2.5-flash_search+code_intermediate-STOP.sse',
  'gemini/gemini-2.5-flash_url-context-as-code.sse',
];
const NON_STREAMING_INCOMPLETE_NOTE = [
  'openai/gpt-6-luna_incomplete-max-output-tokens-in-function-args_nonstream.json',
  'openai/gpt-6-luna_incomplete-max-output-tokens-mid-text_nonstream.json',
  'xai/grok-4.3_incomplete-max-output-tokens-1_nonstream.json',
];
const OPENROUTER_USAGE_AFTER_ERROR = [
  'openrouter/qwen-2.5-7b_inband-error-400-after-content_no-done.sse',
  'openrouter/qwen-2.5-7b_inband-error-400-before-content_no-done.sse',
];
// Not a loss, and not comparable by this reader: the last frame of this stop reports no candidate tokens, earlier frames
// reported 18. The chain keeps 18; the reader takes the last frame.
const TOKENS_NOT_COMPARED = ['gemini/gemini-3.8-flash_tool-limit_search.sse'];

describe('all captures: invariants', () => {

  const folders = existsSync(CAPTURES) ? readdirSync(CAPTURES, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name) : [];
  const all = Object.keys(VENDORS).flatMap(capturesOf).filter(file => !/_\d+-continuation\./.test(file)); // a continuation is replayed with its `_1-initial`
  const skip = all.length ? false : `no captures in ${CAPTURES}`;
  const except = (...lists: string[][]) => all.filter(file => !lists.some(list => list.includes(file)));

  test('parses in strict mode and ends once', { skip }, () => overCaptures(all, g => {
    assert.deepEqual(issueTexts(g.particles).filter(text => CHAIN_FAILURE.test(text)), []);
    theEnd(g.particles);
  }));

  test('ends clean, unless listed under "unclean endings"', { skip }, () => overCaptures(all, g => {
    if (endingOf(g.file)) return false;
    const stopReason = theEnd(g.particles).tokenStopReason;
    assert.ok(stopReason === 'ok' || stopReason === 'ok-tool_invocations', `ends with ${stopReason ?? 'no stop reason'} and has no row in ENDINGS`);
  }));

  test('the answer text the vendor sent reaches the client', { skip }, () => overCaptures(except(GEMINI_2X_EARLY_STOP, NON_STREAMING_INCOMPLETE_NOTE), answerArrives));

  test('the reasoning text the vendor sent reaches the client', { skip }, () => overCaptures(all, g => {
    const sent = squash(g.payloads.map(payload => g.vendor.reasoningText(payload, g.streaming)).join(''));
    const received = squash(g.particles.filter(isPart('tr_')).map(op => op._t).join(''));
    if (!sent && !received) return false;
    assert.ok(received === sent, `the vendor sent ${sent.length} characters of reasoning, the client receives ${received.length}`);
  }));

  test('function calls reach the client with the vendor\'s names and arguments, in order', { skip }, () => overCaptures(all, g => {
    const sent = g.payloads.flatMap(payload => g.vendor.calls(payload, g.streaming)), received = receivedCalls(g.particles);
    if (!sent.length && !received.length) return false;
    assert.deepEqual(received, sent);
  }));

  test('an error the vendor sent is listed under "unclean endings", and reaches the user in the vendor\'s words', { skip }, () => overCaptures(all, g => {
    const messages = [...new Set(g.payloads.flatMap(payload => g.vendor.errors(payload, g.streaming)))];
    if (!messages.length) return false;
    const ending = endingOf(g.file);
    assert.ok(ending, `the vendor sent an error and the capture has no row in ENDINGS: ${messages[0]}`);
    if (!ending.says || ending.notYet) return; // what is said is not asserted for that ending, or its own row reports it
    for (const message of messages)
      assert.ok(explanations(g.particles).some(text => text.includes(message)), `the vendor's error did not reach the client: ${message}`);
  }));

  test('the token totals reported are the vendor\'s', { skip }, () => overCaptures(except(GEMINI_2X_EARLY_STOP, OPENROUTER_USAGE_AFTER_ERROR, TOKENS_NOT_COMPARED), tokenTotalsAreTheVendors));

  // known exceptions to the rules above

  test('the answer text is delivered exactly as sent, with nothing inserted', { skip }, unlessNotYet(
    'AIX-ingestion.md P1: the Anthropic parser inserts a blank line after a hosted or tool block',
    () => overCaptures(except(GEMINI_2X_EARLY_STOP, NON_STREAMING_INCOMPLETE_NOTE), answerIsExact)));

  test('Gemini 2.x streams with code execution deliver the whole answer and its usage', { skip: missing(...GEMINI_2X_EARLY_STOP) }, unlessNotYet(
    'the first of the intermediate STOPs ends the generation: the rest of the answer and the final usage are dropped (2.5 Flash Lite delivers none of its 77 characters)',
    () => overCaptures(GEMINI_2X_EARLY_STOP, g => {
      answerArrives(g);
      tokenTotalsAreTheVendors(g);
    })));

  test('a non-streaming response cut by the output limit adds nothing to the answer text', { skip: missing(...NON_STREAMING_INCOMPLETE_NOTE) }, unlessNotYet(
    'AIX-ingestion.md P15: the non-streaming Responses parser writes an "Incomplete response" note into the answer text',
    () => overCaptures(NON_STREAMING_INCOMPLETE_NOTE, answerArrives)));

  test('the usage OpenRouter sends after an in-band error is reported', { skip: missing(...OPENROUTER_USAGE_AFTER_ERROR) }, unlessNotYet(
    'the error ends the generation, and the chunk after it, with the billed tokens, cost and tool calls, is not read',
    () => overCaptures(OPENROUTER_USAGE_AFTER_ERROR, tokenTotalsAreTheVendors)));

  test('every folder has a replay, and every row a capture', { skip }, () => {
    assert.deepEqual(folders.filter(folder => !(folder in VENDORS)), [], 'add a row to VENDORS');
    const named = [...ENDINGS.flatMap(ending => ending.files), ...GEMINI_2X_EARLY_STOP, ...NON_STREAMING_INCOMPLETE_NOTE, ...OPENROUTER_USAGE_AFTER_ERROR, ...TOKENS_NOT_COMPARED];
    assert.deepEqual(named.filter(file => !existsSync(CAPTURES + file)), [], 'rows that name a capture that is not there');
  });

});


// --- unclean endings ---

describe('unclean endings', () => {

  for (const { ending, stop, says, notYet, files } of ENDINGS) {
    const present = files.filter(file => existsSync(CAPTURES + file));
    test(`${ending} (${[...new Set(present.map(file => file.split('/')[0]))].join(', ')}: ${present.length})`, { skip: present.length ? false : 'captures not found' }, unlessNotYet(notYet, () => eachCapture(present, async file => {
      const particles = await replayCapture(file);

      const stopReason = theEnd(particles).tokenStopReason;
      if (stop === FAILED) {
        const lastContent = particles.filter(op => !('cg' in op) || op.cg === 'issue').at(-1);
        const failed = stopReason ? AixWire_Particles.gcStopReasonRow(stopReason)?.class === 'error' : !!lastContent && 'cg' in lastContent;
        assert.ok(failed, `ends ${stopReason ?? 'with no stop reason'} and ${lastContent && 'cg' in lastContent ? 'an' : 'no'} error part last: not a failed message`);
      } else if (stop === NOT_CLEAN)
        assert.ok(stopReason !== 'ok' && stopReason !== 'ok-tool_invocations', `ends ${stopReason}, a clean finish`);
      else if (stop !== UNDECIDED)
        assert.equal(stopReason, stop);
      const said = explanations(particles);
      assert.deepEqual(said.filter(text => CHAIN_FAILURE.test(text)), [], 'the chain failed on the response');
      if (says === null)
        assert.deepEqual(said, []);
      else if (says)
        assert.ok(said.length === 1 && says.test(said[0]), `expected one explanation matching ${says}, got ${JSON.stringify(said)}`);
    })));
  }

  // Sending such a call back builds a request from text that is not JSON: Anthropic's tool_use block parses its input and throws
  const CUT_CALLS = [
    'anthropic/haiku-5.5_max-tokens-in-tool-input.sse',
    'openai/gpt-6-luna_incomplete-max-output-tokens-in-function-args.sse',
    'openai/gpt-6-luna_incomplete-max-output-tokens-in-function-args_nonstream.json',
  ];

  test('a function call cut by the output limit is not handed over with arguments that do not parse', { skip: missing(...CUT_CALLS) }, unlessNotYet('the cut call is handed over like a complete one, with half its arguments: only the truncated stop marks it', () => eachCapture(CUT_CALLS, async file => {
    const particles = await replayCapture(file);

    const calls: string[] = [];
    for (const op of particles)
      if (isPart('fci')(op)) calls.push(op.i_args ?? '');
      else if (isPart('_fci')(op)) calls[calls.length - 1] += op._args;
    for (const args of calls)
      assert.doesNotThrow(() => JSON.parse(args), `handed over with arguments that are not JSON: ${args}`);
  })));

});


// --- Anthropic ---

describe('Anthropic Messages', () => {

  const PAUSE_1 = 'anthropic/haiku-5.5_pause-turn_1-initial.json';
  const PAUSE_1_REQUEST = 'anthropic/haiku-5.5_pause-turn_1-initial.req.json';
  const PAUSE_2 = 'anthropic/haiku-5.5_pause-turn_2-continuation.json';

  test('non-streaming pause_turn: both segments reach the client, and their usage is summed', { skip: missing(PAUSE_1, PAUSE_1_REQUEST, PAUSE_2) }, async () => {
    const paused = JSON.parse(capture(PAUSE_1)), continued = JSON.parse(capture(PAUSE_2));
    const { particles, requestBodies } = await replay([capture(PAUSE_1), capture(PAUSE_2)], false, createAnthropicMessageParserNS, JSON.parse(capture(PAUSE_1_REQUEST)).body);

    assert.equal(requestBodies.length, 2, 'the pause is continued with one more request');

    // every hosted call of both responses is shown, under its own id
    const shownOps = new Set(particles.filter(isPart('vp')).map(op => op.opId));
    for (const block of [...paused.content, ...continued.content])
      if (block.type === 'server_tool_use')
        assert.ok(shownOps.has(block.id), `no operation shown for ${block.name} ${block.id}`);

    // one divider at the pause, one end
    assert.equal(particles.filter(isPart('vnt')).filter(notice => 'nt' in notice && notice.nt === 'flow-cont').length, 1);
    assert.equal(theEnd(particles).tokenStopReason, 'ok');

    // the two requests are billed separately: the generation reports their sum
    const metrics = finalMetrics(particles);
    const sum = (read: (usage: any) => number) => read(paused.usage) + read(continued.usage);
    assert.equal(metrics.TIn, sum(usage => usage.input_tokens));
    assert.equal(metrics.TCacheRead, sum(usage => usage.cache_read_input_tokens));
    assert.equal(metrics.TCacheWrite, sum(usage => usage.cache_creation_input_tokens));
    assert.equal(metrics.TOut, sum(usage => usage.output_tokens));
    assert.equal(metrics.nWebFetch, sum(usage => usage.server_tool_use.web_fetch_requests));
  });

  test('pause_turn continuation: the next request keeps the container Skills and sends the hosted calls back as received', { skip: missing(PAUSE_1, PAUSE_1_REQUEST, PAUSE_2) }, async () => {
    const paused = JSON.parse(capture(PAUSE_1));
    const request = JSON.parse(capture(PAUSE_1_REQUEST)).body;
    const { requestBodies } = await replay([capture(PAUSE_1), capture(PAUSE_2)], false, createAnthropicMessageParserNS, request);
    const continuation = requestBodies[1];

    // a bare container id would drop the Skills from the model's context
    assert.deepEqual(continuation.container, { ...request.container, id: paused.container.id });

    // the paused turn goes back as the last, assistant message: same blocks in order, hosted call inputs untouched
    assert.equal(continuation.messages.length, request.messages.length + 1);
    const echoed = continuation.messages.at(-1);
    assert.equal(echoed.role, 'assistant');
    assert.deepEqual(echoed.content.map((block: any) => block.type), paused.content.map((block: any) => block.type));
    for (const [index, block] of paused.content.entries())
      if (block.type === 'server_tool_use')
        assert.deepEqual(echoed.content[index].input, block.input, `input of ${block.name} ${block.id} changed on the way back`);
  });

  const EDITOR_NS = 'anthropic/haiku-5.5_text-editor-code-execution_nonstream.json';

  test('non-streaming code execution: the editor commands keep their file path', { skip: missing(EDITOR_NS) }, async () => {
    const response = JSON.parse(capture(EDITOR_NS));
    const particles = await replayCapture(EDITOR_NS);

    const editorCalls = response.content.filter((block: any) => block.type === 'server_tool_use' && block.name === 'text_editor_code_execution');
    assert.ok(editorCalls.length > 0, 'the capture has editor calls');
    for (const call of editorCalls) {
      const shown = particles.filter(isPart('vp')).filter(op => op.opId === call.id);
      assert.ok(shown.some(op => op.text.includes(call.input.path)), `${call.input.command} ${call.input.path} is shown without its path: ${shown.map(op => op.text).join(' | ')}`);
    }
  });

  // Thinking blocks the vendor ignored (`input_transformations` on message_start) are reported once per reason, in our words
  for (const [file, notices, what] of [
    ['anthropic/haiku-5.5_thinking-dropped_organization-binding.sse', ['account-switch: Account changed: ignored 1 reasoning block'], 'made under another organization'],
    ['anthropic/opus-5.5_thinking-dropped_prefix-and-model-binding.sse', ['prefix-changed: Reasoning reset: ignored 1 reasoning block', 'model-switch: Model changed: ignored 1 reasoning block'], 'one after an edited history, one from another model: two notices'],
    ['anthropic/opus-5_thinking-dropped_model-binding_from-opus-5.5.sse', ['model-switch: Model changed: ignored 2 reasoning blocks'], 'two from another model: one notice'],
    ['anthropic/opus-5.5_thinking-mismatch-allowed_no-block-binding.sse', [], 'a mismatch the vendor accepts: no notice'],
  ] as const)
    test(`ignored thinking blocks: ${what}`, { skip: missing(file) }, async () => {
      const particles = await replayCapture(file);

      const shown = particles.filter(isPart('vnt')).filter(notice => 'nt' in notice && notice.nt === 'input-transform');
      assert.deepEqual(shown.map(notice => `${'cause' in notice ? notice.cause : ''}: ${notice.text}`), notices);
    });

  // Searches and fetches come from the usage block; code runs have no counter and are counted from the calls on the wire
  hostedToolCounts([
    ['anthropic/fable-5.1_dynamic-web-filtering.sse', { nWebSearch: 3, nWebFetch: 3, nCodeExec: 8 }, 'dynamic filtering: 8 code calls drive 3 searches and 3 fetches'],
    ['anthropic/fable-5.1_web+code+client-tools.sse', { nWebSearch: 3, nWebFetch: 2, nCodeExec: 4 }, '4 code runs, 3 searches, 2 fetches, then two client tool calls'],
    ['anthropic/sonnet-5.5_web+code+client-tools.sse', { nWebSearch: 3, nWebFetch: 3, nCodeExec: 7 }, '7 code runs, 3 searches, 3 fetches, then two client tool calls'],
    ['anthropic/haiku-5.5_code-execution-3-runs.sse', { nCodeExec: 3 }, 'three bash runs in one container'],
    ['anthropic/haiku-5.5_web-search-fetch.json', { nWebSearch: 2, nWebFetch: 2 }, '2 searches and 2 fetches, called directly'],
  ]);

  const FILTERING = 'anthropic/fable-5.1_dynamic-web-filtering.sse';

  test('a search or fetch made from code is shown under the code execution that made it', { skip: missing(FILTERING) }, async () => {
    const calledFromCode = sseData(capture(FILTERING))
      .filter(event => event.type === 'content_block_start' && event.content_block.type === 'server_tool_use' && event.content_block.caller?.tool_id)
      .map(event => event.content_block);
    assert.ok(calledFromCode.length > 0, 'the capture has hosted calls made from code');
    const particles = await replayCapture(FILTERING);

    const shown = particles.filter(isPart('vp'));
    for (const call of calledFromCode)
      assert.ok(shown.some(op => op.opId === call.id && op.parentOpId === call.caller.tool_id), `${call.name} ${call.id} is not shown under ${call.caller.tool_id}`);
  });

  const CLIENT_TOOLS = 'anthropic/sonnet-5.5_web+code+client-tools.sse';

  test('a turn that ends on client tool calls hands them over, after the hosted ones ran', { skip: missing(CLIENT_TOOLS) }, async () => {
    const clientCalls = sseData(capture(CLIENT_TOOLS)).filter(event => event.type === 'content_block_start' && event.content_block.type === 'tool_use').map(event => event.content_block);
    assert.equal(clientCalls.length, 2, 'the capture has two client tool calls');
    const particles = await replayCapture(CLIENT_TOOLS);

    assert.deepEqual(particles.filter(isPart('fci')).map(call => call.id), clientCalls.map(call => call.id));
    assert.equal(theEnd(particles).tokenStopReason, 'ok-tool_invocations');
  });

  // Server tool inputs are stored as received and read field by field: what the vendor adds or gets wrong must not fail the message
  describe('server tool inputs', () => {

    const message = (content: object[]) => ({
      id: 'msg_replay', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content,
      stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 },
    });

    const serverToolUse = (name: string, input: unknown) => ({ type: 'server_tool_use', id: 'srvtoolu_replay', name, input });

    test('a key we do not know is not a parsing failure', async () => {
      const { particles } = await replay([JSON.stringify(message([serverToolUse('web_search', { query: 'big-agi', limit: 3, recency: 'week' })]))], false, createAnthropicMessageParserNS);

      assert.deepEqual(issueTexts(particles), []);
      assert.ok(particles.filter(isPart('vp')).some(op => op.iTexts?.some(text => text.includes('big-agi'))), 'the query is shown');
    });

    test('a field of another type reads as absent', async () => {
      const { particles } = await replay([JSON.stringify(message([serverToolUse('text_editor_code_execution', { command: 'create', path: 123, file_text: 7 })]))], false, createAnthropicMessageParserNS);

      assert.deepEqual(issueTexts(particles), []);
      const [shown] = particles.filter(isPart('vp'));
      assert.ok(shown, 'the call is shown');
      assert.ok(!shown.text.includes('123'), 'a path that is not text is not shown as one');
      assert.equal(shown.iTexts, undefined);
    });

    test('streaming: an input that arrives as null does not break the stream', async () => {
      const { stop_reason, stop_sequence, usage, ...start } = message([]);
      const stream = sse([
        { event: 'message_start', data: { type: 'message_start', message: { ...start, stop_reason: null, stop_sequence: null, usage: { input_tokens: usage.input_tokens, output_tokens: 1 } } } },
        { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: serverToolUse('code_execution', {}) } },
        { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: 'null' } } },
        { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
        { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason, stop_sequence }, usage: { output_tokens: usage.output_tokens } } },
        { event: 'message_stop', data: { type: 'message_stop' } },
      ]);
      const { particles } = await replay([stream], true, createAnthropicMessageParser);

      assert.deepEqual(issueTexts(particles), []);
      assert.equal(particles.filter(isPart('vp')).length, 2, 'the call is shown when it starts and when its input is complete');
      assert.equal(theEnd(particles).tokenStopReason, 'ok');
    });

  });

});


// --- OpenAI Responses ---

describe('OpenAI Responses', () => {

  for (const file of ['openai/gpt-6-luna_image-generation-moderation-blocked.sse', 'openai/gpt-6-luna_image-generation-moderation-blocked_nonstream.json'])
    test(`a moderation-blocked image leaves an error part and the response completes (${isStream(file) ? 'streaming' : 'non-streaming'})`, { skip: missing(file) }, async () => {
      const raw = capture(file);
      const vendorError = findObject(isStream(file) ? sseData(raw) : JSON.parse(raw), object => object.code === 'moderation_blocked');
      assert.ok(typeof vendorError?.message === 'string', 'the capture has the moderation error');
      const particles = await replayCapture(file);

      // this error does not end the response: the vendor's stream goes on after the failed item, and so do we
      const issueAt = particles.findIndex(isControl('issue'));
      assert.equal(issueTexts(particles).length, 1);
      assert.ok(issueTexts(particles)[0].includes(vendorError.message), 'the error part carries the vendor\'s explanation');
      assert.ok(particles.slice(issueAt + 1).some(isText), 'the text the model writes after the block is kept');
      assert.equal(theEnd(particles).tokenStopReason, 'ok', 'a blocked image does not fail the response');
    });

  // tool_usage counts the searches; a page the model opens is a web_search_call of its own, on no counter.
  // Code interpreter runs have no counter at all and are counted from the calls.
  hostedToolCounts([
    ['openai/gpt-6-astra_search-open-find.sse', { nWebSearch: 2, nWebFetch: 1 }, '2 searches, 1 open_page, 1 find_in_page'],
    ['openai/gpt-6-astra_search-open-find_nonstream.json', { nWebSearch: 2, nWebFetch: 1 }, '2 searches, 1 open_page, 1 find_in_page'],
    ['openai/gpt-6-astra_search-3-queries-in-1-call.sse', { nWebSearch: 1, nWebFetch: 1 }, '1 search with 3 queries, 1 open_page'],
    ['openai/gpt-6-luna_code-interpreter-3-runs.sse', { nCodeExec: 3 }, 'three code interpreter runs in one container'],
  ]);

  const ALL_TOOLS = 'openai/gpt-6-astra-pro_search+code+image.sse';

  test('search, page open, code and image in one response: each is counted, the image arrives', { skip: missing(ALL_TOOLS) }, async () => {
    const particles = await replayCapture(ALL_TOOLS);

    const { nWebSearch, nWebFetch, nCodeExec } = finalMetrics(particles);
    assert.deepEqual({ nWebSearch, nWebFetch, nCodeExec }, { nWebSearch: 1, nWebFetch: 1, nCodeExec: 1 });
    assert.deepEqual(particles.filter(isPart('ii')).map(image => image.mimeType), ['image/webp']);
  });

  // #1207: the files are only named by the `container_file_citation` annotations of the answer text
  for (const file of ['openai/gpt-6-luna_code-interpreter-container-files.sse', 'openai/gpt-6-luna_code-interpreter-container-files_nonstream.json'])
    test(`files written by a code run are handed over, one per citation in the answer (${isStream(file) ? 'streaming' : 'non-streaming'})`, { skip: missing(file) }, async () => {
      const raw = capture(file);
      const cited: string[] = isStream(file)
        ? sseData(raw).filter(event => event.type === 'response.output_text.annotation.added' && event.annotation.type === 'container_file_citation').map(event => event.annotation.filename)
        : JSON.parse(raw).output.flatMap((item: any) => item.content ?? []).flatMap((part: any) => part.annotations ?? []).filter((annotation: any) => annotation.type === 'container_file_citation').map((annotation: any) => annotation.filename);
      assert.equal(cited.length, 2, 'the capture cites two files');
      const particles = await replayCapture(file);

      assert.deepEqual(particles.filter(isPart('hres')).map(file => 'filename' in file ? file.filename : undefined), cited);
    });

});


// --- xAI Responses ---

describe('xAI Responses', () => {

  // xAI's usage counts every web_search_call item, page opens included, and X searches apart: the client gets their sum
  // as searches and no fetches, also when the usage is more than the calls on the wire (LLM-pricing-pipeline.md, "Usage
  // parsing": the billed count). Code runs are the items, whatever their status: the usage's code_interpreter_calls says
  // none for a run that failed.
  hostedToolCounts([
    ['xai/grok-4.3_web-search-open-page.sse', { nWebSearch: 3 }, '1 search and 2 page opens, web_search_calls 3'],
    ['xai/grok-4.3_web-search-open-page_nonstream.json', { nWebSearch: 3 }, '1 search and 2 page opens, web_search_calls 3'],
    ['xai/grok-4.20-multi-agent_web-search-10-billed-2-on-wire.sse', { nWebSearch: 10 }, 'multi-agent: 2 searches on the wire, web_search_calls 10'],
    ['xai/grok-4.3_x-search.sse', { nWebSearch: 3 }, '3 X searches, x_search_calls 3'],
    ['xai/grok-4.3_x-search-tool-failed.sse', { nWebSearch: 1 }, 'an X search that failed and one that ran, x_search_calls 1'],
    ['xai/grok-4.3_web+x-search+code.sse', { nWebSearch: 3, nCodeExec: 1 }, '1 X search, 1 web search, 1 page open, 1 code run'],
    ['xai/grok-4.3_web+x-search+code_nonstream.json', { nWebSearch: 3, nCodeExec: 1 }, '1 X search, 1 web search, 1 page open, 1 code run'],
    ['xai/grok-4.3_code-interpreter-timeout.sse', { nCodeExec: 1 }, 'a code run that timed out (status failed), on no counter'],
  ]);

});


// --- Gemini ---

describe('Gemini generateContent', () => {

  // #1287: the error frame is followed by a bare JSON copy of itself, outside the event framing
  for (const [file, before] of [
    ['gemini/gemini-3.5-flash-lite_inband-504-after-text.sse', 'the text'],
    ['gemini/gemini-3.5-flash-lite_inband-504-during-code-run.sse', 'the code cell, left with no result'],
  ] as const)
    test(`an error sent mid-stream keeps what came before (${before}) and outputs nothing of what follows`, { skip: missing(file) }, async () => {
      const raw = capture(file);
      const afterErrorFrame = raw.slice(raw.search(/^data: \{"error"/m)).split(/\r?\n\r?\n/).filter(block => block.trim()).slice(1);
      assert.ok(afterErrorFrame.length > 0, 'the capture carries data after the error frame');
      const particles = await replayCapture(file);

      const issueAt = particles.findIndex(isControl('issue'));
      const kept = particles.slice(0, issueAt);
      assert.ok(file.includes('after-text') ? kept.some(isText) : kept.some(isPart('cei')) && !kept.some(isPart('cer')));
      assert.ok(particles.slice(issueAt + 1).every(op => 'cg' in op), 'content was output after the error');
      assert.equal(theEnd(particles).terminationReason, 'issue-dialect');
    });

  // #1287. No in-stream error with `details` was captured: the frames are built to the format Google documents for its
  // errors (https://google.aip.dev/193), where `details` is a list of typed entries.
  test('an error sent mid-stream shows its details, as JSON after the message', async () => {
    const error = { code: 429, message: 'Resource has been exhausted.', status: 'RESOURCE_EXHAUSTED' };
    const details = [
      { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'RATE_LIMIT_EXCEEDED', domain: 'googleapis.com', metadata: { service: 'generativelanguage.googleapis.com' } },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '41s' },
    ];
    const said = async (sent: object) => {
      const stream = sse([{ data: { candidates: [{ content: { parts: [{ text: 'Partial answer.' }], role: 'model' }, index: 0 }] } }, { data: { error: sent } }]);
      const texts = issueTexts((await replay([stream], true, () => createGeminiGenerateContentResponseParser('models/gemini-test', true))).particles);
      assert.equal(texts.length, 1);
      return texts[0];
    };

    assert.ok((await said(error)).endsWith('RESOURCE_EXHAUSTED (429): Resource has been exhausted.'), 'text was added to an error that has no details');
    const withDetails = await said({ ...error, details });
    const detailsAt = withDetails.indexOf('[{');
    assert.ok(withDetails.includes('RESOURCE_EXHAUSTED (429): Resource has been exhausted.') && detailsAt > 0, `the details are not in the text: ${withDetails}`);
    assert.deepEqual(JSON.parse(withDetails.slice(detailsAt)), details);
  });

  const NAMED_FILE = 'gemini/gemini-3.8-flash_code-execution-file-with-displayName.sse';

  test('a code execution file is delivered under the name it was sent with', { skip: missing(NAMED_FILE) }, async () => {
    const particles = await replayCapture(NAMED_FILE);

    const files = particles.filter(isPart('hres'));
    assert.equal(files.length, 1);
    assert.ok('filename' in files[0] && files[0].filename === 'out/report.xlsx');
  });

  const NO_IDS = 'gemini/gemini-2.5-flash_parallel-calls-no-ids.sse';

  test('parallel function calls that Gemini 2.x sends without ids are handed over in order, each under its own id', { skip: missing(NO_IDS) }, async () => {
    const sent = sseData(capture(NO_IDS)).flatMap(chunk => chunk.candidates?.[0]?.content?.parts ?? []).filter((part: any) => part.functionCall).map((part: any) => part.functionCall);
    assert.ok(sent.length === 3 && sent.every((call: any) => call.id === undefined), 'the capture has three calls without ids');
    const particles = await replayCapture(NO_IDS);

    const calls = particles.filter(isPart('fci'));
    assert.deepEqual(calls.map(call => [call.name, JSON.parse(call.i_args ?? '')]), sent.map((call: any) => [call.name, call.args]));
    assert.equal(new Set(calls.map(call => call.id)).size, 3);
  });

  // The calls say what ran. The candidate metadata does not: grounding lists a repeated query once and only the queries it used,
  // URL context drops entries; without tool circulation (2.x) the metadata is all there is.
  hostedToolCounts([
    ['gemini/gemini-4-argon_search-3-queries-in-1-call.sse', { nWebSearch: 3 }, 'one search call with 3 queries'],
    ['gemini/gemini-3.8-flash_same-search-twice.sse', { nWebSearch: 2 }, 'the same query searched twice'],
    ['gemini/gemini-4-argon_search+url+code_nonstream.json', { nWebSearch: 4, nWebFetch: 1, nCodeExec: 2 }, '2 search calls with 4 queries, 1 URL, 2 code cells'],
    ['gemini/gemini-4-argon_search+url+code+function.sse', { nWebSearch: 2, nWebFetch: 1, nCodeExec: 2 }, '1 search call with 2 queries, 1 URL, 2 code cells, ending on a function call'],
    ['gemini/gemini-4-argon_url-context-3-steps.sse', { nWebFetch: 3 }, '3 URL context calls'],
    ['gemini/gemini-3.8-flash_url-context_final-metadata-drops-a-call.sse', { nWebFetch: 2, nCodeExec: 2 }, '2 URL context calls, the final metadata lists one'],
    ['gemini/gemini-2.5-flash_url-context-3-steps.sse', { nWebFetch: 3 }, 'no tool circulation: 3 fetch steps in the metadata'],
  ]);

});


// --- OpenRouter ---

describe('OpenRouter Chat Completions', () => {

  // tool_calls_executed counts every server tool call OpenRouter runs: fetches are what is left after the searches only when
  // the request carried the fetch tool and no server tool other than search, which the dispatch tells the parser (the flag below)
  hostedToolCounts([
    ['openrouter/gemini-4-argon_search+fetch.sse', { nWebSearch: 2, nWebFetch: 2 }, '2 searches, 2 fetches, executed 4', true],
    ['openrouter/gpt-5.4-nano_search-max-uses-1_refused-calls.sse', { nWebSearch: 3, nWebFetch: 1 }, '3 search attempts (2 refused), 1 fetch, executed 4', true],
    ['openrouter/gpt-5.4-nano_fetch+client-function.sse', { nWebFetch: 1 }, '1 fetch, then a client function call', true],
    ['openrouter/claude-fable-5.1_native-search+fetch_no-tool-counters.sse', { nWebSearch: 1 }, 'search and fetch run by the provider: only the search is on a counter', true],
    ['openrouter/claude-fable-5.1_datetime+search+fetch+image.sse', { nWebSearch: 1 }, 'four server tools, executed 4: the fetches cannot be told apart', false],
    ['openrouter/gpt-5.4-nano_datetime+search+fetch+image_nonstream.json', { nWebSearch: 1 }, 'the same four server tools', false],
    ['openrouter/gpt-5.4-nano_datetime-only.sse', {}, 'the datetime tool alone, executed 1: neither a search nor a fetch', false],
    ['openrouter/gemini-3.8-flash_native-grounding-3-queries.sse', { nWebSearch: 3 }, 'provider-native search alone: 3 queries of one grounding call', false],
    ['openrouter/gpt-6-astra_native-engine-search+fetch.sse', { nWebSearch: 3, nWebFetch: 1 }, 'native-engine search with the fetch tool: 3 searches, 1 fetch, executed 4', true],
    ['openrouter/gpt-6-astra-pro_search+fetch.sse', { nWebSearch: 1, nWebFetch: 1 }, '1 search, 1 fetch, executed 2', true],
    ['openrouter/grok-4.7_search+fetch.sse', { nWebSearch: 2, nWebFetch: 2 }, '2 searches, 2 fetches on Grok, executed 4', true],
  ]);

  // 'error' is one of OpenRouter's normalized finish reasons, and a streamed finish is repeated on the usage chunk.
  // Synthetic: no provider failure was caught live
  test('finish_reason error fails the reply, keeps what came before, and the usage chunk after it still counts', async () => {
    const chunk = (delta: object, finish_reason: string | null, extra?: object) =>
      ({ data: { id: 'gen-replay', object: 'chat.completion.chunk', created: 1, model: 'vendor/model', choices: [{ index: 0, delta, finish_reason, native_finish_reason: null }], ...extra } });
    const stream = sse([
      chunk({ role: 'assistant', content: 'The first half' }, null),
      chunk({ role: 'assistant', content: '' }, 'error'),
      chunk({ role: 'assistant', content: '' }, 'error', { usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 } }),
    ]) + 'data: [DONE]\n\n';
    const { particles } = await replay([stream], true, () => createOpenAIChatCompletionsChunkParser());

    const { tokenStopReason, tokenStopError } = theEnd(particles);
    assert.equal(tokenStopReason && AixWire_Particles.gcStopReasonRow(tokenStopReason)?.class, 'error');
    assert.ok(tokenStopError, 'the user is told why');
    assert.equal(particles.filter(isText).map(op => op.t).join(''), 'The first half');
    const { TIn, TOut } = finalMetrics(particles);
    assert.deepEqual({ TIn, TOut }, { TIn: 12, TOut: 4 });
  });

});


// --- not covered yet ---

// What this file does not check. 'not written': the rule is clear and has no test here. 'not decided': there is no rule to
// test until someone rules.
describe('not covered yet', () => {

  for (const [what, why] of [
    ['hosted tool calls reach the client with the inputs and results the vendor sent',
      'not written. They become operation lines with cut texts; the protocol lab\'s loss check reports them as not carried in full (AIX-ingestion.md P4, P16, P24)'],
    ['citations, images and files the vendor sent all reach the client',
      'not written, beyond single cases in the vendor groups (AIX-ingestion.md P3, P18, P25)'],
    ['a streaming response and its non-streaming twin give the same result',
      'not written (AIX-ingestion.md: "the same in streaming and non-streaming")'],
    ['every hosted operation that opens also closes',
      'not written'],
    ['the message the user ends up with: its fragments, its outcome, what is replayed to the vendor',
      'not written. The replay stops at the particles the server sends: the client reassembler, the store and the replay are not run (AIX-ingestion.md T, R, S and Q items)'],
    ['the hosted-tool step budget stop is an error, or a truncation',
      'not decided (AIX-outcome.md "tool-budget stops"): its row asserts the vendor\'s words only'],
    ['a vendor error is also shown when the answer it follows is complete',
      'not decided (AIX-ingestion.md P21: it is dropped today): the row of #1149 asserts only that the answer stands'],
  ] as const)
    test(what, { skip: why }, () => undefined);

});
