/**
 * AIX Protocol Lab - capture, replay and oracle engines.
 *
 * All three modes run the REAL production pipeline end to end:
 *   createChatGenerateDispatch (real adapters + parsers) -> executeChatGenerateWithContinuation
 *   (continuation + operation retry + executor) -> particles.
 * The only lab additions are the TraceRecorder taps (see trace.ts) and, for replay, a synthetic
 * Response replaying the captured raw bytes through the real demuxer and parser.
 *
 * - capture: live API call; records raw chunks + events + calls + particles (+ NS twin separately)
 * - replay:  offline; feeds captured raw chunks through the same machinery (no keys needed)
 * - oracle:  for stored-response APIs (OpenAI Responses, Gemini Interactions), GETs the SAME
 *            generation non-streaming via the real resume dispatch - the exact structural oracle
 *            for the streaming accumulation
 */

import { fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { AixDebugObject } from '~/modules/aix/server/dispatch/chatGenerate/chatGenerate.debug';
import type { AixWire_Particles } from '~/modules/aix/server/api/aix.wiretypes';
import { ChatGenerateDispatch, ChatGenerateParseFunction, createChatGenerateDispatch, createChatGenerateResumeDispatch } from '~/modules/aix/server/dispatch/chatGenerate/chatGenerate.dispatch';
import { executeChatGenerateWithContinuation } from '~/modules/aix/server/dispatch/chatGenerate/chatGenerate.continuation';

import { createAnthropicMessageParser, createAnthropicMessageParserNS } from '~/modules/aix/server/dispatch/chatGenerate/parsers/anthropic.parser';
import { createGeminiGenerateContentResponseParser } from '~/modules/aix/server/dispatch/chatGenerate/parsers/gemini.parser';
import { createGeminiInteractionsParserNS, createGeminiInteractionsParserSSE } from '~/modules/aix/server/dispatch/chatGenerate/parsers/gemini.interactions.parser';
import { createOpenAIChatCompletionsChunkParser, createOpenAIChatCompletionsParserNS } from '~/modules/aix/server/dispatch/chatGenerate/parsers/openai.parser';
import { createOpenAIResponseParserNS, createOpenAIResponsesEventParser } from '~/modules/aix/server/dispatch/chatGenerate/parsers/openai.responses.parser';

import { accessForFlavor } from './access';
import { compileScenario, findScenario, LAB_DEFAULT_MODELS } from './scenarios';
import { LabFlavor, LabRun, LabRunMeta, LabSegment, TraceRecorder, withConsoleCapture } from './trace';


function _makeDebugObj(prettyDialect: string): AixDebugObject {
  return {
    prettyDialect,
    echoRequest: false,
    requestBodyOverride: undefined,
    consoleLogErrors: 'srv-warn' as const,
    profiler: undefined,
    wire: undefined,
  };
}

function _prettyDialect(flavor: LabFlavor): string {
  return flavor.charAt(0).toUpperCase() + flavor.slice(1);
}

/** Drives the full production pipeline, routing every particle (and console line) into the recorder. */
async function _runPipeline(
  recorder: TraceRecorder,
  dispatchCreator: () => Promise<ChatGenerateDispatch>,
  timeoutMs: number,
  echoConsole: boolean,
): Promise<LabRun> {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort('lab-timeout'), timeoutMs);
  const onSigint = () => abortController.abort('lab-sigint');
  process.on('SIGINT', onSigint);
  let engineError: string | undefined;
  try {
    await withConsoleCapture(recorder, echoConsole, async () => {
      for await (const particle of executeChatGenerateWithContinuation(dispatchCreator, abortController.signal, _makeDebugObj(_prettyDialect(recorder.run.meta.flavor))))
        recorder.onParticle(particle);
    });
  } catch (error: any) {
    // the executor converts errors into particles; anything thrown here is engine-level
    engineError = `${error?.name || 'Error'}: ${error?.message || String(error)}`;
  } finally {
    clearTimeout(timer);
    process.off('SIGINT', onSigint);
  }
  return recorder.finalize({ aborted: abortController.signal.aborted || undefined, error: engineError });
}


// -- Capture (live) --

export interface CaptureOptions {
  flavor: LabFlavor;
  scenarioId: string;
  modelIdOverride?: string;
  streaming: boolean;
  enableResumability?: boolean; // stores the response upstream, enabling a later oracle fetch
  timeoutMs?: number;
  echoConsole?: boolean;
}

export async function captureRun(opts: CaptureOptions): Promise<{ run: LabRun; keySource: string; unsupportedCaps: string[] }> {

  const scenario = findScenario(opts.scenarioId);
  const { access, keySource } = accessForFlavor(opts.flavor);
  const { model, chatGenerate, unsupportedCaps } = compileScenario(opts.flavor, scenario, opts.modelIdOverride);

  const recorder = new TraceRecorder({
    scenarioId: scenario.id,
    flavor: opts.flavor,
    dialect: access.dialect,
    modelId: model.id,
    streaming: opts.streaming,
    demuxerFormat: null, // set by instrumentDispatch from the real dispatch
    capturedAt: new Date().toISOString(),
    promptPreview: scenario.prompt.slice(0, 200),
    kind: 'capture',
    labVersion: 1,
  });

  const dispatchCreator = async (): Promise<ChatGenerateDispatch> => {
    const dispatch = await createChatGenerateDispatch(access, model, chatGenerate, opts.streaming, !!opts.enableResumability);
    return recorder.instrumentDispatch(
      dispatch,
      (signal) => fetchResponseOrTRPCThrow({ ...dispatch.request, signal, name: `AixLab.${opts.flavor}`, throwWithoutName: true }),
      true /* captureRaw */,
    );
  };

  const run = await _runPipeline(recorder, dispatchCreator, opts.timeoutMs ?? 600_000, !!opts.echoConsole);
  return { run, keySource, unsupportedCaps };
}


// -- Replay (offline, from a captured run) --

function _replayParserFor(meta: LabRunMeta): ChatGenerateParseFunction {
  const modelName = meta.modelId.replace('models/', '');
  switch (meta.flavor) {
    case 'anthropic-messages':
      return meta.streaming ? createAnthropicMessageParser() : createAnthropicMessageParserNS();
    case 'openai-responses':
      return meta.streaming ? createOpenAIResponsesEventParser('openai') : createOpenAIResponseParserNS('openai');
    case 'openai-chat':
      return meta.streaming ? createOpenAIChatCompletionsChunkParser() : createOpenAIChatCompletionsParserNS();
    case 'gemini-generate':
      return createGeminiGenerateContentResponseParser(modelName, meta.streaming);
    case 'gemini-interactions':
      return meta.streaming ? createGeminiInteractionsParserSSE(modelName) : createGeminiInteractionsParserNS(modelName);
  }
}

function _syntheticResponse(segment: LabSegment): Response {
  const chunks = (segment.rawChunks ?? []).map(c => new Uint8Array(Buffer.from(c.b64, 'base64')));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

export async function replayRun(source: LabRun, sourceLabel: string, echoConsole?: boolean): Promise<LabRun> {

  if (!source.segments.some(s => s.rawChunks?.length))
    throw new Error('Replay needs rawChunks in the source run (captured without raw recording?).');

  const recorder = new TraceRecorder({
    ...source.meta,
    kind: 'replay',
    replayOf: sourceLabel,
  });

  let segmentIndex = 0;
  const dispatchCreator = async (): Promise<ChatGenerateDispatch> => {
    const segment = source.segments[segmentIndex++];
    if (!segment)
      throw new Error(`Replay: the pipeline requested dispatch #${segmentIndex} but the capture has only ${source.segments.length} segment(s).`);
    const dispatch: ChatGenerateDispatch = {
      request: { url: segment.request.url, method: 'POST', headers: {}, body: (segment.request.body as object) ?? {} },
      demuxerFormat: source.meta.demuxerFormat,
      chatGenerateParse: _replayParserFor(source.meta),
    };
    return recorder.instrumentDispatch(dispatch, async () => _syntheticResponse(segment), false /* chunks come from the file */);
  };

  return await _runPipeline(recorder, dispatchCreator, 120_000, !!echoConsole);
}


// -- Oracle (non-streaming GET of the SAME stored generation) --

export async function oracleRun(source: LabRun, timeoutMs?: number, echoConsole?: boolean): Promise<LabRun> {

  const handleParticle = source.finalParticles.find(p => 'cg' in p && p.cg === 'set-upstream-handle') as Extract<AixWire_Particles.ChatControlOp, { cg: 'set-upstream-handle' }> | undefined;
  if (!handleParticle)
    throw new Error('Oracle needs an upstream handle: capture with --resumable on a stored-response flavor (openai-responses, gemini-interactions).');

  const { access } = accessForFlavor(source.meta.flavor);
  const recorder = new TraceRecorder({
    ...source.meta,
    streaming: false,
    demuxerFormat: null,
    kind: 'oracle',
    capturedAt: new Date().toISOString(),
  });

  const dispatchCreator = async (): Promise<ChatGenerateDispatch> => {
    const dispatch = await createChatGenerateResumeDispatch(access, { uht: handleParticle.handle.uht, runId: handleParticle.handle.runId }, false /* NS */);
    return recorder.instrumentDispatch(
      dispatch,
      (signal) => fetchResponseOrTRPCThrow({ ...dispatch.request, signal, name: `AixLab.oracle.${source.meta.flavor}`, throwWithoutName: true }),
      true,
    );
  };

  return await _runPipeline(recorder, dispatchCreator, timeoutMs ?? 300_000, !!echoConsole);
}


// -- Shared helpers for the CLI --

export const LAB_FLAVORS = Object.keys(LAB_DEFAULT_MODELS) as LabFlavor[];

export function isLabFlavor(value: string): value is LabFlavor {
  return (LAB_FLAVORS as string[]).includes(value);
}
