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
// Five groups:
// 1. "all captures: invariants": rules that hold for any vendor response, one test per rule over the captures of all vendors. Each
//    is checked against the capture itself, read by a few lines that share no code with the parsers, so no expectation is
//    written by hand and a capture added to a folder is checked from then on.
// 2. "all captures: through the client": the same particles past the wire, into the reassembler, the load repair and the
//    readers of the stored message.
// 3. "unclean endings": every ending that is not a clean finish, one row per ending.
// 4. one group per vendor API: what only that API does. What a hosted tool run counts as, what a paused turn sends back,
//    what a failed step leaves behind. One row per fact, with the calls on the wire in its name.
// 5. "not covered yet": what this file does not check, listed so that a green run is not read as more than it is.
//
// Captures are in tools/data/aix-replay/generations/<vendor>, as received (see the README there); a test whose capture
// is not there is reported as skipped. What a request body does not show about how a capture was made (a request header,
// a manual step, a cut) is in its .req.json, and repeated on its row here.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, test, type TestContext } from 'node:test';

import type { DMessageFragment } from '../../../../../common/stores/chat/chat.fragments';
import { type DMessage, type DMessageGenerator, messageFragmentsReduceText } from '../../../../../common/stores/chat/chat.message';
import { V4ToHeadConverters } from '../../../../../common/stores/chat/chats.converters';
import { messageTerminalOutcome } from '../../../../../common/stores/chat/chat.message.outcome';

import { AixWire_Particles, type AixWire_Vendors } from '../../api/aix.wiretypes';
import { ContentReassembler } from '../../../client/ContentReassembler';
import { aixIssue, aixIssueFails, type DAixIssue, type DAixIssueCode } from '../../../shared/aix.issues';
import { aixIssuePresentation, aixIssueReplayText } from '../../../shared/aix.issues.policy';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch, ChatGenerateParseFunction } from './chatGenerate.dispatch';
import { createAnthropicMessageParser, createAnthropicMessageParserNS } from './parsers/anthropic.parser';
import { createBedrockConverseParserNS, createBedrockConverseStreamParser } from './parsers/bedrock-converse.parser';
import { createEventStreamToSSETransform } from '../stream.demuxer.aws-eventstream';
import { createDeepseekMessagesParser } from './parsers/deepseek.messages.parser';
import { createGeminiGenerateContentResponseParser } from './parsers/gemini.parser';
import { createGeminiInteractionsParserNS, createGeminiInteractionsParserSSE } from './parsers/gemini.interactions.parser';
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

const _d: AixDebugObject = { runtime: 'relay', prettyDialect: 'Replay', echoRequest: false, requestBodyOverride: undefined, consoleLogErrors: false, profiler: undefined, wire: undefined };

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
async function replay(responses: (string | ReadableStream<Uint8Array>)[], streaming: boolean, createParser: () => ChatGenerateParseFunction, requestBody: object = {}): Promise<{ particles: Op[], requestBodies: any[] }> {
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

/** Issues the chain raises about itself: a response it could not read or parse, as opposed to what the vendor reported */
const _CHAIN_FAILURE_CODES: ReadonlySet<DAixIssueCode> = new Set(['dispatch-parse', 'dispatch-read', 'dispatch-prepare', 'dispatch-unknown']);

/** An issue as one string: the vendor's (or our) code, the sentence, the further words */
function _issueText(issue: DAixIssue): string {
  return [issue.causeCode, issue.text, issue.detail].filter(Boolean).join(' ');
}

/** The issues the chain raised about itself, by their record's code, as issueTexts writes them; `failing`: only those that fail the generation */
function chainFailures(particles: Op[], failing?: 'failing'): string[] {
  return particles.filter(isControl('aix-issue')).map(op => op.issue)
    .filter(issue => _CHAIN_FAILURE_CODES.has(issue.code) && (!failing || aixIssueFails(issue)))
    .map(_issueText);
}

/** Every issue the client receives, whether it fails the generation or not */
function issueTexts(particles: Op[]): string[] {
  return particles.filter(isControl('aix-issue')).map(op => _issueText(op.issue));
}

/** What the user is told about a bad ending: each issue that fails the generation */
function explanations(particles: Op[]): string[] {
  return particles.filter(isControl('aix-issue')).filter(op => aixIssueFails(op.issue)).map(op => _issueText(op.issue));
}

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

const anthropicMessages: VendorReplay = {
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
};

const VENDORS: Record<string, VendorReplay> = {
  anthropic: anthropicMessages,
  // Anthropic's wire, read the same way; its own parser; and an error DeepSeek also sends with no event name and no `type`
  deepseek: {
    ...anthropicMessages,
    parser: streaming => createDeepseekMessagesParser(streaming),
    errors: payloads => payloads.filter(event => event.error && (event.type === 'error' || event.type === undefined)).map(event => event.error.message).filter(Boolean),
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
/** The message is failed, either way AIX-outcome.md derives it: a stop reason of the error class, or none and an issue that fails */
const FAILED = 'failed';

type Ending = {
  ending: string,
  /** the stop reason sent with the end, or one of the three above */
  stop: AixWire_Particles.GCTokenStopReason | typeof FAILED | typeof NOT_CLEAN | typeof UNDECIDED,
  /** what the user reads about it; null when nothing is said, left out when not asserted */
  says?: RegExp | null,
  /** a second observation the user also reads, as a notice after the failure */
  alsoSays?: RegExp,
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
    stop: 'filter-refusal', says: /^reasoning_extraction .+\. This request was blocked/, // the category is the code, the explanation the further words
    files: ['anthropic/fable-5.2_refusal-reasoning-extraction_at-start.sse', 'anthropic/sonnet-5.5_refusal-reasoning-extraction_nonstream.json'],
  },
  {
    ending: 'stopped as recitation: the text before the stop is kept',
    stop: 'filter-recitation', says: /^RECITATION /,
    files: ['gemini/gemini-2.5-flash-lite_finish-RECITATION.sse'],
  },
  {
    ending: 'stopped by the safety filter, with the category and its level',
    stop: 'filter-content', says: /^SAFETY .+ HARM_CATEGORY_HARASSMENT \(medium\)(?: - .+)?$/, // the ratings lead the detail, before the vendor's message
    files: ['gemini/gemini-3.5-flash-lite_finish-SAFETY_after-text.sse', 'gemini/gemini-2.5-pro_finish-SAFETY_no-content.sse'],
  },
  {
    ending: 'a function call the model wrote wrong',
    stop: 'cg-issue', says: /^MALFORMED_FUNCTION_CALL Malformed function call: /,
    files: ['gemini/gemini-2.5-flash-lite_finish-MALFORMED_FUNCTION_CALL.sse'],
  },
  {
    ending: 'a function call with no tools in the request',
    stop: 'cg-issue', says: /^UNEXPECTED_TOOL_CALL .*no tools were enabled/,
    files: ['gemini/gemini-2.5-flash-lite_finish-UNEXPECTED_TOOL_CALL.sse'],
  },
  {
    // #1286. How this stop is classed is not decided (an error today, AIX-outcome.md "tool-budget stops" proposes truncated)
    ending: 'the hosted-tool step budget ran out: the vendor\'s reason, with its counts',
    stop: UNDECIDED, says: /^TOO_MANY_TOOL_CALLS The request reached the tool-use step limit/,
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
    // the vendor's code (its type when the code is null), then its message; the 'unknown' code of the failed response is not one
    stop: FAILED, says: /^(invalid_request_error|context_length_exceeded) (Container with id 'cntr_\w+' not found\.|Invalid service_tier argument param: service_tier|There was an issue with your request\.|Your input exceeds the context window of this model\..* type: invalid_request_error, param: input)/,
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
    // 160 bytes into the next event. Two observations: what the vendor said, and that the stream closed with no final event
    ending: 'failed by the vendor inside the stream, when the stream ends right after the error #1288',
    stop: FAILED, says: /^invalid_request_error Container with id 'cntr_\w+' not found\.$/, alsoSays: /^The service closed the response before its final status\.$/,
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
    stop: FAILED, says: /^DEADLINE_EXCEEDED Deadline expired before operation could complete\. DEADLINE_EXCEEDED \(504\)$|^UNAVAILABLE This model is currently experiencing high demand\..* UNAVAILABLE \(503\)$|^400 Model call failed: invalid request \(400\) \{"error_type":"invalid_request"\}$/,
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
  {
    // Synthetic: the frame DeepSeek documents for a generation that does not start in time, after a real stream's first
    // event. It has no event name and no `type`, and the vendor closes after it. The message text is ours (not documented)
    ending: 'DeepSeek gave up before generating: its frame with no event name ends the message as failed, with its words',
    stop: FAILED, says: /Timed out waiting for the generation to start/,
    files: ['deepseek/deepseek-flash_start-timeout_bare-error-frame_synthetic.sse'],
  },
  {
    // Synthetic: a real stream's first event, then its ping 12 times and no end. Rebuilds the stream seen on 2026-11-25
    // (1 in about 4,400), which pinged every 15 seconds for as long as the client stayed. The vendor says nothing: the words are ours
    ending: 'a DeepSeek stream that only pings is ended, as failed: nothing else would end it',
    stop: FAILED, says: /No content for 2 minutes, keep-alive pings only/,
    files: ['deepseek/deepseek-flash_stalled_pings-only_synthetic.sse'],
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
const OPENROUTER_USAGE_AFTER_ERROR = [
  'openrouter/qwen-2.5-7b_inband-error-400-after-content_no-done.sse',
  'openrouter/qwen-2.5-7b_inband-error-400-before-content_no-done.sse',
];
// Not a loss, and not comparable by this reader: the last frame of this stop reports no candidate tokens, earlier frames
// reported 18. The chain keeps 18; the reader takes the last frame.
const TOKENS_NOT_COMPARED = ['gemini/gemini-3.8-flash_tool-limit_search.sse'];

/**
 * The transmitter's end rules are nets: each writes a record for an ending no parser explained (ChatGenerateTransmitter,
 * _queueEndIssues). A net's record is its code's own sentence with no vendor word or code beside it; a cutoff that fails
 * can only be the net's (a parser states a close as a notice, after its own failure).
 */
function endNetsFired(particles: Op[]): DAixIssueCode[] {
  const stop = theEnd(particles).tokenStopReason;
  return particles.filter(isControl('aix-issue')).map(op => op.issue).filter(issue => {
    if (issue.detail || issue.causeCode) return false;
    switch (issue.code) {
      case 'dispatch-cutoff':
        return issue.effect === 'failed';
      case 'dispatch-aborted':
      case 'model-unfinished':
      case 'service-error':
        return issue.text === aixIssue(issue.code, issue.effect).text;
      case 'model-filter':
        return issue.text === (stop && AixWire_Particles.gcStopReasonRow(stop)?.message);
      default:
        return false;
    }
  }).map(issue => issue.code);
}

// The captures whose ending only a net explains, each with the reason. A new entry is a parser that left an ending
// unexplained: state it in the parser, or list it here with why the net is the right producer.
const END_NETS_EXPECTED: Record<string, DAixIssueCode[]> = {};

describe('all captures: invariants', () => {

  const folders = existsSync(CAPTURES) ? readdirSync(CAPTURES, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name) : [];
  const all = Object.keys(VENDORS).flatMap(capturesOf).filter(file => !/_\d+-continuation\./.test(file)); // a continuation is replayed with its `_1-initial`
  const skip = all.length ? false : `no captures in ${CAPTURES}`;
  const except = (...lists: string[][]) => all.filter(file => !lists.some(list => list.includes(file)));

  test('parses in strict mode and ends once', { skip }, () => overCaptures(all, g => {
    assert.deepEqual(chainFailures(g.particles), []);
    theEnd(g.particles);
  }));

  test('ends clean, unless listed under "unclean endings"', { skip }, () => overCaptures(all, g => {
    if (endingOf(g.file)) return false;
    const stopReason = theEnd(g.particles).tokenStopReason;
    assert.ok(stopReason === 'ok' || stopReason === 'ok-tool_invocations', `ends with ${stopReason ?? 'no stop reason'} and has no row in ENDINGS`);
  }));

  test('the answer text the vendor sent reaches the client', { skip }, () => overCaptures(except(GEMINI_2X_EARLY_STOP), answerArrives));

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
    () => overCaptures(except(GEMINI_2X_EARLY_STOP), answerIsExact)));

  test('Gemini 2.x streams with code execution deliver the whole answer and its usage', { skip: missing(...GEMINI_2X_EARLY_STOP) }, unlessNotYet(
    'the first of the intermediate STOPs ends the generation: the rest of the answer and the final usage are dropped (2.5 Flash Lite delivers none of its 77 characters)',
    () => overCaptures(GEMINI_2X_EARLY_STOP, g => {
      answerArrives(g);
      tokenTotalsAreTheVendors(g);
    })));

  test('the usage OpenRouter sends after an in-band error is reported', { skip: missing(...OPENROUTER_USAGE_AFTER_ERROR) }, unlessNotYet(
    'the error ends the generation, and the chunk after it, with the billed tokens, cost and tool calls, is not read',
    () => overCaptures(OPENROUTER_USAGE_AFTER_ERROR, tokenTotalsAreTheVendors)));

  test('a parser explains its own endings: no end net of the transmitter fires, unless listed', { skip }, async () => {
    const fired: Record<string, DAixIssueCode[]> = {};
    await overCaptures(all, g => {
      const nets = endNetsFired(g.particles);
      if (nets.length) fired[g.file] = nets;
    });
    assert.deepEqual(fired, END_NETS_EXPECTED);
  });

  test('every folder has a replay, and every row a capture', { skip }, () => {
    assert.deepEqual(folders.filter(folder => !(folder in VENDORS)), [], 'add a row to VENDORS');
    const named = [...ENDINGS.flatMap(ending => ending.files), ...GEMINI_2X_EARLY_STOP, ...OPENROUTER_USAGE_AFTER_ERROR, ...TOKENS_NOT_COMPARED, ...Object.keys(END_NETS_EXPECTED)];
    assert.deepEqual(named.filter(file => !existsSync(CAPTURES + file)), [], 'rows that name a capture that is not there');
  });

});


// --- all captures: through the client ---

// What the client stores for a generation, and what a reload makes of it. The particles are the ones replayed above; the
// reassembler, the load repair and the readers are the real ones. Images, audio and video cannot be decoded here: such a
// capture stores an `aix-media` issue for each, which is the lost-item path, not a failure.

const GENERATOR: DMessageGenerator = { mgt: 'aix', name: 'replay', aix: { vId: 'openai', mId: 'replay' } };

async function storeGeneration(particles: Op[]) {
  // the reassembler keeps a placeholder on screen for a moment before removing it: no wait here
  const { setTimeout: realSetTimeout } = globalThis;
  globalThis.setTimeout = ((handler: () => void) => setImmediate(handler)) as unknown as typeof setTimeout;
  const { log, warn, error } = console;
  console.log = console.warn = console.error = () => undefined;
  try {
    const reassembler = new ContentReassembler(GENERATOR, undefined, undefined, [], true);
    for (const op of particles)
      reassembler.enqueueWireParticle(structuredClone(op));
    await reassembler.waitForWireComplete();
    return reassembler.finalizeReassembly();
  } finally {
    globalThis.setTimeout = realSetTimeout;
    Object.assign(console, { log, warn, error });
  }
}

describe('all captures: through the client', () => {

  const all = Object.keys(VENDORS).flatMap(capturesOf).filter(file => !/_\d+-continuation\./.test(file));
  const skip = all.length ? false : `no captures in ${CAPTURES}`;

  const stored = new Map<string, ReturnType<typeof storeGeneration>>();
  const storedOf = (g: Generation) => stored.get(g.file) ?? stored.set(g.file, storeGeneration(g.particles)).get(g.file)!;
  /** overCaptures, for a rule that reads the stored message */
  const overStored = (holds: (g: Generation, result: Awaited<ReturnType<typeof storeGeneration>>) => boolean | void) => async () => {
    const results = new Map<string, Awaited<ReturnType<typeof storeGeneration>>>();
    for (const file of all)
      results.set(file, await storedOf(await generationOf(file)));
    await overCaptures(all, g => holds(g, results.get(g.file)!));
  };
  const storedIssues = (fragments: readonly DMessageFragment[]) => fragments.flatMap(fragment => fragment.ft === 'content' && fragment.part.pt === 'aix.issue' ? [fragment.part.issue] : []);

  test('the stored outcome is the one the end states, with at most one failure and always its record', { skip }, overStored((g, { outcome, fragments }) => {
    const { terminationReason, tokenStopReason } = theEnd(g.particles);
    const stopClass = tokenStopReason && AixWire_Particles.gcStopReasonRow(tokenStopReason)?.class;
    const expected = stopClass ? ({ ok: 'completed', truncated: 'truncated', error: 'failed' } as const)[stopClass] : terminationReason === 'done-dialect' ? 'completed' : 'failed';
    assert.equal(outcome, expected, `the end is ${terminationReason}/${tokenStopReason}`);
    const failed = storedIssues(fragments).filter(aixIssueFails);
    assert.equal(failed.length, outcome === 'failed' ? 1 : 0, `${failed.length} stored issue(s) fail a message that is ${outcome}`);
  }));

  test('every particle is placed: no unknown or unapplied notice, no failure of the client itself', { skip }, overStored((_g, { fragments }) => {
    assert.deepEqual(storedIssues(fragments).filter(issue => issue.code === 'aix-unknown').map(_issueText), []);
    assert.deepEqual(fragments.flatMap(fragment => fragment.ft === 'void' && fragment.part.pt === 'ph' && /unknown to this version|could not be applied/.test(fragment.part.pText) ? [fragment.part.pText] : []), []);
  }));

  test('the text on the wire is the text stored', { skip }, overStored((g, { fragments }) => {
    if (g.particles.some(op => isControl('aix-retry-reset')(op) && op.rClearStrategy !== 'none')) return false; // a retry takes the failed attempt's text back
    const wire = g.particles.filter(isText).map(op => op.t).join('');
    const texts = fragments.flatMap(fragment => fragment.ft === 'content' && fragment.part.pt === 'text' ? [fragment.part.text] : []);
    const kept = texts.filter(text => !/^Generated (audio|video|file) /.test(text)).join(''); // the reassembler's own line for a media item or a hosted file
    assert.ok(kept === wire, `${wire.length} characters on the wire, ${kept.length} stored`);
    // an issue closes the text before it: an empty chunk a vendor still sends after it must not open a new, empty text
    const afterIssue = fragments.slice(fragments.findIndex(fragment => fragment.ft === 'content' && fragment.part.pt === 'aix.issue') + 1 || fragments.length);
    assert.ok(!afterIssue.some(fragment => fragment.ft === 'content' && fragment.part.pt === 'text' && !fragment.part.text), 'an empty text fragment is stored after an issue');
  }));

  test('a reload changes nothing: the load repair keeps every fragment and the outcome, and every reader reads the message', { skip }, overStored((_g, { fragments, generator, outcome }) => {
    const message = { id: 'replay', role: 'assistant', fragments: structuredClone(fragments), generator, tokenCount: 0, created: 1, updated: null } as unknown as DMessage;
    V4ToHeadConverters.inMemHeadCleanDMessage(message, []);
    assert.deepEqual(message.fragments, fragments, 'the load repair changed the stored fragments');
    assert.equal(messageTerminalOutcome(message), outcome);
    messageFragmentsReduceText(message.fragments);
    for (const issue of storedIssues(message.fragments)) {
      aixIssuePresentation(issue);
      aixIssueReplayText(issue);
    }
  }));

});


// --- unclean endings ---

describe('unclean endings', () => {

  for (const { ending, stop, says, alsoSays, notYet, files } of ENDINGS) {
    const present = files.filter(file => existsSync(CAPTURES + file));
    test(`${ending} (${[...new Set(present.map(file => file.split('/')[0]))].join(', ')}: ${present.length})`, { skip: present.length ? false : 'captures not found' }, unlessNotYet(notYet, () => eachCapture(present, async file => {
      const particles = await replayCapture(file);

      const stopReason = theEnd(particles).tokenStopReason;
      if (stop === FAILED) {
        const issueFails = particles.some(op => isControl('aix-issue')(op) && aixIssueFails(op.issue));
        const failed = stopReason ? AixWire_Particles.gcStopReasonRow(stopReason)?.class === 'error' : issueFails;
        assert.ok(failed, `ends ${stopReason ?? 'with no stop reason'} and ${issueFails ? 'an' : 'no'} issue that fails: not a failed message`);
      } else if (stop === NOT_CLEAN)
        assert.ok(stopReason !== 'ok' && stopReason !== 'ok-tool_invocations', `ends ${stopReason}, a clean finish`);
      else if (stop !== UNDECIDED)
        assert.equal(stopReason, stop);
      const said = explanations(particles);
      assert.deepEqual(chainFailures(particles, 'failing'), [], 'the chain failed on the response');
      if (says === null)
        assert.deepEqual(said, []);
      else if (says)
        assert.ok(said.length === 1 && says.test(said[0]), `expected one explanation matching ${says}, got ${JSON.stringify(said)}`);
      if (alsoSays) {
        const noted = particles.filter(isControl('aix-issue')).filter(op => op.issue.effect === 'notice').map(op => _issueText(op.issue));
        assert.ok(noted.length === 1 && alsoSays.test(noted[0]), `expected one notice matching ${alsoSays}, got ${JSON.stringify(noted)}`);
      }
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

  // A paused turn is sent back with the chat before it, and the vendor checks all of it again: the response that continues the
  // turn lists the blocks the first response listed, and the user was told of those (#1304). A block it adds was ignored because
  // something before it changed between the two requests (in the edited capture, a word added to the user message before the
  // paused turn): that is a warning
  const DROPS_PAUSED = 'anthropic/haiku-5.5_pause-turn-thinking-dropped';
  for (const [continuation, adds, what] of [
    [`${DROPS_PAUSED}_2-continuation.sse`, 0, 'listed again when a paused turn continues: told once'],
    [`${DROPS_PAUSED}_continuation-edited.sse`, 1, 'one of the paused turn too, after an edit to the chat before it: a warning'],
  ] as const)
    test(`ignored thinking blocks: ${what}`, { skip: missing(`${DROPS_PAUSED}_1-initial.sse`, `${DROPS_PAUSED}_1-initial.req.json`, continuation) }, async () => {
      const listed = (file: string): string[] => sseData(capture(file)).find(event => event.type === 'message_start').message.input_transformations.map((dropped: any) => dropped.path);
      const first = listed(`${DROPS_PAUSED}_1-initial.sse`), added = listed(continuation).filter(path => !first.includes(path));
      assert.equal(added.length, adds, 'the capture: blocks the continuation lists and the first response did not');
      const { particles } = await replay([capture(`${DROPS_PAUSED}_1-initial.sse`), capture(continuation)], true, createAnthropicMessageParser, JSON.parse(capture(`${DROPS_PAUSED}_1-initial.req.json`)).body);

      const shown = particles.filter(isPart('vnt')).filter((notice): notice is Extract<typeof notice, { nt: 'input-transform' }> => notice.nt === 'input-transform');
      assert.deepEqual(shown.map(notice => notice.level), added.length ? [undefined, 'warn'] : [undefined]);
      assert.deepEqual(shown[0].paths, first);
      for (const path of added)
        assert.ok(shown[1].paths.includes(path), `the warning does not name ${path}`);
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

  // A refusal is a filter stop: the filter record, stated with the stop reason, is the one explanation
  const REFUSALS = ['anthropic/fable-5.2_refusal-reasoning-extraction_at-start.sse', 'anthropic/sonnet-5.5_refusal-reasoning-extraction_nonstream.json'];

  test('a refusal is explained once: the category is the code, the vendor\'s explanation the detail', { skip: missing(...REFUSALS) }, () => eachCapture(REFUSALS, async file => {
    const payloads = isStream(file) ? sseData(capture(file)) : [JSON.parse(capture(file))];
    const stopDetails = findObject(payloads, object => object.type === 'refusal' && 'category' in object);
    assert.ok(stopDetails, 'the capture has stop details');
    const particles = await replayCapture(file);

    const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.equal(issues.length, 1, `one issue, got ${JSON.stringify(issues)}`);
    const [{ code, effect, causeCode, detail }] = issues;
    assert.deepEqual({ code, effect, causeCode, detail }, { code: 'model-filter', effect: 'failed', causeCode: stopDetails.category, detail: stopDetails.explanation });
    // the end reason is the one the dialect had before: a streamed message_stop, a non-streaming body read to its end
    assert.equal(theEnd(particles).terminationReason, isStream(file) ? 'done-dialect' : 'done-dispatch-closed');
  }));

  test('a refusal with a suggested model: the model is in the detail, after the explanation', async () => {
    const refused = (stop_details: object) => JSON.stringify({
      id: 'msg_replay', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [],
      stop_reason: 'refusal', stop_sequence: null, stop_details, usage: { input_tokens: 10, output_tokens: 0 },
    });
    const { particles } = await replay([refused({ type: 'refusal', category: 'cyber', explanation: 'This request was blocked.', recommended_model: 'claude-haiku-5-5' })], false, createAnthropicMessageParserNS);

    const [issue, ...more] = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.deepEqual(more, []);
    assert.deepEqual({ code: issue.code, causeCode: issue.causeCode, detail: issue.detail }, { code: 'model-filter', causeCode: 'cyber', detail: 'This request was blocked. - recommended_model: claude-haiku-5-5' });
    assert.equal(theEnd(particles).tokenStopReason, 'filter-refusal');
  });

  test('a refusal category that is not a code is kept: it leads the detail, and the refusal type is the code', async () => {
    const body = JSON.stringify({
      id: 'msg_replay', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [],
      stop_reason: 'refusal', stop_sequence: null, stop_details: { type: 'refusal', category: 'general harms', explanation: 'This request was blocked.' }, usage: { input_tokens: 10, output_tokens: 0 },
    });
    const { particles } = await replay([body], false, createAnthropicMessageParserNS);

    const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.deepEqual(issues.map(({ code, causeCode, detail }) => ({ code, causeCode, detail })), [{ code: 'model-filter', causeCode: 'refusal', detail: 'category: general harms - This request was blocked.' }]);
  });

  // The `error` event ends the stream (no capture: Anthropic does not send it on request). Retryable classes retry while
  // attempts are left; on the last attempt, and for every other class, the generation fails with the vendor's words and code.
  describe('in-stream error event', () => {

    const errorAfterTextEvents = (error: object) => [
      { event: 'message_start', data: { type: 'message_start', message: { id: 'msg_replay', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } } },
      { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Partial answer' } } },
      { event: 'error', data: { type: 'error', error } },
    ];
    const errorAfterText = (error: object) => sse(errorAfterTextEvents(error));

    /** the parser as the retrier's gate answers; no retries left for any class is what a last attempt sees */
    const withRetries = (hasRetries: boolean) => (): ChatGenerateParseFunction => {
      const parse = createAnthropicMessageParser();
      return (pt, eventData, eventName) => parse(pt, eventData, eventName, { hasRetriesForHttpStatus: () => hasRetries });
    };
    const onLastAttempt = withRetries(false);

    // The Bedrock rows are the shape the demuxer gives an exception sent under its own `:event-type`. A `:message-type: exception`
    // frame reaches this parser with no `error` key and still fails as dispatch-parse, as on main
    for (const [what, error, expected] of [
      ['a retryable class on the last attempt', { type: 'overloaded_error', message: 'Overloaded' }, { text: 'Overloaded', causeCode: 'overloaded_error' }],
      ['the error code, when the vendor gives one, is the code, and the type is the detail', { type: 'rate_limit_error', message: 'You have reached your specified API usage limits.', details: { error_code: 'enforced_spend_limit_reached' } }, { text: 'You have reached your specified API usage limits.', causeCode: 'enforced_spend_limit_reached', detail: 'type: rate_limit_error' }],
      ['a Bedrock exception frame: the message of its body', { type: 'throttlingException', message: JSON.stringify({ message: 'Too many requests, please wait before trying again.' }) }, { text: 'Too many requests, please wait before trying again.', causeCode: 'throttlingException' }],
      ['a Bedrock exception frame: the other fields of its body are the detail', { type: 'modelStreamErrorException', message: JSON.stringify({ message: 'Model stream error', originalStatusCode: 424, originalMessage: 'The model returned: overloaded' }) }, { text: 'Model stream error', causeCode: 'modelStreamErrorException', detail: 'originalStatusCode: 424, originalMessage: The model returned: overloaded' }],
    ] as const)
      test(`the generation fails in the vendor's words: ${what}`, async () => {
        const { particles } = await replay([errorAfterText(error)], true, onLastAttempt);

        const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
        assert.equal(issues.length, 1, `one issue, got ${JSON.stringify(issues)}`);
        const [{ code, effect, text, causeCode, detail }] = issues;
        assert.deepEqual({ code, effect, text, causeCode, detail }, { code: 'service-error', effect: 'failed', detail: undefined, ...expected });
        assert.equal(particles.filter(isText).map(op => op.t).join(''), 'Partial answer', 'the text before the error is kept');
        const { terminationReason, tokenStopReason } = theEnd(particles);
        assert.deepEqual({ terminationReason, tokenStopReason }, { terminationReason: 'issue-dialect', tokenStopReason: 'cg-issue' });
      });

    test('a non-retryable class fails the generation on any attempt, with its type as the code', async () => {
      const { particles } = await replay([errorAfterText({ type: 'permission_error', message: 'Your API key does not have permission to use the specified resource.' })], true, withRetries(true));

      const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
      assert.deepEqual(issues.map(({ code, effect, causeCode }) => ({ code, effect, causeCode })), [{ code: 'service-error', effect: 'failed', causeCode: 'permission_error' }]);
      assert.equal(theEnd(particles).terminationReason, 'issue-dialect');
    });

    test('a retryable class with attempts left asks for a retry, and queues no issue', () => {
      const calls: string[] = [];
      const pt = new Proxy({}, { get: (_, name) => () => void calls.push(String(name)) }) as Parameters<ChatGenerateParseFunction>[0];
      const parse = withRetries(true)();
      const events = errorAfterTextEvents({ type: 'overloaded_error', message: 'Overloaded' });

      assert.throws(() => events.forEach(({ event, data }) => parse(pt, JSON.stringify(data), event)), (signal: any) => {
        assert.deepEqual({ name: signal.name, causeHttp: signal.causeHttp, causeConn: signal.causeConn }, { name: 'OperationRetrySignal', causeHttp: 529, causeConn: 'overloaded_error' });
        return true;
      });
      assert.deepEqual(calls.filter(name => /Issue|DialectEnded|TokenStopReason/.test(name)), [], 'an attempt that is retried leaves no issue and no end');
    });

    test('our own Bedrock decode failure is a parse failure, not the vendor\'s error', async () => {
      // the demuxer's marker, verbatim, for a chunk frame it could not decode
      const { particles } = await replay([errorAfterText({ type: 'transform_error', message: 'Failed to decode EventStream frame' })], true, onLastAttempt);

      const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
      assert.deepEqual(issues.map(({ code, effect, causeCode, detail }) => ({ code, effect, causeCode, detail })), [{ code: 'dispatch-parse', effect: 'failed', causeCode: undefined, detail: 'Failed to decode EventStream frame' }]);
      assert.deepEqual(chainFailures(particles, 'failing'), explanations(particles), 'the explanation is a chain failure');
      assert.equal(theEnd(particles).terminationReason, 'issue-dialect');
    });

  });

});


// --- DeepSeek ---

describe('DeepSeek Messages', () => {

  const THINKING_CALL = 'deepseek/deepseek-flash_thinking+function-call.sse';

  test('a thinking signature is not handed to the client: here it is a UUID that signs nothing, and it would be stored and replayed as a signature', { skip: missing(THINKING_CALL) }, async () => {
    const signatures: string[] = sseData(capture(THINKING_CALL)).filter(event => event.delta?.type === 'signature_delta').map(event => event.delta.signature);
    assert.ok(signatures.length, 'the capture carries no signature');

    const particles = await replayCapture(THINKING_CALL);
    assert.deepEqual(particles.filter(isPart('trs')), []);
    assert.deepEqual(signatures.filter(signature => JSON.stringify(particles).includes(signature)), []);
  });

  // The rule is the wire's, so Anthropic's captures are held to it too. Without a stored signature nothing else keeps the
  // thinking of two steps apart: the client joins unsigned reasoning into the block before it
  test('each thinking block opens its own reasoning', async () => {
    const files = [...capturesOf('deepseek'), ...capturesOf('anthropic')].filter(file => !/_\d+-continuation\./.test(file));
    await overCaptures(files, g => {
      const blocks = g.payloads.flat().flatMap(payload => g.streaming ? (payload.type === 'content_block_start' ? [payload.content_block] : []) : (payload.content ?? []))
        .filter((block: any) => block.type === 'thinking').length;
      if (!blocks) return false;
      assert.equal(g.particles.filter(isPart('tr_')).filter(op => op.restart).length, blocks);
    });
  });

  test('pings in a row end the stream at the 8th: 7, then content, is read to its end', { skip: missing(THINKING_CALL) }, async () => {
    const events = capture(THINKING_CALL).split('\n\n').filter(Boolean).map(event => event + '\n\n');
    const ping = events.find(event => event.startsWith('event: ping'))!;
    const slow = [events[0], ping.repeat(7), ...events.slice(1)].join('');

    const { particles } = await replay([slow], true, () => createDeepseekMessagesParser(true));
    assert.deepEqual(explanations(particles), []);
    assert.equal(theEnd(particles).tokenStopReason, 'ok-tool_invocations');
  });

  // The stalled stream never closes: once we end it, nothing reads its body. In the browser (CSF) no function teardown
  // closes it either, so the connection would stay open, pinging, until the page goes
  const STALLED = 'deepseek/deepseek-flash_stalled_pings-only_synthetic.sse';

  test('a stream we stop reading is released: its body is cancelled, not left open', { skip: missing(STALLED) }, async () => {
    let cancelled = false;
    const neverCloses = new ReadableStream<Uint8Array>({
      start: controller => controller.enqueue(new TextEncoder().encode(capture(STALLED))),
      cancel: () => void (cancelled = true),
    });

    const { particles } = await replay([neverCloses], true, () => createDeepseekMessagesParser(true));
    theEnd(particles);
    assert.ok(cancelled, 'the vendor\'s stream is still open');
  });

  // The web tools (deepseek_web_search, deepseek_read_url). The deep search is a battery run, sent by hand, of 3 searches,
  // 3 pages opened at once and 3 more one by one, and one text found in a page; the others were sent by the adapter.
  // The image search request carried a photo, masked in its .req.json.
  const DEEP = 'deepseek/deepseek-flash_deep-search_parallel-pages+find-in-page.sse';
  const QUICK_NS = 'deepseek/deepseek-flash_quick-search_nonstream.json';
  const LINKS = 'deepseek/deepseek-flash_read-url_2-links.sse';
  const LINK_FAILS = 'deepseek/deepseek-flash_read-url_not-accessible.sse';
  const BY_IMAGE = 'deepseek/deepseek-flash_image-search.sse';
  const WEB_TOOLS = [DEEP, QUICK_NS, LINKS, LINK_FAILS, BY_IMAGE];

  // what counts: the result blocks of each kind, failed ones included (usage.server_tool_use, web_search_requests and web_fetch_requests)
  hostedToolCounts([
    [DEEP, { nWebSearch: 3, nWebFetch: 7 }, 'a deep search: 3 searches, 6 pages opened, 1 text found in a page'],
    [QUICK_NS, { nWebSearch: 1 }, 'a quick search: 1 search of 3 queries'],
    [LINKS, { nWebFetch: 2 }, '2 links read'],
    [LINK_FAILS, { nWebFetch: 1 }, '1 link that could not be read'],
    [BY_IMAGE, { nWebSearch: 1 }, '1 search by image'],
  ]);

  /** The blocks the vendor sent, whole: a web tool's call and its result each arrive complete */
  const blocksSent = (g: Generation): any[] => g.streaming ? g.payloads.flat().filter(event => event.type === 'content_block_start').map(event => event.content_block) : g.payloads[0][0].content;

  test('every web tool call is shown under its id with what it looks for, and its result closes it: done, or failed for a link that cannot be read', { skip: missing(...WEB_TOOLS) }, () => overCaptures(WEB_TOOLS, g => {
    const blocks = blocksSent(g);
    const calls = blocks.filter(block => block.type === 'server_tool_use');
    assert.ok(calls.length, 'the capture has no web tool call');

    for (const call of calls) {
      const shown = g.particles.filter(isPart('vp')).filter(op => op.opId === call.id);
      const lookedFor: string[] = [...(call.input.queries ?? []), call.input.action === 'find_in_page' ? call.input.pattern : call.input.url].filter(Boolean);
      for (const what of lookedFor)
        assert.ok(shown[0]?.iTexts?.some(text => text.includes(what)), `${call.input.action} ${call.id}: ${what} is not shown`);

      const result = blocks.find(block => block.tool_use_id === call.id);
      assert.ok(result, `${call.id}: the capture has no result for it`);
      const failed = result.type === 'web_fetch_tool_result' ? result.content.type !== 'web_fetch_result' : !Array.isArray(result.content) || result.content[0]?.type === 'web_search_tool_result_error';
      assert.equal(shown.at(-1)?.state, failed ? 'error' : 'done', `${call.input.action} ${call.id}`);
    }
    // each is a web operation, and none is left to the parser's line for a tool it does not know
    assert.deepEqual(g.particles.filter(isPart('vp')).filter(op => op.mot !== 'search-web' || op.text.includes('deepseek_')), []);
  }));

  test('every source the answer cites reaches the client', { skip: missing(...WEB_TOOLS) }, () => overCaptures(WEB_TOOLS, g => {
    const cited: string[] = g.streaming
      ? g.payloads.flat().filter(event => event.delta?.type === 'citations_delta').map(event => event.delta.citation.url)
      : g.payloads[0][0].content.flatMap((block: any) => block.citations ?? []).map((citation: any) => citation.url);
    if (!cited.length) return false;
    const received = g.particles.filter(isPart('urlc')).map(op => op.url);
    assert.deepEqual([...new Set(cited)].filter(url => !received.includes(url)), []);
  }));

});


// --- OpenAI Responses ---

describe('OpenAI Responses', () => {

  for (const file of ['openai/gpt-6-luna_image-generation-moderation-blocked.sse', 'openai/gpt-6-luna_image-generation-moderation-blocked_nonstream.json'])
    test(`a moderation-blocked image leaves a tool issue and the response completes (${isStream(file) ? 'streaming' : 'non-streaming'})`, { skip: missing(file) }, async () => {
      const raw = capture(file);
      const vendorError = findObject(isStream(file) ? sseData(raw) : JSON.parse(raw), object => object.code === 'moderation_blocked');
      assert.ok(typeof vendorError?.message === 'string', 'the capture has the moderation error');
      const particles = await replayCapture(file);

      // this error does not end the response: the vendor's stream goes on after the failed item, and so do we
      const issueAt = particles.findIndex(isControl('aix-issue'));
      const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
      assert.equal(issues.length, 1);
      assert.deepEqual({ code: issues[0].code, causeCode: issues[0].causeCode, fails: aixIssueFails(issues[0]) }, { code: 'service-tool', causeCode: 'moderation_blocked', fails: false });
      assert.ok(issues[0].detail?.includes(vendorError.message.trim()), 'the issue carries the vendor\'s explanation');
      assert.ok(particles.slice(issueAt + 1).some(isText), 'the text the model writes after the block is kept');
      assert.equal(theEnd(particles).tokenStopReason, 'ok', 'a blocked image does not fail the response');
    });

  // Endings no capture shows, made from the captures: the vendor's words, code and fields are in the record
  const issuesOf = (particles: Op[]) => particles.filter(isControl('aix-issue')).map(op => op.issue);
  const reEvents = (events: any[]) => sse(events.map(data => ({ event: data.type, data })));
  const INCOMPLETE = 'openai/gpt-6-luna_incomplete-max-output-tokens-mid-text';

  /** The capture cut by the output limit, with another reason */
  async function incompleteFor(reason: string, streaming: boolean): Promise<{ sent: string, particles: Op[] }> {
    if (streaming) {
      const events = sseData(capture(`${INCOMPLETE}.sse`));
      for (const event of events)
        if (event.type === 'response.incomplete') event.response.incomplete_details = { reason };
      return { sent: VENDORS.openai.answerText(events, true), particles: (await replay([reEvents(events)], true, () => createOpenAIResponsesEventParser('openai'))).particles };
    }
    const body = JSON.parse(capture(`${INCOMPLETE}_nonstream.json`));
    body.incomplete_details = { reason };
    return { sent: VENDORS.openai.answerText([body], false), particles: (await replay([JSON.stringify(body)], false, () => createOpenAIResponseParserNS('openai'))).particles };
  }

  for (const streaming of [true, false]) {
    const mode = streaming ? 'streaming' : 'non-streaming', skip = missing(`${INCOMPLETE}${streaming ? '.sse' : '_nonstream.json'}`);

    test(`an incomplete response for content_filter is a filter stop, explained once, with nothing added to the answer (${mode})`, { skip }, async () => {
      const { sent, particles } = await incompleteFor('content_filter', streaming);

      assert.equal(theEnd(particles).tokenStopReason, 'filter-content');
      assert.deepEqual(issuesOf(particles).map(issue => [issue.code, issue.causeCode]), [['model-filter', 'content_filter']]);
      assert.equal(particles.filter(isText).map(op => op.t).join(''), sent);
    });

    test(`an incomplete response for another reason fails, naming the reason, with nothing added to the answer (${mode})`, { skip }, async () => {
      const { sent, particles } = await incompleteFor('server_shutdown', streaming);

      assert.equal(theEnd(particles).tokenStopReason, 'cg-issue');
      assert.deepEqual(issuesOf(particles).map(issue => [issue.code, aixIssueFails(issue), issue.causeCode, issue.detail]), [['service-error', true, 'server_shutdown', 'reason: server_shutdown']]);
      assert.equal(particles.filter(isText).map(op => op.t).join(''), sent);
    });
  }

  test('a non-streaming failed response with no error object fails, with an explanation', { skip: missing(`${INCOMPLETE}_nonstream.json`) }, async () => {
    const body = { ...JSON.parse(capture(`${INCOMPLETE}_nonstream.json`)), status: 'failed', incomplete_details: null, error: null };
    const { particles } = await replay([JSON.stringify(body)], false, () => createOpenAIResponseParserNS('openai'));

    assert.equal(theEnd(particles).tokenStopReason, 'cg-issue');
    assert.deepEqual(issuesOf(particles).map(issue => [issue.code, aixIssueFails(issue)]), [['service-error', true]]);
  });

  test('a non-streaming error body fails the reply in the vendor\'s words, with its code and fields', async () => {
    const error = { message: 'The model `gpt-0` does not exist or you do not have access to it.', type: 'invalid_request_error', param: 'model', code: 'model_not_found' };
    const { particles } = await replay([JSON.stringify({ error })], false, () => createOpenAIResponseParserNS('openai'));

    const { terminationReason, tokenStopReason } = theEnd(particles);
    assert.deepEqual([terminationReason, tokenStopReason], ['issue-dialect', 'cg-issue']);
    assert.deepEqual(issuesOf(particles).map(({ code, effect, text, causeCode, detail }) => ({ code, effect, text, causeCode, detail })),
      [{ code: 'service-error', effect: 'failed', text: error.message, causeCode: 'model_not_found', detail: 'type: invalid_request_error, param: model' }]);
  });

  test('an error with a numeric code and no string code: the numeric code is the cause code, the type goes to the detail (as in Chat Completions)', async () => {
    const error = { message: 'x', type: 'invalid_request_error', code: 400 };
    const { particles } = await replay([JSON.stringify({ error })], false, () => createOpenAIResponseParserNS('openai'));

    assert.deepEqual(issuesOf(particles).map(({ code, causeCode, detail }) => ({ code, causeCode, detail })),
      [{ code: 'service-error', causeCode: '400', detail: 'type: invalid_request_error' }]);
  });

  // #1288: the failed response after it says less (code 'unknown', no headers); the wait is the rate-limit capture's
  const AFTER_TEXT = 'openai/gpt-6-luna_container-deleted_error-after-text-then-failed.sse';

  test('an error event after text and the failed response after it are one explanation, with the event\'s facts', { skip: missing(AFTER_TEXT) }, async () => {
    const events = sseData(capture(AFTER_TEXT));
    const errorEvent = events.find(event => event.type === 'error');
    assert.equal(events.find(event => event.type === 'response.failed')?.response.error.code, 'unknown', 'the capture\'s failed response has no code');
    errorEvent.error.headers = { 'retry-after': '4', 'retry-after-ms': '3141' };
    const { particles } = await replay([reEvents(events)], true, () => createOpenAIResponsesEventParser('openai'));

    assert.equal(theEnd(particles).terminationReason, 'issue-dialect');
    assert.deepEqual(issuesOf(particles).map(({ code, effect, text, causeCode, retryAfterMs }) => ({ code, effect, text, causeCode, retryAfterMs })),
      [{ code: 'service-error', effect: 'failed', text: errorEvent.error.message, causeCode: 'invalid_request_error', retryAfterMs: 3141 }]);
  });

  /** The #1288 capture with other error objects in the 'error' event (null: none) and in 'response.failed' */
  function afterTextWith(eventError: object | null, failedError: object): string {
    const events = sseData(capture(AFTER_TEXT)).filter(event => eventError || event.type !== 'error');
    for (const event of events) {
      if (event.type === 'error') event.error = eventError;
      if (event.type === 'response.failed') event.response.error = failedError;
    }
    return reEvents(events);
  }

  /** the parser as the retrier's gate answers, for every class */
  const withRetriesLeft = (left: boolean) => (): ChatGenerateParseFunction => {
    const parse = createOpenAIResponsesEventParser('openai');
    return (pt, eventData, eventName) => parse(pt, eventData, eventName, { hasRetriesForHttpStatus: () => left });
  };

  for (const [what, eventError] of [['after an error event', { type: 'server_error', code: null, message: 'The server had an error.', param: null }], ['alone', null]] as const)
    test(`a failed response retries on its code, not on its type, as on main (${what})`, { skip: missing(AFTER_TEXT) }, async () => {
      const { particles } = await replay([afterTextWith(eventError, { type: 'server_error', code: 'unknown', message: 'The server had an error.' })], true, withRetriesLeft(true));

      assert.equal(theEnd(particles).terminationReason, 'issue-dialect');
      assert.deepEqual(issuesOf(particles).map(({ code, effect, text, causeCode }) => ({ code, effect, text, causeCode })), [{ code: 'service-error', effect: 'failed', text: 'The server had an error.', causeCode: 'server_error' }]);
      assert.ok(particles.some(isText), 'the streamed text is kept');
    });

  test('a failed response with a transient code and attempts left asks for a retry', { skip: missing(AFTER_TEXT) }, () => {
    const pt = new Proxy({}, { get: () => () => undefined }) as Parameters<ChatGenerateParseFunction>[0];
    const parse = withRetriesLeft(true)();
    const events = sseData(afterTextWith(null, { type: 'server_error', code: 'server_error', message: 'The server had an error.' }));
    assert.throws(() => events.forEach(data => parse(pt, JSON.stringify(data), data.type)), (signal: any) => {
      assert.deepEqual({ name: signal.name, causeHttp: signal.causeHttp, causeConn: signal.causeConn }, { name: 'OperationRetrySignal', causeHttp: 500, causeConn: 'server_error' });
      return true;
    });
  });

  test('a failed response with odd field values keeps the vendor\'s message', { skip: missing(AFTER_TEXT) }, async () => {
    const { particles } = await replay([afterTextWith(null, { type: { name: 'server_error' }, code: 'unknown', message: 'Container not found.', param: 42 })], true, () => createOpenAIResponsesEventParser('openai'));

    assert.deepEqual(issuesOf(particles).map(({ code, effect, text, causeCode }) => ({ code, effect, text, causeCode })), [{ code: 'service-error', effect: 'failed', text: 'Container not found.', causeCode: undefined }]);
  });

  test('a kept error event with no code and a failed response with one: the code is the cause code, the type the detail', { skip: missing(AFTER_TEXT) }, async () => {
    const { particles } = await replay([afterTextWith(
      { type: 'tokens', code: null, message: 'Rate limit reached for tokens per min.', param: null },
      { type: 'tokens', code: 'rate_limit_exceeded', message: 'Rate limit reached.' },
    )], true, withRetriesLeft(false));

    assert.deepEqual(issuesOf(particles).map(({ code, effect, text, causeCode, detail }) => ({ code, effect, text, causeCode, detail })),
      [{ code: 'service-error', effect: 'failed', text: 'Rate limit reached for tokens per min.', causeCode: 'rate_limit_exceeded', detail: 'type: tokens' }]);
  });

  test('a non-streaming error body whose message is not a string keeps the vendor\'s words in the detail', async () => {
    const { particles } = await replay([JSON.stringify({ error: { message: { text: 'Quota exceeded for project X' }, code: 'quota' } })], false, () => createOpenAIResponseParserNS('openai'));

    const issues = issuesOf(particles);
    assert.deepEqual(issues.map(({ code, effect, causeCode }) => ({ code, effect, causeCode })), [{ code: 'service-error', effect: 'failed', causeCode: 'quota' }]);
    assert.ok(issues[0].detail?.includes('Quota exceeded for project X'), `the vendor's words are in the record: ${issues[0].detail}`);
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

  // ChatGPT-backed relays send `response.metadata` (moderation flags) among the events of the API. An event type the parser
  // does not list is an unknown vendor shape (see the top of this file): fatal in development, skipped in production.
  // Synthetic: the event as logged in production, its flags left out, placed before the last text delta of a capture
  const WITH_TEXT = 'openai/gpt-6-luna_code-interpreter-3-runs.sse';

  test('an event type that is not listed is skipped in production: the answer around it arrives, the reply completes', { skip: missing(WITH_TEXT) }, async () => {
    const events = sseData(capture(WITH_TEXT));
    events.splice(events.findLastIndex(event => event.type === 'response.output_text.delta'), 0,
      { type: 'response.metadata', response_id: events[0].response.id, metadata: { openai_chatgpt_moderation_metadata: { prompt: {}, generation: {}, tool_call: {}, tool_response: {} } } });
    const stream = sse(events.map((data, sequence_number) => ({ event: data.type, data: { ...data, sequence_number } })));
    const replayIn = async (NODE_ENV: 'production' | 'development') => {
      Object.assign(process.env, { NODE_ENV });
      try {
        return (await replay([stream], true, () => createOpenAIResponsesEventParser('openai'))).particles;
      } finally {
        Object.assign(process.env, { NODE_ENV: 'development' });
      }
    };

    const particles = await replayIn('production');
    assert.equal(particles.filter(isText).map(op => op.t).join(''), VENDORS.openai.answerText(events, true));
    assert.deepEqual(issueTexts(particles), []);
    assert.equal(theEnd(particles).tokenStopReason, 'ok');
    assert.ok(chainFailures(await replayIn('development')).length, 'development did not fail on the unlisted event');
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

  const geminiReplay = async (...frames: object[]) =>
    (await replay([sse(frames.map(data => ({ data })))], true, () => createGeminiGenerateContentResponseParser('models/gemini-test', true))).particles;
  const geminiIssues = (particles: Op[]): DAixIssue[] => particles.filter(isControl('aix-issue')).map(op => op.issue);

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

      const issueAt = particles.findIndex(isControl('aix-issue'));
      const kept = particles.slice(0, issueAt);
      assert.ok(file.includes('after-text') ? kept.some(isText) : kept.some(isPart('cei')) && !kept.some(isPart('cer')));
      assert.ok(particles.slice(issueAt + 1).every(op => 'cg' in op), 'content was output after the error');
      assert.equal(theEnd(particles).terminationReason, 'issue-dialect');
    });

  // #1287. No in-stream error with `details` was captured: the frames are built to the format Google documents for its
  // errors (https://google.aip.dev/193), where `details` is a list of typed entries.
  test('an error sent mid-stream is the vendor\'s message, with its status as the code and its details as fields', async () => {
    const error = { code: 429, message: 'Resource has been exhausted.', status: 'RESOURCE_EXHAUSTED' };
    const details = [
      { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'RATE_LIMIT_EXCEEDED', domain: 'googleapis.com', metadata: { service: 'generativelanguage.googleapis.com' } },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '41s' },
    ];
    const issueOf = async (sent: unknown) => {
      const issues = geminiIssues(await geminiReplay({ candidates: [{ content: { parts: [{ text: 'Partial answer.' }], role: 'model' }, index: 0 }] }, { error: sent }));
      assert.equal(issues.length, 1);
      return issues[0];
    };

    const plain = await issueOf(error);
    assert.deepEqual([plain.code, plain.effect, plain.text, plain.causeCode, plain.detail], ['service-error', 'failed', 'Resource has been exhausted.', 'RESOURCE_EXHAUSTED', 'RESOURCE_EXHAUSTED (429)']);
    assert.equal(plain.httpStatus, undefined, 'an in-band code is not an HTTP status: the stream was a 200');

    const withDetails = await issueOf({ ...error, details });
    assert.equal(withDetails.text, 'Resource has been exhausted.');
    assert.equal(withDetails.detail, 'RESOURCE_EXHAUSTED (429) - ErrorInfo (reason: RATE_LIMIT_EXCEEDED, domain: googleapis.com, metadata: {"service":"generativelanguage.googleapis.com"}); RetryInfo (retryDelay: 41s)');
    assert.equal(withDetails.retryAfterMs, 41_000);

    const bare = await issueOf('Backend overloaded');
    assert.deepEqual([bare.text, bare.causeCode, bare.detail], ['Backend overloaded', undefined, undefined]);
  });

  // No capture: the frames below follow the wire schema. A filter stop is told once, by the issue stated with its stop reason
  test('a filter finish ends filtered, with the finish reason as the code and the vendor\'s message and ratings as the detail', async () => {
    const text = { candidates: [{ content: { parts: [{ text: 'Some text.' }], role: 'model' }, index: 0 }] };
    // outside SAFETY and IMAGE_SAFETY a routine rating is not the cause of the stop: only a blocked one is named
    const blocklist = await geminiReplay(text, { candidates: [{ finishReason: 'BLOCKLIST', finishMessage: 'Blocked term.', safetyRatings: [{ category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'LOW' }, { category: 'HARM_CATEGORY_HARASSMENT', probability: 'NEGLIGIBLE', blocked: true }], index: 0 }] });
    assert.deepEqual(geminiIssues(blocklist).map(issue => [issue.code, issue.effect, issue.causeCode, issue.text, issue.detail]),
      [['model-filter', 'failed', 'BLOCKLIST', AixWire_Particles.gcStopReasonRow('filter-content')?.message, 'HARM_CATEGORY_HARASSMENT (negligible) - Blocked term.']]);
    assert.deepEqual([theEnd(blocklist).terminationReason, theEnd(blocklist).tokenStopReason], ['issue-dialect', 'filter-content']);
    const recitation = await geminiReplay(text, { candidates: [{ finishReason: 'RECITATION', safetyRatings: [{ category: 'HARM_CATEGORY_HARASSMENT', probability: 'LOW' }], index: 0 }] });
    assert.deepEqual(geminiIssues(recitation).map(issue => [issue.code, issue.causeCode, issue.detail]), [['model-filter', 'RECITATION', undefined]]);

    // the detail is bounded from its end: a long vendor message must not cut the ratings
    const finishMessage = 'The model output could not be generated. '.repeat(60);
    const safety = await geminiReplay(text, { candidates: [{ finishReason: 'SAFETY', finishMessage, safetyRatings: [{ category: 'HARM_CATEGORY_HARASSMENT', probability: 'MEDIUM' }, { category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'NEGLIGIBLE' }], index: 0 }] });
    const [safetyIssue] = geminiIssues(safety);
    assert.ok(finishMessage.length > 2000 && safetyIssue.detail?.startsWith('HARM_CATEGORY_HARASSMENT (medium) - The model output could not be generated.'), safetyIssue.detail);

    // the refusal sentence would call an unsupported language a safety refusal
    const language = await geminiReplay({ candidates: [{ finishReason: 'LANGUAGE', index: 0 }] });
    assert.deepEqual(geminiIssues(language).map(issue => [issue.code, issue.effect, issue.causeCode, issue.text, issue.detail]), [['model-filter', 'failed', 'LANGUAGE', 'The language is not supported.', undefined]]);
    assert.equal(theEnd(language).tokenStopReason, 'filter-refusal');
  });

  test('a blocked prompt is a filter stop, as a blocked response is, with the block reason as the code and the ratings as the detail', async () => {
    const usage = { usageMetadata: { promptTokenCount: 12 } };
    const safety = await geminiReplay({ promptFeedback: { blockReason: 'SAFETY', safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'NEGLIGIBLE' }, { category: 'HARM_CATEGORY_HARASSMENT', probability: 'HIGH' }] }, ...usage });
    assert.deepEqual(geminiIssues(safety).map(issue => [issue.code, issue.effect, issue.causeCode, issue.text, issue.detail]), [['model-filter', 'failed', 'SAFETY', 'The input was not allowed.', 'HARM_CATEGORY_HARASSMENT (high)']]);
    assert.deepEqual([theEnd(safety).terminationReason, theEnd(safety).tokenStopReason], ['issue-dialect', 'filter-content']);

    // PROHIBITED_CONTENT blocks send no ratings
    const prohibited = await geminiReplay({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' }, ...usage });
    assert.deepEqual(geminiIssues(prohibited).map(issue => [issue.causeCode, issue.detail]), [['PROHIBITED_CONTENT', undefined]]);

    // a block reason that is not a code cannot be the code: the vendor's words lead the detail instead
    const freeText = await geminiReplay({ promptFeedback: { blockReason: 'MODEL ARMOR', safetyRatings: [{ category: 'HARM_CATEGORY_HARASSMENT', probability: 'HIGH' }] }, ...usage });
    assert.deepEqual(geminiIssues(freeText).map(issue => [issue.code, issue.causeCode, issue.detail]), [['model-filter', undefined, 'MODEL ARMOR - HARM_CATEGORY_HARASSMENT (high)']]);
  });

  test('a proxy error sent as a finish reason fails the generation, with the vendor\'s string as the detail', async () => {
    for (const finishReason of ['Proxy queue error: upstream timed out', 'upstream 503 Service Unavailable', 'Proxy error: connection reset']) {
      const particles = await geminiReplay({ candidates: [{ finishReason }] });
      assert.deepEqual(geminiIssues(particles).map(issue => [issue.code, issue.effect, issue.causeCode, issue.detail]), [['service-error', 'failed', undefined, finishReason]], finishReason);
      assert.deepEqual([theEnd(particles).terminationReason, theEnd(particles).tokenStopReason], ['issue-dialect', 'cg-issue'], finishReason);
    }
  });

  // In development an unknown finish reason throws (strict parsing); production reports it. The vendor's word stays in the record either way
  test('an unknown finish reason fails the generation in production, with the vendor\'s message as the text and its free-text reason as the detail', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    try {
      const freeText = await geminiReplay({ candidates: [{ finishReason: '502 Bad Gateway' }] });
      assert.deepEqual(geminiIssues(freeText).map(issue => [issue.code, issue.effect, issue.causeCode, issue.detail]), [['service-error', 'failed', undefined, '502 Bad Gateway']]);
      assert.deepEqual([theEnd(freeText).terminationReason, theEnd(freeText).tokenStopReason], ['issue-dialect', 'cg-issue']);

      const coded = await geminiReplay({ candidates: [{ finishReason: 'NEW_REASON', finishMessage: 'Stopped by a new rule.', index: 0 }] });
      assert.deepEqual(geminiIssues(coded).map(issue => [issue.code, issue.causeCode, issue.text, issue.detail]), [['service-error', 'NEW_REASON', 'Stopped by a new rule.', undefined]]);
    } finally {
      Object.assign(process.env, { NODE_ENV: 'development' });
    }
  });

  test('generated audio that cannot be converted fails the generation as our parse failure', async () => {
    const particles = await geminiReplay({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=opus;rate=24000', data: 'AAAA' } }], role: 'model' }, index: 0 }] });
    assert.deepEqual(geminiIssues(particles).map(issue => [issue.code, issue.effect, issue.detail]), [['dispatch-parse', 'failed', 'Unsupported audio codec: opus (expected pcm)']]);
    assert.deepEqual([theEnd(particles).terminationReason, theEnd(particles).tokenStopReason], ['issue-dialect', 'cg-issue']);
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


// --- Gemini Interactions ---

describe('Gemini Interactions', () => {

  // Synthetic: no run that failed, was cancelled, stopped unfinished or hit its budget was captured. The frames follow the spec
  // (Error { code, message }, Interaction.errors[], the status enum): the answer arrives as a model_output step, then the run ends
  // with `status`. Streaming ends on interaction.completed; non-streaming is the GET resource that Recover reads.
  const ANSWER = 'Partial answer.';
  const runStream = (status: string, extra?: object) => sse([
    { data: { event_type: 'interaction.created', interaction: { id: 'ix-replay', status: 'in_progress' } } },
    { data: { event_type: 'step.start', index: 0, step: { type: 'model_output' } } },
    { data: { event_type: 'step.delta', index: 0, delta: { type: 'text', text: ANSWER } } },
    { data: { event_type: 'step.stop', index: 0 } },
    { data: { event_type: 'interaction.completed', interaction: { id: 'ix-replay', status, ...extra } } },
  ]);
  const runResource = (status: string, extra?: object) =>
    JSON.stringify({ id: 'ix-replay', status, steps: [{ type: 'model_output', content: [{ type: 'text', text: ANSWER }] }], ...extra });
  const replayRun = async (streaming: boolean, status: string, extra?: object) => (await replay(
    [streaming ? runStream(status, extra) : runResource(status, extra)], streaming,
    () => streaming ? createGeminiInteractionsParserSSE('deep-research-replay') : createGeminiInteractionsParserNS('deep-research-replay'),
  )).particles;
  const issuesOf = (particles: Op[]) => particles.filter(isControl('aix-issue')).map(op => op.issue);

  // `cg-issue` keeps the upstream handle for Recover; each ending that fails is explained once, by the run's status or the vendor's error
  for (const streaming of [true, false]) {
    const how = streaming ? 'streaming' : 'non-streaming';

    // failed and requires_action are reported by the parser (issue-dialect); cancelled is stated with a 'cg-issue' stop reason (done-dialect)
    for (const [status, extra, expected] of [
      ['failed', { errors: [{ code: 'internal', message: 'The research agent crashed.' }, { message: 'Search quota reached.' }] }, { causeCode: 'internal', text: 'The research agent crashed.', detail: 'Search quota reached.', end: 'issue-dialect' }],
      // the first error with a message is the text; every other code stays beside its own error, never beside another's message
      ['failed', { errors: [{ code: 'type.googleapis.com/google.rpc/ABORTED' }, { code: 'quota', message: 'Quota.' }] }, { causeCode: 'quota', text: 'Quota.', detail: 'code: type.googleapis.com/google.rpc/ABORTED', end: 'issue-dialect' }],
      ['failed', { errors: [{ code: 'type.googleapis.com/google.rpc/INTERNAL', message: 'Crashed.' }, { code: 'quota', message: 'Quota.' }] }, { causeCode: 'failed', text: 'Crashed.', detail: 'code: type.googleapis.com/google.rpc/INTERNAL; Quota. (code: quota)', end: 'issue-dialect' }],
      ['failed', undefined, { causeCode: 'failed', text: 'The run failed.', detail: undefined, end: 'issue-dialect' }],
      ['requires_action', undefined, { causeCode: 'requires_action', text: 'The agent asked for an action this app does not support.', detail: undefined, end: 'issue-dialect' }],
      ['cancelled', undefined, { causeCode: 'cancelled', text: 'The run was cancelled.', detail: undefined, end: 'done-dialect' }],
    ] as const)
      test(`${how}: a run that ends ${status}${extra ? ` with errors ${JSON.stringify(extra.errors)}` : ''} keeps the answer and is explained once, in the vendor's words`, async () => {
        const particles = await replayRun(streaming, status, extra);

        assert.equal(particles.filter(isText).map(op => op.t).join(''), ANSWER);
        const failing = issuesOf(particles).filter(aixIssueFails);
        assert.equal(failing.length, 1, 'one explanation');
        assert.deepEqual(
          [failing[0].code, failing[0].causeCode, failing[0].text, failing[0].detail],
          ['service-error', expected.causeCode, expected.text, expected.detail],
        );
        const end = theEnd(particles);
        assert.deepEqual([end.tokenStopReason, end.terminationReason], ['cg-issue', expected.end]);
      });

    for (const status of ['incomplete', 'requires_continuation'] as const)
      test(`${how}: a run that ends ${status} is truncated by its stop reason alone: no note in the answer, no issue`, async () => {
        const particles = await replayRun(streaming, status);

        assert.equal(particles.filter(isText).map(op => op.t).join(''), ANSWER);
        assert.deepEqual(issuesOf(particles), []);
        const end = theEnd(particles);
        assert.deepEqual([end.tokenStopReason, end.terminationReason], ['out-of-tokens', 'done-dialect']);
      });

    test(`${how}: a run that ends budget_exceeded is truncated, with a notice that names the cause`, async () => {
      const particles = await replayRun(streaming, 'budget_exceeded');

      assert.equal(particles.filter(isText).map(op => op.t).join(''), ANSWER);
      const issues = issuesOf(particles);
      assert.equal(issues.length, 1);
      assert.deepEqual([issues[0].code, issues[0].causeCode, issues[0].text, issues[0].effect], ['service-error', 'budget_exceeded', 'The run stopped: budget exceeded.', 'notice']);
      const end = theEnd(particles);
      assert.deepEqual([end.tokenStopReason, end.terminationReason], ['out-of-tokens', 'done-dialect']);
    });
  }

  test('streaming: a run still in_progress at interaction.completed fails, explained by its status, and keeps the handle (cg-issue)', async () => {
    const particles = await replayRun(true, 'in_progress');

    assert.equal(particles.filter(isText).map(op => op.t).join(''), ANSWER);
    const failing = issuesOf(particles).filter(aixIssueFails);
    assert.deepEqual(failing.map(issue => [issue.code, issue.causeCode, issue.text]), [['service-error', 'in_progress', 'The run has not finished on the service.']]);
    const end = theEnd(particles);
    assert.deepEqual([end.tokenStopReason, end.terminationReason], ['cg-issue', 'done-dialect']);
  });

  // Recover on a live (or zombie) run: the diagnostics and the Recover / Cancel guidance stay in the answer, as before
  test('non-streaming: a run still in_progress keeps its diagnostics in the answer, explained by its status, and keeps the handle (cg-issue)', async () => {
    const particles = await replayRun(false, 'in_progress', { created: new Date(Date.now() - 5 * 60_000).toISOString() });

    const answer = particles.filter(isText).map(op => op.t).join('');
    assert.ok(answer.startsWith(ANSWER) && answer.includes('`in_progress`') && answer.includes('**Recover**'), `the diagnostics are not in the answer: ${answer}`);
    const failing = issuesOf(particles).filter(aixIssueFails);
    assert.deepEqual(failing.map(issue => [issue.code, issue.causeCode, issue.text]), [['service-error', 'in_progress', 'The run has not finished on the service.']]);
    const end = theEnd(particles);
    assert.deepEqual([end.tokenStopReason, end.terminationReason], ['cg-issue', 'done-dialect']);
  });

  test('an error event ends the run: the vendor\'s message is the text, its code the cause code (a URI code goes to the detail)', async () => {
    const errorRun = (error: object) => sse([
      { data: { event_type: 'interaction.created', interaction: { id: 'ix-replay', status: 'in_progress' } } },
      { data: { event_type: 'step.start', index: 0, step: { type: 'model_output' } } },
      { data: { event_type: 'step.delta', index: 0, delta: { type: 'text', text: ANSWER } } },
      { data: { event_type: 'error' } }, // observed empty mid-stream: skipped
      { data: { event_type: 'error', error } },
      { data: { event_type: 'step.delta', index: 0, delta: { type: 'text', text: ' After the error.' } } },
    ]);
    const said = async (error: object) => {
      const particles = (await replay([errorRun(error)], true, () => createGeminiInteractionsParserSSE('deep-research-replay'))).particles;
      assert.equal(particles.filter(isText).map(op => op.t).join(''), ANSWER, 'output after the error');
      assert.equal(theEnd(particles).terminationReason, 'issue-dialect');
      const issues = issuesOf(particles);
      assert.equal(issues.length, 1);
      assert.ok(aixIssueFails(issues[0]));
      assert.equal(theEnd(particles).tokenStopReason, 'cg-issue');
      return issues[0];
    };

    const message = 'Failed to get completed interaction: Result not found.';
    const plain = await said({ code: 'not_found', message });
    assert.deepEqual([plain.code, plain.causeCode, plain.text, plain.detail], ['service-error', 'not_found', message, undefined]);
    const uri = await said({ code: 'type.googleapis.com/google.rpc/NOT_FOUND', message });
    assert.deepEqual([uri.causeCode, uri.text, uri.detail], [undefined, message, 'code: type.googleapis.com/google.rpc/NOT_FOUND']);
    // a code with no message: the record's own sentence, the vendor's code as the cause code
    const codeOnly = await said({ code: 'deadline_exceeded' });
    assert.deepEqual([codeOnly.code, codeOnly.causeCode, codeOnly.text, codeOnly.detail], ['service-error', 'deadline_exceeded', 'The service reported an error.', undefined]);
  });

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
    // the user is told why, once though the finish came twice: the provider's own reason, when it gives one, is the code
    for (const [native, told] of [[null, 'The provider ended the reply with an error.'], ['OTHER', 'OTHER The provider ended the reply with an error (OTHER).']] as const) {
      const chunk = (delta: object, finish_reason: string | null, extra?: object) =>
        ({ data: { id: 'gen-replay', object: 'chat.completion.chunk', created: 1, model: 'vendor/model', choices: [{ index: 0, delta, finish_reason, native_finish_reason: finish_reason && native }], ...extra } });
      const stream = sse([
        chunk({ role: 'assistant', content: 'The first half' }, null),
        chunk({ role: 'assistant', content: '' }, 'error'),
        chunk({ role: 'assistant', content: '' }, 'error', { usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 } }),
      ]) + 'data: [DONE]\n\n';
      const { particles } = await replay([stream], true, () => createOpenAIChatCompletionsChunkParser());

      const { tokenStopReason } = theEnd(particles);
      assert.equal(tokenStopReason && AixWire_Particles.gcStopReasonRow(tokenStopReason)?.class, 'error', String(native));
      assert.deepEqual(issueTexts(particles), [told]);
      assert.equal(particles.filter(isText).map(op => op.t).join(''), 'The first half', String(native));
      const { TIn, TOut } = finalMetrics(particles);
      assert.deepEqual({ TIn, TOut }, { TIn: 12, TOut: 4 }, String(native));
    }
  });

  // Synthetic: Gemini through OpenRouter stops for its own filter reason, normalized to content_filter
  test('a content_filter finish names the provider\'s own reason, as the provider does directly', async () => {
    const chunk = (delta: object, finish_reason: string | null) =>
      ({ data: { id: 'gen-replay', object: 'chat.completion.chunk', created: 1, model: 'vendor/model', choices: [{ index: 0, delta, finish_reason, native_finish_reason: finish_reason && 'PROHIBITED_CONTENT' }] } });
    const stream = sse([chunk({ role: 'assistant', content: 'Partial' }, null), chunk({ content: '' }, 'content_filter')]) + 'data: [DONE]\n\n';
    const { particles } = await replay([stream], true, () => createOpenAIChatCompletionsChunkParser());

    assert.equal(theEnd(particles).tokenStopReason, 'filter-content');
    assert.deepEqual(particles.filter(isControl('aix-issue')).map(({ issue: { code, causeCode, effect } }) => [code, causeCode, effect]), [['model-filter', 'PROHIBITED_CONTENT', 'failed']]);

    const body = JSON.stringify({
      id: 'gen-replay', object: 'chat.completion', created: 1, model: 'vendor/model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Partial' }, finish_reason: 'content_filter', native_finish_reason: 'PROHIBITED_CONTENT' }],
    });
    const nonStreaming = await replay([body], false, () => createOpenAIChatCompletionsParserNS());
    assert.deepEqual(nonStreaming.particles.filter(isControl('aix-issue')).map(({ issue: { code, causeCode } }) => [code, causeCode]), [['model-filter', 'PROHIBITED_CONTENT']], 'non-streaming');
  });

  const INBAND_AFTER_CONTENT = 'openrouter/qwen-2.5-7b_inband-error-400-after-content_no-done.sse';

  test('an in-band error is one record: the message, the numeric code, the upstream cause; the read ends at it', { skip: missing(INBAND_AFTER_CONTENT) }, async () => {
    const particles = await replayCapture(INBAND_AFTER_CONTENT);

    const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.equal(issues.length, 1);
    const { code, effect, text, causeCode, detail } = issues[0];
    assert.deepEqual({ code, effect, text, causeCode, detail }, {
      code: 'service-error', effect: 'failed', text: 'Model call failed: invalid request (400)', causeCode: '400', detail: '{"error_type":"invalid_request"}',
    });
    const { tokenStopReason, terminationReason } = theEnd(particles);
    assert.deepEqual([tokenStopReason, terminationReason], ['cg-issue', 'issue-dialect']);
    const afterIssue = particles.slice(particles.findIndex(isControl('aix-issue')) + 1);
    assert.deepEqual(afterIssue.filter(op => !('cg' in op)), []);
  });

  // The upstream may stall after the error: on OpenRouter (its chunks name the `provider`) as on any other host, nothing
  // after the error is read, so the end does not wait on the connection
  for (const [host, extra] of [['OpenRouter', { provider: 'Any' }], ['another host', {}]] as const)
    test(`on ${host} an in-band error ends the read at once: the usage and content after it are not read`, async () => {
      const base = { id: 'gen-replay', object: 'chat.completion.chunk', created: 1, model: 'vendor/model', ...extra };
      const stream = sse([
        { data: { ...base, choices: [{ index: 0, delta: { role: 'assistant', content: 'Half an' }, finish_reason: null }] } },
        { data: { ...base, choices: [], error: { code: 'server_error', message: 'The server had an error.' } } },
        { data: { ...base, choices: [], usage: { prompt_tokens: 12, completion_tokens: 4 } } },
        { data: { ...base, choices: [{ index: 0, delta: { content: ' answer' }, finish_reason: 'stop' }] } },
      ]);
      const { particles } = await replay([stream], true, () => createOpenAIChatCompletionsChunkParser());

      const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
      assert.deepEqual(issues.map(({ code, effect, causeCode }) => ({ code, effect, causeCode })), [{ code: 'service-error', effect: 'failed', causeCode: 'server_error' }]);
      const { tokenStopReason, terminationReason } = theEnd(particles);
      assert.deepEqual([tokenStopReason, terminationReason], ['cg-issue', 'issue-dialect']);
      assert.deepEqual(particles.filter(isText).map(op => op.t).join(''), 'Half an');
      assert.deepEqual(particles.filter(isControl('set-metrics')), []);
    });

  test('an in-band error repeated in the stream is sent once, and the repeat is not retried', async () => {
    const errorChunk = (code: number, message: string) => ({ data: { id: 'gen-replay', object: 'chat.completion.chunk', created: 1, model: 'vendor/model', choices: [], error: { code, message } } });
    const stream = sse([errorChunk(400, 'Model call failed: invalid request (400)'), errorChunk(429, 'Rate limit exceeded')]);
    const { particles, requestBodies } = await replay([stream], true, () => createOpenAIChatCompletionsChunkParser());

    assert.equal(requestBodies.length, 1);
    assert.deepEqual(issueTexts(particles), ['400 Model call failed: invalid request (400)']);
    assert.equal(theEnd(particles).tokenStopReason, 'cg-issue');
  });

});


// --- OpenAI-compatible Chat Completions ---

describe('OpenAI-compatible Chat Completions', () => {

  const chunk = (delta: object, finish_reason: string | null) =>
    ({ data: { id: 'chatcmpl-replay', object: 'chat.completion.chunk', created: 1, model: 'vendor/model', choices: [{ index: 0, delta, finish_reason }] } });
  const finishing = (finish_reason: string) =>
    sse([chunk({ role: 'assistant', content: 'Partial' }, null), chunk({ content: '' }, finish_reason)]) + 'data: [DONE]\n\n';

  test('finish_reason content_filter is explained once, by the filter, with the vendor\'s finish reason', async () => {
    const { particles } = await replay([finishing('content_filter')], true, () => createOpenAIChatCompletionsChunkParser());

    assert.equal(theEnd(particles).tokenStopReason, 'filter-content');
    assert.deepEqual(particles.filter(isControl('aix-issue')).map(({ issue }) => [issue.code, issue.causeCode, issue.effect]), [['model-filter', 'content_filter', 'failed']]);
  });

  test('[Z.ai] finish_reason network_error fails the reply and ends the read, naming the reason', async () => {
    const { particles } = await replay([finishing('network_error')], true, () => createOpenAIChatCompletionsChunkParser());

    const end = theEnd(particles);
    assert.deepEqual([end.terminationReason, end.tokenStopReason], ['issue-dialect', 'cg-issue']);
    assert.deepEqual(particles.filter(isControl('aix-issue')).map(({ issue }) => [issue.code, issue.causeCode, issue.effect]), [['service-error', 'network_error', 'failed']]);
    assert.equal(particles.filter(isText).map(op => op.t).join(''), 'Partial');
  });

  test('an in-band error code that is prose is not the code: the type is, and the words go to the detail', async () => {
    const stream = sse([{ data: { error: { code: 'Bad Request', type: 'invalid_request_error', message: 'bad thing' } } }]);
    const { particles } = await replay([stream], true, () => createOpenAIChatCompletionsChunkParser());

    const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.deepEqual(issues.map(({ code, causeCode, text, detail }) => ({ code, causeCode, text, detail })), [
      { code: 'service-error', causeCode: 'invalid_request_error', text: 'bad thing', detail: 'code: Bad Request' },
    ]);
    assert.equal(theEnd(particles).tokenStopReason, 'cg-issue');
  });

  test('non-streaming: an error body fails the reply with the vendor\'s message and its string code; the type goes to the detail', async () => {
    const body = JSON.stringify({ error: { message: 'Incorrect API key provided.', type: 'invalid_request_error', param: null, code: 'invalid_api_key' } });
    const { particles } = await replay([body], false, () => createOpenAIChatCompletionsParserNS());

    const end = theEnd(particles);
    assert.deepEqual([end.terminationReason, end.tokenStopReason], ['issue-dialect', 'cg-issue']);
    assert.deepEqual(explanations(particles), ['invalid_api_key Incorrect API key provided. type: invalid_request_error']);
  });

  test('an in-band error with a numeric code and no string code: the numeric code is the cause code, the type goes to the detail (as in Responses)', async () => {
    const stream = sse([{ data: { error: { type: 'invalid_request_error', code: 400, message: 'x' } } }]);
    const { particles } = await replay([stream], true, () => createOpenAIChatCompletionsChunkParser());

    assert.deepEqual(particles.filter(isControl('aix-issue')).map(({ issue: { code, causeCode, detail } }) => ({ code, causeCode, detail })),
      [{ code: 'service-error', causeCode: '400', detail: 'type: invalid_request_error' }]);
  });

  test('non-streaming: audio that cannot be converted is our failure, with the conversion\'s words', async () => {
    const body = JSON.stringify({
      id: 'chatcmpl-replay', object: 'chat.completion', created: 1, model: 'vendor/model',
      choices: [{ index: 0, message: { role: 'assistant', content: null, audio: { id: 'audio-1', data: 'A', transcript: 'Hello', expires_at: 1 } }, finish_reason: 'stop' }],
    });
    const { particles } = await replay([body], false, () => createOpenAIChatCompletionsParserNS());

    const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.deepEqual(issues.map(({ code, effect }) => [code, effect]), [['dispatch-parse', 'failed']]);
    assert.ok(issues[0].detail, 'the conversion\'s error is the detail');
    assert.equal(theEnd(particles).tokenStopReason, 'cg-issue');
  });

});


// --- Bedrock Converse ---

// No Bedrock capture: the streams are AWS event-stream frames built here to the format AWS documents (string headers, the
// JSON payload), and run through the real demuxer before the chain. The demuxer does not check the CRCs: they are left zero.
describe('Bedrock Converse', () => {

  /** One event-stream frame: [total length][headers length][prelude CRC] headers payload [message CRC] */
  function awsFrame(headers: Record<string, string>, payload: string): Uint8Array {
    const encoder = new TextEncoder();
    const headerBytes = Object.entries(headers).flatMap(([name, value]) => {
      const nameBytes = encoder.encode(name), valueBytes = encoder.encode(value);
      return [nameBytes.length, ...nameBytes, 7 /* string */, valueBytes.length >> 8, valueBytes.length & 0xff, ...valueBytes];
    });
    const payloadBytes = encoder.encode(payload);
    const frame = new Uint8Array(12 + headerBytes.length + payloadBytes.length + 4);
    const view = new DataView(frame.buffer);
    view.setUint32(0, frame.length);
    view.setUint32(4, headerBytes.length);
    frame.set(headerBytes, 12);
    frame.set(payloadBytes, 12 + headerBytes.length);
    return frame;
  }

  const event = (type: string, data: object) => awsFrame({ ':event-type': type, ':content-type': 'application/json', ':message-type': 'event' }, JSON.stringify(data));

  /** The frames as the parser reads them: through the AWS event-stream demuxer */
  async function demuxed(frames: Uint8Array[]): Promise<string> {
    const body = new Blob(frames.map(frame => frame.slice().buffer)).stream().pipeThrough(createEventStreamToSSETransform());
    return await new Response(body).text();
  }

  const START_AND_TEXT = [
    event('messageStart', { role: 'assistant' }),
    event('contentBlockDelta', { contentBlockIndex: 0, delta: { text: 'The first half' } }),
  ];
  const USAGE = event('metadata', { usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 }, metrics: { latencyMs: 100 } });

  test('an exception frame fails the reply in the vendor\'s words, its type as the code, and keeps what came before', async () => {
    const exception = awsFrame({ ':exception-type': 'modelStreamErrorException', ':content-type': 'application/json', ':message-type': 'exception' },
      JSON.stringify({ message: 'The model stream failed.', originalStatusCode: 424, originalMessage: 'Upstream model error' }));
    const { particles } = await replay([await demuxed([...START_AND_TEXT, exception])], true, createBedrockConverseStreamParser);

    const issues = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.equal(issues.length, 1);
    assert.ok(aixIssueFails(issues[0]));
    assert.deepEqual({ code: issues[0].code, causeCode: issues[0].causeCode, text: issues[0].text }, { code: 'service-error', causeCode: 'modelStreamErrorException', text: 'The model stream failed.' });
    assert.ok(issues[0].detail?.includes('originalStatusCode: 424') && issues[0].detail.includes('originalMessage: Upstream model error'), `the other fields are not in the detail: ${issues[0].detail}`);
    assert.equal(particles.filter(isText).map(op => op.t).join(''), 'The first half');
    assert.deepEqual([theEnd(particles).terminationReason, theEnd(particles).tokenStopReason], ['issue-dialect', 'cg-issue']);
  });

  test('an error frame, whose facts are in its headers, fails the reply in the vendor\'s words', async () => {
    const error = awsFrame({ ':error-code': 'InternalFailure', ':error-message': 'An internal error occurred.', ':message-type': 'error' }, '');
    const { particles } = await replay([await demuxed([...START_AND_TEXT, error])], true, createBedrockConverseStreamParser);

    const said = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.deepEqual(said.map(issue => [issue.code, issue.causeCode, issue.text]), [['service-error', 'InternalFailure', 'An internal error occurred.']]);
    assert.ok(aixIssueFails(said[0]));
    assert.deepEqual([theEnd(particles).terminationReason, theEnd(particles).tokenStopReason], ['issue-dialect', 'cg-issue']);
  });

  test('an exception frame whose payload is not JSON is still the service\'s failure, in its words and with its type', async () => {
    const exception = awsFrame({ ':exception-type': 'internalServerException', ':message-type': 'exception' }, 'Internal failure');
    const { particles } = await replay([await demuxed([...START_AND_TEXT, exception])], true, createBedrockConverseStreamParser);

    const said = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.deepEqual(said.map(issue => [issue.code, issue.causeCode, issue.text, issue.detail]), [['service-error', 'internalServerException', 'Internal failure', undefined]]);
    assert.ok(aixIssueFails(said[0]));
    assert.deepEqual([theEnd(particles).terminationReason, theEnd(particles).tokenStopReason], ['issue-dialect', 'cg-issue']);
  });

  test('an error frame with no facts at all is still the service\'s failure, not ours', async () => {
    const error = awsFrame({ ':message-type': 'error' }, '');
    const { particles } = await replay([await demuxed([...START_AND_TEXT, error])], true, createBedrockConverseStreamParser);

    const said = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.deepEqual(said.map(issue => [issue.code, issue.causeCode, issue.detail]), [['service-error', undefined, undefined]]);
    assert.ok(said[0].text, 'the record\'s own sentence');
    assert.ok(aixIssueFails(said[0]));
    assert.deepEqual([theEnd(particles).terminationReason, theEnd(particles).tokenStopReason], ['issue-dialect', 'cg-issue']);
  });

  test('an exception sent under its own event type fails the reply with its message, not its payload as JSON', async () => {
    const exception = awsFrame({ ':event-type': 'throttlingException', ':content-type': 'application/json' }, JSON.stringify({ message: 'Too many requests, please wait before trying again.' }));
    const { particles } = await replay([await demuxed([...START_AND_TEXT, exception])], true, createBedrockConverseStreamParser);

    const said = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.deepEqual(said.map(issue => [issue.code, issue.causeCode, issue.text, issue.detail]), [['service-error', 'throttlingException', 'Too many requests, please wait before trying again.', undefined]]);
    assert.ok(aixIssueFails(said[0]));
    assert.deepEqual([theEnd(particles).terminationReason, theEnd(particles).tokenStopReason], ['issue-dialect', 'cg-issue']);
  });

  for (const stopReason of ['guardrail_intervened', 'content_filtered'] as const) {
    const stop = { stopReason };
    const check = (particles: Op[], terminationReason: string) => {
      const said = particles.filter(isControl('aix-issue')).map(op => op.issue);
      assert.deepEqual(said.map(issue => [issue.code, issue.causeCode, issue.text]), [['model-filter', stopReason, AixWire_Particles.gcStopReasonRow('filter-content')?.message]], 'one explanation, the stop row\'s sentence, with the vendor\'s reason');
      const end = theEnd(particles);
      assert.deepEqual([end.tokenStopReason, end.terminationReason], ['filter-content', terminationReason]);
      const { TIn, TOut } = finalMetrics(particles);
      assert.deepEqual({ TIn, TOut }, { TIn: 12, TOut: 4 });
    };

    test(`a filter stop (${stopReason}) is explained once, with the vendor's reason, and its usage counts (streaming)`, async () => {
      const { particles } = await replay([await demuxed([...START_AND_TEXT, event('messageStop', stop), USAGE])], true, createBedrockConverseStreamParser);
      check(particles, 'done-dialect');
    });

    test(`a filter stop (${stopReason}) is explained once, with the vendor's reason, and its usage counts (non-streaming)`, async () => {
      const body = { output: { message: { role: 'assistant', content: [{ text: 'The first half' }] } }, ...stop, usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 } };
      const { particles } = await replay([JSON.stringify(body)], false, createBedrockConverseParserNS);
      check(particles, 'done-dispatch-closed');
    });
  }

  test('an event the parser cannot read is our failure, not the service\'s', async () => {
    const unreadable = event('contentBlockDelta', { contentBlockIndex: 0, delta: { unknownKind: {} } });
    const { particles } = await replay([await demuxed([...START_AND_TEXT, unreadable, USAGE])], true, createBedrockConverseStreamParser);

    const said = explanations(particles);
    assert.ok(said.length === 1 && chainFailures(particles, 'failing')[0] === said[0], `expected one chain failure, got ${JSON.stringify(said)}`);
    assert.equal(particles.filter(isControl('aix-issue'))[0].issue.code, 'dispatch-parse');
  });

  test('a frame the demuxer cannot decode is our failure, not the service\'s', async () => {
    const undecodable = awsFrame({ ':event-type': 'chunk', ':content-type': 'application/json', ':message-type': 'event' }, '{not json');
    const { particles } = await replay([await demuxed([...START_AND_TEXT, undecodable])], true, createBedrockConverseStreamParser);

    const said = particles.filter(isControl('aix-issue')).map(op => op.issue);
    assert.deepEqual(said.map(issue => [issue.code, issue.causeCode, issue.detail]), [['dispatch-parse', undefined, 'Failed to decode EventStream frame']]);
    assert.ok(aixIssueFails(said[0]));
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
