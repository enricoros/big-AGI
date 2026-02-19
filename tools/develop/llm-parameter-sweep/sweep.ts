#!/usr/bin/env tsx
/**
 * LLM Parameter Sweep Tool
 *
 * Tests which parameter values are accepted by various LLM vendor APIs.
 * Iterates: vendors -> models -> sweep parameters -> parameter values,
 * sending minimal requests and reporting pass/fail for each.
 *
 * Usage:
 *   npx tsx tools/develop/llm-parameter-sweep/sweep.ts --dialect openai --key sk-... --model-filter "gpt-4o-mini" --max-models 1
 *   npx tsx tools/develop/llm-parameter-sweep/sweep.ts --config path/to/config.json
 *   npx tsx tools/develop/llm-parameter-sweep/sweep.ts --help
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { AixAPI_Access, AixAPI_Model, AixAPIChatGenerate_Request, AixWire_Particles } from '~/modules/aix/server/api/aix.wiretypes';
import type { IParticleTransmitter, ParticleCGDialectEndReason, ParticleServerLogLevel } from '~/modules/aix/server/dispatch/chatGenerate/parsers/IParticleTransmitter';
import type { ModelDescriptionSchema } from '~/modules/llms/server/llm.server.types';
import { ChatGenerateDispatch, createChatGenerateDispatch } from '~/modules/aix/server/dispatch/chatGenerate/chatGenerate.dispatch';
import { listModelsRunDispatch } from '~/modules/llms/server/listModels.dispatch';
import { fetchResponseOrTRPCThrow, TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';


// --- SWEEP DEFINITIONS ---

const SWEEP_DEFINITIONS = [

  // Cross-vendor: temperature
  defineSweep({
    name: 'temperature',
    description: 'Temperature parameter acceptance range',
    applicability: { type: 'all' },
    applyToModel: (value) => ({ temperature: value }),
    values: [0, 0.5, 1.0, 1.5, 2.0],
    mode: 'enumerate',
  }),

  // OpenAI: reasoning effort (Chat Completions + Responses API)
  defineSweep({
    name: 'oai-reasoning-effort',
    description: 'OpenAI reasoning_effort values',
    applicability: { type: 'dialects', dialects: ['openai', 'azure', 'openrouter'] },
    applyToModel: (value) => ({ reasoningEffort: value }),
    values: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh' /*, 'max'*/ /* OpenRouter-only? */] satisfies AixAPI_Model['reasoningEffort'][],
    neuteredValues: ['medium'], // medium is the default, so only-medium means no real support
    mode: 'enumerate',
  }),

  // OpenAI: verbosity (Responses API)
  defineSweep({
    name: 'oai-verbosity',
    description: 'OpenAI text.verbosity values (Responses API)',
    applicability: { type: 'dialects', dialects: ['openai', 'openrouter'] },
    applyToModel: (value) => ({ vndOaiVerbosity: value }),
    values: ['low', 'medium', 'high'] satisfies AixAPI_Model['vndOaiVerbosity'][],
    neuteredValues: ['medium'], // medium is the default, so only-medium means no real support
    mode: 'enumerate',
  }),

  // OpenAI: image generation (Responses API)
  defineSweep({
    name: 'oai-image-generation',
    description: 'OpenAI image generation quality (off/mq/hq)',
    applicability: { type: 'dialects', dialects: ['openai'] },
    applyToModel: (value) => value ? { vndOaiImageGeneration: value } : {},
    values: ['hq'] satisfies (AixAPI_Model['vndOaiImageGeneration'] | null)[],
    mode: 'enumerate',
  }),

  // OpenAI: web search context (Responses API)
  defineSweep({
    name: 'oai-web-search',
    description: 'OpenAI web search context size (off/medium)',
    applicability: { type: 'dialects', dialects: ['openai'] },
    applyToModel: (value) => value ? { vndOaiWebSearchContext: value } : {},
    values: ['high'] satisfies (AixAPI_Model['vndOaiWebSearchContext'] | null)[],
    mode: 'enumerate',
  }),


  // Anthropic: effort
  defineSweep({
    name: 'ant-effort',
    description: 'Anthropic output_config.effort values',
    applicability: { type: 'dialects', dialects: ['anthropic'] },
    applyToModel: (value) => ({ reasoningEffort: value }),
    values: ['low', 'medium', 'high', 'max'] satisfies AixAPI_Model['reasoningEffort'][],
    mode: 'enumerate',
  }),

  // Anthropic: thinking budget
  defineSweep({
    name: 'ant-thinking-budget',
    description: 'Anthropic thinking.budget_tokens boundaries',
    applicability: { type: 'dialects', dialects: ['anthropic'] },
    applyToModel: (value) => ({
      vndAntThinkingBudget: value,
      maxTokens: 16384,
    }),
    values: [1024, 8192, 16384, 32768, 65535],
    mode: 'enumerate',
  }),


  // Gemini: thinking level (Gemini 3.x)
  // - Pro supports: high, low
  // - Flash supports: high, medium, low, minimal
  // - null = dynamic (model decides)
  defineSweep({
    name: 'gemini-thinking-level',
    description: 'Gemini thinkingConfig.thinkingLevel values',
    applicability: { type: 'dialects', dialects: ['gemini'] },
    applyToModel: (value) => value ? { reasoningEffort: value } : {}, // null = dynamic mode, don't set level
    values: ['minimal', 'low', 'medium', 'high'] satisfies (AixAPI_Model['reasoningEffort'] | null)[],
    mode: 'enumerate',
  }),

  // Gemini: thinking budget (Gemini 2.x)
  // - Range: 0 to 24576
  // - Values 1-1024 get rounded up to 1024
  // - 0 = disable thinking
  defineSweep({
    name: 'gemini-thinking-budget',
    description: 'Gemini thinkingConfig.thinkingBudget boundaries',
    applicability: { type: 'dialects', dialects: ['gemini'] },
    applyToModel: (value) => ({
      vndGeminiThinkingBudget: value,
    }),
    values: [0, 1024, 16384, 24576, 32768, 65535],
    mode: 'enumerate',
  }),


  // xAI: reasoning effort (Responses API)
  defineSweep({
    name: 'xai-reasoning-effort',
    description: 'xAI reasoning.effort values',
    applicability: { type: 'dialects', dialects: ['xai'] },
    applyToModel: (value) => ({ reasoningEffort: value }),
    values: ['low', 'medium', 'high'] satisfies AixAPI_Model['reasoningEffort'][],
    mode: 'enumerate',
  }),

  // xAI: web search
  defineSweep({
    name: 'xai-web-search',
    description: 'xAI web search capability',
    applicability: { type: 'dialects', dialects: ['xai'] },
    applyToModel: (value) => ({ vndXaiWebSearch: value }),
    values: ['auto'] satisfies AixAPI_Model['vndXaiWebSearch'][],
    mode: 'enumerate',
  }),

] as const satisfies SweepDefinition<any>[];


interface SweepDefinition<TValue> {
  name: string;
  description: string;
  applicability:
    | { type: 'all' }
    | { type: 'dialects'; dialects: AixAPI_Access['dialect'][] };
  values: TValue[];
  applyToModel: (value: TValue) => Partial<AixAPI_Model>;
  mode: 'enumerate' | 'bisect';
  /** For bisect mode: precision to stop binary search */
  bisectPrecision?: number;
  /** If ALL passing values are in this set, the parameter is considered neutered (default-only, not truly supported) */
  neuteredValues?: TValue[];
}

type SweepValue = string | number | boolean | null;

function defineSweep<const TValue>(definition: SweepDefinition<TValue>) {
  return definition;
}

/** Check if passing values are neutered (only default/no-op values passed) */
function isSweepNeutered(sweepName: string, passingValues: SweepValue[]): boolean {
  const sweepDef = SWEEP_DEFINITIONS.find(s => s.name === sweepName);
  if (!sweepDef?.neuteredValues?.length || passingValues.length === 0) return false;
  return passingValues.every(v => (sweepDef.neuteredValues as SweepValue[]).includes(v));
}

// ============================================================================
// Types
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
} as const;

interface CliOptions {
  config?: string;
  dialect?: string;
  key?: string;
  host?: string;
  modelFilter?: string;
  sweepFilter?: string;
  delay: number;
  maxModels: number;
  verbose: boolean;
  debug: boolean;
  includeSymlinks: boolean;
  dryRun: boolean;
  sequential: boolean;
  mergeModels: boolean;
}

// Types: Config File

interface SweepConfigFile {
  delayMs?: number;
  maxTokens?: number;
  vendors: Record<string, SweepConfigFile_Vendor>;
}

interface SweepConfigFile_Vendor {
  access: AixAPI_Access;
  sweeps?: string[];                // names of built-in sweeps from SWEEP_DEFINITIONS
  modelFilter?: string | string[];  // prefix(es) to match model IDs
  baseModelOverrides?: Partial<AixAPI_Model>;
}

// Types: Sweep Results

interface VendorSweepResult {
  vendorName: string;
  dialect: AixAPI_Access['dialect'];
  modelsAvailable: number;
  modelsTested: number;
  models: ModelSweepResult[];
  modelFilter?: string; // effective filter used (from config and/or CLI)
}

interface ModelSweepResult {
  modelId: string;
  modelLabel: string;
  results: TestResult[];
}

interface TestResult {
  sweepName: string;
  paramValue: SweepValue;
  outcome: TestOutcome;
  errorMessage: string | null; // source of truth for non-pass outcomes (always set when outcome !== 'pass')
  errorCategory?: ErrorCategory; // secondary, used for symbol display
  httpStatus?: number;
  responseText?: string;
  verboseLogs: string[];       // --verbose: response/error details
  debugRequestAixModel?: string; // --debug: AixAPI_Model JSON
  debugRequestBody?: string;   // --debug: request body JSON
  durationMs: number;
}

type TestOutcome = 'pass' | 'fail' | 'blocked' | 'truncated' | 'error';


type ErrorCategory =
  | 'exception' // exception testing the parameter
  | 'dialect'   // parsing fails
  | 'abort' | 'connection' | 'http' | 'parse'; // tRPC errors


// ============================================================================
// SweepCollectorTransmitter - Lightweight IParticleTransmitter for probing
// ============================================================================

class SweepCollectorTransmitter implements IParticleTransmitter {
  text: string = '';
  dialectIssue: string | null = null;
  tokenStopReason: AixWire_Particles.GCTokenStopReason | null = null;
  endReason: string | null = null;

  get hasText(): boolean { return this.text.length > 0; }
  get hasError(): boolean { return this.dialectIssue !== null; }

  // Parser-initiated Control
  setDialectEnded(reason: ParticleCGDialectEndReason): void {
    this.endReason = reason;
  }

  setDialectTerminatingIssue(dialectText: string, _symbol: string | null, _serverLog: ParticleServerLogLevel): void {
    this.dialectIssue = dialectText;
  }

  // Parts data - only collect text, everything else is a no-op
  endMessagePart(): void { /* no-op */ }

  appendText(textChunk: string): void {
    this.text += textChunk;
  }

  appendReasoningText(_textChunk: string, _options?: { weak?: 'tag'; restart?: boolean }): void { /* no-op */ }
  setReasoningSignature(_signature: string): void { /* no-op */ }
  addReasoningRedactedData(_data: string): void { /* no-op */ }
  appendAutoText_weak(textChunk: string): void { this.text += textChunk; }
  appendAudioInline(_mimeType: string, _base64Data: string, _label: string, _generator: string, _durationMs: number): void { /* no-op */ }
  appendImageInline(_mimeType: string, _base64Data: string, _label: string, _generator: string, _prompt: string): void { /* no-op */ }
  startFunctionCallInvocation(_id: string | null, _functionName: string, _expectedArgsFmt: 'incr_str' | 'json_object', _args: string | object | null): void { /* no-op */ }
  appendFunctionCallInvocationArgs(_id: string | null, _argsJsonChunk: string): void { /* no-op */ }
  addCodeExecutionInvocation(_id: string | null, _language: string, _code: string, _author: 'gemini_auto_inline' | 'code_interpreter'): void { /* no-op */ }
  addCodeExecutionResponse(_id: string | null, _error: boolean | string, _result: string, _executor: 'gemini_auto_inline' | 'code_interpreter', _environment: 'upstream'): void { /* no-op */ }
  appendUrlCitation(_title: string, _url: string, _citationNumber?: number, _startIndex?: number, _endIndex?: number, _textSnippet?: string, _pubTs?: number): void { /* no-op */ }

  // Special
  sendControl(_cgCOp: AixWire_Particles.ChatControlOp, _flushQueue?: boolean): void { /* no-op */ }
  sendVoidPlaceholder(_mot: 'search-web' | 'gen-image' | 'code-exec', _text: string): void { /* no-op */ }
  sendSetVendorState(_vendor: string, _state: unknown): void { /* no-op */ }

  // Non-parts data
  setModelName(_modelName: string): void { /* no-op */ }
  setProviderInfraLabel(_label: string): void { /* no-op */ }
  setUpstreamHandle(_handle: string, _type: 'oai-responses'): void { /* no-op */ }
  setTokenStopReason(reason: AixWire_Particles.GCTokenStopReason): void { this.tokenStopReason = reason; }
  updateMetrics(_update: Partial<AixWire_Particles.CGSelectMetrics>): void { /* no-op */ }
}


// ============================================================================
// Minimal Request Construction
// ============================================================================

function createMinimalChatRequest(): AixAPIChatGenerate_Request {
  return {
    systemMessage: null,
    chatSequence: [{
      role: 'user' as const,
      parts: [{ pt: 'text' as const, text: 'just say `hi`' }],
    }],
  };
}

function createBaseModel(modelId: string, maxTokens: number): AixAPI_Model {
  return {
    id: modelId,
    acceptsOutputs: ['text'],
    // NOTE: we do NOT desire any default temperture here!
    maxTokens,
  };
}

/** Derive AixAPI_Model overrides from the model's interfaces array (mirrors aix.client.ts) */
function modelOverridesFromInterfaces(interfaces: string[]): Partial<AixAPI_Model> {
  const overrides: Partial<AixAPI_Model> = {};

  // Output modalities (mirrors aix.client.ts logic)
  // FIXME: FLAW, THIS IS REFERENCING THE FUTURE - Chicken/Egg
  //        Right now we have a chicken-and-egg problem where we need to
  //        This may under-report capabilities for in image gen/audio output (not tested yet)
  //        We do 'fix' this for images by checking 'vndOaiImageGeneration' in OAI chatCompletions (no issue in Responses API)
  //        - Long term we shall get rid of the modalities, which is client-side logic, and let the server-side(S) compute them
  const acceptsOutputs: AixAPI_Model['acceptsOutputs'] = [];
  if (!interfaces.includes('outputs-no-text')) acceptsOutputs.push('text');
  if (interfaces.includes('outputs-audio')) acceptsOutputs.push('audio');
  if (interfaces.includes('outputs-image')) acceptsOutputs.push('image');
  overrides.acceptsOutputs = acceptsOutputs;

  // Output APIs
  if (interfaces.includes('oai-responses'))
    overrides.vndOaiResponsesAPI = true;

  // Client-side HotFixes
  // 2026-02-18: NOTE: disabling this, as we may be actually testing the temperature
  // if (interfaces.includes('hotfix-no-temperature'))
  //   overrides.temperature = null;

  return overrides;
}

/** Derive AixAPI_Model overrides from the model ID (name-based heuristics) */
function modelOverridesFromId(modelId: string, dialect: string): Partial<AixAPI_Model> {
  const overrides: Partial<AixAPI_Model> = {};
  // Enable web search for deep-research and search-api models (OpenAI only for now)
  if (dialect === 'openai' && (modelId.includes('-deep-research-') || modelId.includes('-search-api-'))) {
    overrides.vndOaiWebSearchContext = 'medium';
  }
  return overrides;
}


// ============================================================================
// Core Test Function
// ============================================================================

async function testParameterValue(
  access: AixAPI_Access,
  modelId: string,
  sweepDef: SweepDefinition<SweepValue>,
  value: SweepValue,
  maxTokens: number,
  baseModelOverrides: Partial<AixAPI_Model> | undefined,
): Promise<TestResult> {
  const startTime = Date.now();
  const baseModel = createBaseModel(modelId, maxTokens);
  const modelOverrides = sweepDef.applyToModel(value);
  const model: AixAPI_Model = { ...baseModel, ...baseModelOverrides, ...modelOverrides };
  const debugRequestAixModel = JSON.stringify(model);
  const chatGenerate = createMinimalChatRequest();

  // Build vendor-specific HTTP request via the AIX dispatch system
  let dispatch: ChatGenerateDispatch | undefined;

  // Capture request body for --debug output
  const debugRequestBody = dispatch && 'body' in dispatch.request ? JSON.stringify(dispatch.request.body) /*, null, 2)*/ : undefined;

  // Helper to build result with common fields
  const makeResult = (fields: Omit<TestResult, 'sweepName' | 'paramValue' | 'debugRequestBody'>): TestResult => ({
    sweepName: sweepDef.name,
    paramValue: value,
    debugRequestAixModel,
    debugRequestBody,
    ...fields,
  });


  // Create the dispatch, which may throw when building the reuest (e.g. parameter range incompatibility)
  try {
    dispatch = createChatGenerateDispatch(
      access,
      model,
      chatGenerate,
      false, // streaming = false
      false, // enableResumability = false
    );
  } catch (error: any) {
    // Exception during request creation - likely parameter incompatibility with the model/dialect
    return makeResult({
      outcome: 'fail',
      errorCategory: 'dialect',
      errorMessage: error?.message ? String(error.message).slice(0, 300) : String(error).slice(0, 300),
      verboseLogs: [`Exception creating request: ${error?.message || String(error)}`],
      durationMs: Date.now() - startTime,
    });
  }


  try {
    // Execute the request
    const response = await fetchResponseOrTRPCThrow({
      ...dispatch.request,
      name: `Sweep-${sweepDef.name}`,
      throwWithoutName: true,
    });

    // Read response body
    const body = await response.text();

    // Parse response through the vendor's parser using our collector
    const collector = new SweepCollectorTransmitter();
    let parseError: string | null = null;
    try {
      dispatch.chatGenerateParse(collector, body);
    } catch (error) {
      // Parser exceptions are non-fatal for sweep purposes; we still got an HTTP 200
      // But we capture them for verbose logging
      parseError = error instanceof Error ? error.message : String(error);
    }
    // Build verbose logs array
    const verboseLogs: string[] = [];
    if (parseError)
      verboseLogs.push(`Parse error: ${parseError.slice(0, 100)}`);

    // Check for dialect-level issues reported by the parser
    if (collector.hasError) {
      const errorMessage = collector.dialectIssue || 'Unknown dialect issue';
      verboseLogs.push(`Dialect issue: ${errorMessage}`);
      return makeResult({
        outcome: 'fail',
        errorCategory: 'dialect',
        errorMessage,
        verboseLogs,
        durationMs: Date.now() - startTime,
      });
    }

    // Check tokenStopReason for non-ok outcomes
    const stopReason = collector.tokenStopReason;
    const isValidStop = !stopReason || stopReason === 'ok' || stopReason === 'ok-tool_invocations' || stopReason === 'ok-pause_continue';
    const isTruncated = stopReason === 'out-of-tokens';

    const preview = collector.hasText
      ? (collector.text.length > 200 ? collector.text.slice(0, 200) + '...' : collector.text)
      : (body.length > 200 ? body.slice(0, 200) + '...' : body);

    // Check if response matches expected "hi" (the test prompt asks to "just say `hi`")
    const responseNormalized = collector.text.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (collector.hasText && responseNormalized !== 'hi')
      verboseLogs.push(`Unexpected response: "${COLORS.yellow}${collector.text.trim().slice(0, 280)}${COLORS.dim}"`);
    else
      verboseLogs.push(`-> ${preview}`);

    if (isTruncated) {
      return makeResult({
        outcome: 'truncated',
        errorMessage: 'out-of-tokens',
        responseText: collector.text || undefined,
        verboseLogs,
        durationMs: Date.now() - startTime,
      });
    }

    if (!isValidStop) {
      return makeResult({
        outcome: 'fail',
        errorCategory: 'dialect',
        errorMessage: `Unexpected stop reason: ${stopReason}`,
        verboseLogs,
        durationMs: Date.now() - startTime,
      });
    }

    return makeResult({
      outcome: 'pass',
      errorMessage: null,
      responseText: collector.text || undefined,
      verboseLogs,
      durationMs: Date.now() - startTime,
    });

  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    // Structured HTTP/connection error from fetchResponseOrTRPCThrow
    if (error instanceof TRPCFetcherError) {
      const errorMessage = (error.message || '').slice(0, 300);
      // HTTP 503 (Service Unavailable) and 429 (Too Many Requests) are transient:
      // the server is telling us to back off, not that the parameter is unsupported
      const isTransient = error.httpStatus === 503 || error.httpStatus === 429;
      return makeResult({
        outcome: isTransient ? 'blocked' : 'fail',
        httpStatus: error.httpStatus,
        errorCategory: error.category,
        errorMessage,
        verboseLogs: [`[${error.category}${error.httpStatus ? ` ${error.httpStatus}` : ''}] ${errorMessage}`],
        durationMs,
      });
    }

    // Adapter-level error (e.g. parameter incompatibility thrown before fetch)
    const errorMessage = (error?.message || String(error)).slice(0, 300);
    return makeResult({
      outcome: 'error',
      errorCategory: 'exception',
      errorMessage,
      verboseLogs: [`Exception: ${errorMessage}`],
      durationMs,
    });
  }
}


// ============================================================================
// Bisect Sweep Execution
// ============================================================================

async function executeBisectSweep(
  access: AixAPI_Access,
  modelId: string,
  sweepDef: SweepDefinition<SweepValue>,
  maxTokens: number,
  mergedOverrides: Partial<AixAPI_Model> | undefined,
  delay: number,
): Promise<TestResult[]> {
  const precision = sweepDef.bisectPrecision ?? 1;
  let low = sweepDef.values[0] as number;
  let high = sweepDef.values[1] as number;
  const results: TestResult[] = [];

  // Test endpoints first
  const lowResult = await testParameterValue(access, modelId, sweepDef, low, maxTokens, mergedOverrides);
  results.push(lowResult);
  printProbeResultInline(lowResult);
  if (delay > 0) await sleep(delay);

  const highResult = await testParameterValue(access, modelId, sweepDef, high, maxTokens, mergedOverrides);
  results.push(highResult);
  printProbeResultInline(highResult);
  if (delay > 0) await sleep(delay);

  // Binary search for the boundary between pass and fail
  if (lowResult.outcome === 'pass' && highResult.outcome !== 'pass') {
    let lo = low, hi = high;
    while (hi - lo > precision) {
      const mid = Math.round(((lo + hi) / 2) * 1e6) / 1e6;
      const midResult = await testParameterValue(access, modelId, sweepDef, mid, maxTokens, mergedOverrides);
      results.push(midResult);
      printProbeResultInline(midResult);
      if (delay > 0) await sleep(delay);

      if (midResult.outcome === 'pass')
        lo = mid;
      else
        hi = mid;
    }
    console.log(`  ${COLORS.dim}bisect boundary: ~${lo}${COLORS.reset}`);
  } else if (lowResult.outcome !== 'pass' && highResult.outcome === 'pass') {
    let lo = low, hi = high;
    while (hi - lo > precision) {
      const mid = Math.round(((lo + hi) / 2) * 1e6) / 1e6;
      const midResult = await testParameterValue(access, modelId, sweepDef, mid, maxTokens, mergedOverrides);
      results.push(midResult);
      printProbeResultInline(midResult);
      if (delay > 0) await sleep(delay);

      if (midResult.outcome === 'pass')
        hi = mid;
      else
        lo = mid;
    }
    console.log(`  ${COLORS.dim}bisect boundary: ~${hi}${COLORS.reset}`);
  }

  return results;
}


// ============================================================================
// Output Formatting
// ============================================================================

function printProbeResultInline(result: TestResult): void {
  // ✅ pass, ❌ fail (http/rejected), ❓ blocked (503/429 transient), ✂️ truncated (out-of-tokens), ⚠️ error (exception)
  // For null values (undefined in API), use dim ✓ instead of green ✅
  const isUndefined = result.paramValue === null;
  const symbol =
    result.outcome === 'pass' ? (isUndefined ? COLORS.dim + '✓ ' : COLORS.green + '✅ ') :
      result.outcome === 'fail' ? COLORS.red + '❌ ' :
        result.outcome === 'blocked' ? COLORS.yellow + '❓ ' :
          result.outcome === 'truncated' ? COLORS.magenta + '✂️ ' :
            COLORS.yellow + '⚠️ ';
  const displayValue = isUndefined ? '(none)' : String(result.paramValue);
  const statusSuffix = result.httpStatus ? `:${result.httpStatus}` : '';
  process.stdout.write(`${symbol}(${displayValue}${statusSuffix})${COLORS.reset} `);
}

function printSweepSummary(results: VendorSweepResult[]): void {
  const date = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  console.log(`\n${COLORS.bright}${COLORS.cyan}=== SWEEP SUMMARY (${date}) ===${COLORS.reset}\n`);

  for (const vendor of results) {
    console.log(`${COLORS.bright}${vendor.vendorName}${COLORS.reset} (${vendor.dialect})`);

    for (const model of vendor.models) {
      console.log(`  ${COLORS.bright}${model.modelId}${COLORS.reset} ${COLORS.dim}(${model.modelLabel})${COLORS.reset}`);

      // Group results by sweep name
      const bySweep = new Map<string, TestResult[]>();
      for (const r of model.results) {
        if (!bySweep.has(r.sweepName)) bySweep.set(r.sweepName, []);
        bySweep.get(r.sweepName)!.push(r);
      }

      for (const [sweepName, sweepResults] of bySweep) {
        const formatValue = (v: SweepValue) => v === null ? '<null>' : String(v);
        const passed = sweepResults.filter(r => r.outcome === 'pass').map(r => formatValue(r.paramValue));
        const failed = sweepResults.filter(r => r.outcome === 'fail').map(r => formatValue(r.paramValue));
        const blocked = sweepResults.filter(r => r.outcome === 'blocked').map(r => formatValue(r.paramValue));
        const truncated = sweepResults.filter(r => r.outcome === 'truncated').map(r => formatValue(r.paramValue));
        const errored = sweepResults.filter(r => r.outcome === 'error').map(r => formatValue(r.paramValue));

        // Skip sweeps with no passing values and no blocked values (don't clutter output with definitive failures)
        if (passed.length === 0 && blocked.length === 0)
          continue;

        // Check for neutered sweeps (only default/no-op values passed)
        const passingRawValues = sweepResults.filter(r => r.outcome === 'pass').map(r => r.paramValue);
        if (isSweepNeutered(sweepName, passingRawValues)) {
          console.log(`    ${sweepName.padEnd(26)} ${COLORS.dim}~neutered~ [${passed.join(', ')}]${COLORS.reset}`);
          continue;
        }

        const parts: string[] = [];
        // Show passing values
        if (passed.length) parts.push(`${COLORS.green}✅ [${passed.join(', ').replace('0, 0.5, 1, 1.5, 2', '0..2')}]${COLORS.reset}`);
        // Only show other categories if some values passed or blocked (to show which didn't)
        if (truncated.length) parts.push(`${COLORS.magenta}✂️ [${truncated.join(', ')}]${COLORS.reset}`);
        if (blocked.length) parts.push(`${COLORS.yellow}❓ [${blocked.join(', ')}]${COLORS.reset}`);
        if (failed.length) parts.push(`${COLORS.red}❌ [${failed.join(', ')}]${COLORS.reset}`);
        if (errored.length) parts.push(`${COLORS.yellow}⚠️ [${errored.join(', ')}]${COLORS.reset}`);

        console.log(`    ${sweepName.padEnd(26)} ${parts.join(' | ')}`);
      }
    }
    console.log('');
  }
}


// ============================================================================
// Results File (per-dialect: llm-{dialect}-parameters-sweep.json)
// ============================================================================

// Results file format: dialect -> model -> sweep -> passing values
type DialectReultsByModel = Record<string, ModelResultsBySweep>;
type ModelResultsBySweep = Record<string, SweepValue[]>;

function getResultsFilePath(dialect: string): string {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  return path.join(scriptDir, `llm-${dialect}-parameters-sweep.json`);
}

function loadExistingDialectResults(filePath: string): DialectReultsByModel | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    // Strip metadata keys (starting with '_')
    const results: DialectReultsByModel = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key.startsWith('_') && typeof value === 'object' && value !== null)
        results[key] = value as ModelResultsBySweep;
    }
    return results;
  } catch {
    return null;
  }
}

function saveDialectResults(dialect: string, dialectResults: DialectReultsByModel, evaluatedSweeps: string[], modelFilter?: string, mergeModels?: boolean): void {
  const filePath = getResultsFilePath(dialect);

  // When --merge-models, shallow-merge new model entries into existing file
  if (mergeModels) {
    const existing = loadExistingDialectResults(filePath);
    if (existing) {
      const newModelIds = Object.keys(dialectResults);
      const updatedCount = newModelIds.filter(id => id in existing).length;
      const addedCount = newModelIds.length - updatedCount;
      // Shallow merge: new models overwrite, existing models are preserved
      dialectResults = { ...existing, ...dialectResults };
      console.log(`${COLORS.dim}Merging into existing file (${Object.keys(existing).length} existing, ${updatedCount} updated, ${addedCount} added -> ${Object.keys(dialectResults).length} total)${COLORS.reset}`);
    }
  }

  // Sort keys for stable output
  const sorted: DialectReultsByModel = {};
  for (const model of Object.keys(dialectResults).sort()) {
    sorted[model] = {};
    for (const sweep of Object.keys(dialectResults[model]).sort()) {
      sorted[model][sweep] = dialectResults[model][sweep];
    }
  }
  // Custom JSON formatting: keep value arrays on single lines
  const placeholder = '___ARRAY___';
  const arrays: string[] = [];
  const withPlaceholders = JSON.stringify(sorted, (_, value) => {
    // Collapse arrays of primitives (typeof null === 'object', so check explicitly)
    if (Array.isArray(value) && (value.length === 0 || value[0] === null || typeof value[0] !== 'object')) {
      arrays.push(JSON.stringify(value));
      return placeholder + (arrays.length - 1);
    }
    return value;
  }, 2);
  const jsonBody = withPlaceholders.replace(/"___ARRAY___(\d+)"/g, (_, idx) => arrays[parseInt(idx)]);
  // Insert header comments after opening brace
  const comment1 = '"_comment": "API-validated parameter values. null=undefined/missing. Values are tested and working. Note: temperature is continuous, not discrete.",';
  const comment2 = `"_evaluated": "Evaluated: ${evaluatedSweeps.sort().join(', ')}. If missing, the parameter is not supported by that model.",`;
  const comment3 = modelFilter ? `"_modelFilter": "${modelFilter}",` : '';
  const comments = [comment1, comment2, comment3].filter(Boolean).join('\n  ');
  const json = jsonBody.replace(/^\{\n {2}/, '{\n  ' + comments + '\n  ');
  fs.writeFileSync(filePath, json + '\n', 'utf-8');
  console.log(`${COLORS.dim}Results saved to: ${filePath}${COLORS.reset}`);
}

function vendorResultToDialectResults(vendorResult: VendorSweepResult): DialectReultsByModel {
  const dialectResults: DialectReultsByModel = {};

  for (const model of vendorResult.models) {
    const modelResults: ModelResultsBySweep = {};

    // Group results by sweep name
    const bySweep = new Map<string, TestResult[]>();
    for (const r of model.results) {
      if (!bySweep.has(r.sweepName)) bySweep.set(r.sweepName, []);
      bySweep.get(r.sweepName)!.push(r);
    }

    // Sweeps that become "tools" when fully supported
    const toolSweeps = ['oai-image-generation', 'oai-web-search'];
    const tools: string[] = [];
    const xaiToolSweeps = ['xai-web-search'];
    const xaiTools: string[] = [];

    // Extract passing values for each sweep (skip if none passed)
    for (const [sweepName, sweepResults] of bySweep) {
      const passingValues = sweepResults
        .filter(r => r.outcome === 'pass')
        .map(r => r.paramValue);
      if (passingValues.length === 0)
        continue;

      // Skip neutered sweeps (only default/no-op values passed)
      if (isSweepNeutered(sweepName, passingValues))
        continue;

      // Special case: tool sweeps with full support -> add to tools array
      if (toolSweeps.includes(sweepName) && passingValues.length === sweepResults.length) {
        tools.push(sweepName);
        continue;
      }
      if (xaiToolSweeps.includes(sweepName) && passingValues.length === sweepResults.length) {
        xaiTools.push(sweepName);
        continue;
      }

      // Special case: temperature with contiguous range from 0 -> use range [min, max]
      if (sweepName === 'temperature') {
        const numericPassing = passingValues.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
        const numericTested = sweepResults.map(r => r.paramValue).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
        // Check if passing values form a contiguous prefix of tested values (no gaps)
        const isContiguousFromStart = numericPassing.length >= 2 &&
          numericPassing.every((v, i) => v === numericTested[i]);
        if (isContiguousFromStart) {
          modelResults['temperature-range'] = [numericPassing[0], numericPassing[numericPassing.length - 1]];
          continue;
        }
      }

      modelResults[sweepName] = passingValues;
    }

    // Add tools array if non-empty
    if (tools.length > 0)
      modelResults['tools'] = tools.sort();
    if (xaiTools.length > 0)
      modelResults['xai-tools'] = xaiTools.sort();

    dialectResults[model.modelId] = modelResults;
  }

  return dialectResults;
}

function saveAllResults(allResults: VendorSweepResult[], mergeModels?: boolean): void {
  for (const vendorResult of allResults) {
    if (vendorResult.models.length === 0) continue;
    // Collect all evaluated sweep names for this dialect
    const evaluatedSweeps = new Set<string>();
    for (const model of vendorResult.models) {
      for (const result of model.results) {
        evaluatedSweeps.add(result.sweepName);
      }
    }
    const dialectResults = vendorResultToDialectResults(vendorResult);
    saveDialectResults(vendorResult.dialect, dialectResults, [...evaluatedSweeps], vendorResult.modelFilter, mergeModels);
  }
}


// ============================================================================
// Config Loading
// ============================================================================

function loadSweepConfig(configPath: string): SweepConfigFile {
  const fullPath = path.resolve(configPath);
  if (!fs.existsSync(fullPath))
    throw new Error(`Configuration file not found: ${fullPath}`);

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Support both old format (flat Record<string, AixAPI_Access>) and new format (SweepConfig)
    if (parsed.vendors) {
      return parsed as SweepConfigFile;
    }

    // Legacy: flat Record<string, AixAPI_Access>
    const vendors: Record<string, SweepConfigFile_Vendor> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('_')) continue;
      if (typeof value === 'object' && value !== null && 'dialect' in value)
        vendors[key] = { access: value as AixAPI_Access };
    }
    return { vendors };
  } catch (error: any) {
    throw new Error(`Failed to parse configuration: ${error.message}`);
  }
}

function createSingleVendorConfig(dialect: string, key: string, host?: string): SweepConfigFile {
  let access: AixAPI_Access;

  switch (dialect) {
    case 'openai':
    case 'alibaba':
    case 'azure':
    case 'deepseek':
    case 'groq':
    case 'lmstudio':
    case 'localai':
    case 'mistral':
    case 'moonshot':
    case 'openpipe':
    case 'openrouter':
    case 'perplexity':
    case 'togetherai':
    case 'xai':
      access = {
        dialect: dialect as any,
        oaiKey: key,
        oaiOrg: '',
        oaiHost: host || '',
        heliKey: '',
      } as any;
      break;

    case 'anthropic':
      access = {
        dialect: 'anthropic',
        anthropicKey: key,
        anthropicHost: host || null,
        heliconeKey: null,
      } as any;
      break;

    case 'gemini':
      access = {
        dialect: 'gemini',
        geminiKey: key,
        geminiHost: host || '',
        minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
      } as any;
      break;

    case 'ollama':
      access = {
        dialect: 'ollama',
        ollamaHost: host || 'http://127.0.0.1:11434',
      } as any;
      break;

    default:
      throw new Error(`Unsupported dialect: ${dialect}`);
  }

  return { vendors: { [dialect]: { access } } };
}


// ============================================================================
// CLI Argument Parsing
// ============================================================================

function printUsage(): void {
  console.log(`
${COLORS.bright}LLM Parameter Sweep Tool${COLORS.reset}

Tests which parameter values are accepted by LLM vendor APIs.

${COLORS.bright}Usage:${COLORS.reset}
  sweep.ts --config <path>                  Use JSON config file
  sweep.ts --dialect <name> --key <key>     Test a single vendor

${COLORS.bright}Options:${COLORS.reset}
  --config <path>       JSON config file (SweepConfig or Record<string, AixAPI_Access>)
  --dialect <name>      Vendor dialect (openai, anthropic, gemini, xai, openrouter, ...)
  --key <key>           API key for single vendor
  --host <url>          Custom host for single vendor
  --model-filter <re>   Regex to filter model IDs
  --sweep-filter <csv>  Comma-separated sweep names to run
  --delay <ms>          Delay between sweeps (default: 1000). In --sequential mode, delay between values.
  --max-models <n>      Max models to test per vendor (default: 100)
  --sequential          Run value tests sequentially (default: parallel)
  --merge-models        Merge new models into existing JSON file (default: overwrite)
  --verbose             Show detailed log messages below each sweep line
  --debug               Print request body before each probe
  --include-symlinks    Include symlink models (excluded by default)
  --dry-run             Print what would be tested without sending requests
  --help                Show this help

${COLORS.bright}Config file format (SweepConfig):${COLORS.reset}
  {
    "delayMs": 1000,
    "maxTokens": 128,
    "vendors": {
      "openai": {
        "access": { "dialect": "openai", "oaiKey": "sk-...", "oaiOrg": "", "oaiHost": "", "heliKey": "" },
        "sweeps": ["temperature", "oai-reasoning-effort", "oai-verbosity"],
        "modelFilter": "gpt-4o",
        "baseModelOverrides": {}
      }
    }
  }

  Sweeps are referenced by name from the built-in definitions (see below).
  If "sweeps" is omitted, all applicable sweeps for the dialect are run.

${COLORS.bright}Available built-in sweeps:${COLORS.reset}
${SWEEP_DEFINITIONS.map(s => {
    const dialects = s.applicability.type === 'all'
      ? `${COLORS.green}all${COLORS.reset}`
      : s.applicability.dialects.map(d => `${COLORS.magenta}${d}${COLORS.reset}`).join(', ');
    return `  ${COLORS.cyan}${s.name.padEnd(26)}${COLORS.reset} ${s.description} [${dialects}]`;
  }).join('\n')}

${COLORS.bright}Examples:${COLORS.reset}
  # Test temperature on a single OpenAI model
  sweep.sh --dialect openai --key sk-... --model-filter "gpt-4o-mini" --max-models 1 --sweep-filter temperature

  # Full sweep on Gemini
  sweep.sh --dialect gemini --key ... --model-filter "gemini-2" --max-models 2

  # Dry run (no API calls)
  sweep.sh --dialect openai --key sk-... --dry-run

  # Multi-vendor via config file with custom sweeps
  sweep.sh --config ./sweep-config.json --sweep-filter temperature,oai-reasoning-effort
`);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    delay: 1000,
    maxModels: 100,
    verbose: false,
    debug: false,
    includeSymlinks: false,
    dryRun: false,
    sequential: false,
    mergeModels: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--config':
      case '-c':
        options.config = args[++i];
        break;
      case '--dialect':
      case '-d':
        options.dialect = args[++i];
        break;
      case '--key':
        options.key = args[++i];
        break;
      case '--host':
        options.host = args[++i];
        break;
      case '--model-filter':
      case '-m':
        options.modelFilter = args[++i];
        break;
      case '--sweep-filter':
        options.sweepFilter = args[++i];
        break;
      case '--delay':
        options.delay = parseInt(args[++i], 10);
        break;
      case '--max-models':
        options.maxModels = parseInt(args[++i], 10);
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--include-symlinks':
        options.includeSymlinks = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--sequential':
        options.sequential = true;
        break;
      case '--merge-models':
        options.mergeModels = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`${COLORS.red}Unknown argument: ${arg}${COLORS.reset}`);
        process.exit(1);
    }
  }

  // Auto-detect sweep-config.json when no explicit config and no standalone dialect+key
  if (!options.config && !(options.dialect && options.key)) {
    const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
    const defaultConfig = path.join(scriptDir, 'sweep-config.json');
    if (fs.existsSync(defaultConfig)) {
      options.config = defaultConfig;
      console.log(`${COLORS.dim}Auto-detected config: ${defaultConfig}${COLORS.reset}`);
    } else {
      console.error(`${COLORS.red}Error: Either --config/-c or (--dialect/-d and --key) required${COLORS.reset}`);
      printUsage();
      process.exit(1);
    }
  }

  return options;
}


// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}


// ============================================================================
// Main Sweep Loop
// ============================================================================

async function runSweep(
  sweepConfig: SweepConfigFile,
  options: CliOptions,
): Promise<VendorSweepResult[]> {
  const allResults: VendorSweepResult[] = [];
  const maxTokens = sweepConfig.maxTokens ?? 128;
  const globalDelay = sweepConfig.delayMs ?? options.delay;

  for (const [vendorName, vendorConfig] of Object.entries(sweepConfig.vendors)) {
    const access = vendorConfig.access;

    // Filter by --dialect CLI arg
    if (options.dialect && access.dialect !== options.dialect)
      continue;

    console.log(`\n${COLORS.bright}${COLORS.cyan}=== ${vendorName.toUpperCase()} (${access.dialect}) ===${COLORS.reset}\n`);

    // 1. List models for this vendor
    let models: ModelDescriptionSchema[];
    try {
      models = await listModelsRunDispatch(access);
      // print first...last
      console.log(`  Found ${COLORS.bright}${models.length}${COLORS.reset} models: ${models.length > 2 ? models[0].id + ' ... ' + models[models.length - 1].id : models.map(m => m.id).join(', ')}`);
    } catch (error: any) {
      console.log(`  ${COLORS.red}Failed to list models: ${error.message}${COLORS.reset}`);
      continue;
    }

    if (models.length === 0) {
      console.log(`  ${COLORS.yellow}No models found, skipping${COLORS.reset}`);
      continue;
    }

    // 2. Filter out symlink models (unless --include-symlinks)
    if (!options.includeSymlinks) {
      const beforeCount = models.length;
      models = models.filter(m => !m.label.includes('🔗'));
      if (models.length < beforeCount)
        console.log(`  Excluded ${beforeCount - models.length} symlink models`);
    }

    // 2b. Filter out duplicate models with idVariant (keep base model, or first variant if no base)
    {
      // const beforeCount = models.length;
      // Sort so base models (no idVariant) come before variants
      models.sort((a, b) => (a.idVariant ? 1 : 0) - (b.idVariant ? 1 : 0));
      const seenIds = new Set<string>();
      const excludedVariants: string[] = [];
      models = models.filter(m => {
        if (seenIds.has(m.id)) {
          if (m.idVariant) excludedVariants.push(`${m.id}::${m.idVariant}`);
          return false;
        }
        seenIds.add(m.id);
        return true;
      });
      if (excludedVariants.length > 0)
        console.log(`  Excluded ${excludedVariants.length} variant models: ${COLORS.dim}${excludedVariants.join(', ')}${COLORS.reset}`);
    }

    // 3. Filter models by: vendor config modelFilter (prefix match), then CLI --model-filter (regex)
    const vendorModelFilter = vendorConfig.modelFilter;
    if (vendorModelFilter) {
      const prefixes = Array.isArray(vendorModelFilter) ? vendorModelFilter : [vendorModelFilter];
      models = models.filter(m => prefixes.some(p => m.id.startsWith(p)));
      console.log(`  Vendor filter [${prefixes.join(', ')}] -> ${COLORS.bright}${models.length}${COLORS.reset} models`);
    }

    if (options.modelFilter) {
      const re = new RegExp(options.modelFilter, 'i');
      models = models.filter(m => re.test(m.id) || re.test(m.label));
      console.log(`  CLI filter "${options.modelFilter}" -> ${COLORS.bright}${models.length}${COLORS.reset} models`);
    }

    // 4. Cap to maxModels
    if (models.length > options.maxModels) {
      models = models.slice(0, options.maxModels);
      console.log(`  Capped to first ${options.maxModels} models`);
    }

    // 5. Determine applicable sweeps (always from SWEEP_DEFINITIONS)
    let applicableSweeps: SweepDefinition<any>[];
    if (vendorConfig.sweeps && vendorConfig.sweeps.length > 0) {
      // Use named sweeps from config, looked up in SWEEP_DEFINITIONS
      applicableSweeps = [];
      for (const sweepName of vendorConfig.sweeps) {
        const sweep = SWEEP_DEFINITIONS.find(s => s.name === sweepName);
        if (sweep)
          applicableSweeps.push(sweep);
        else
          console.warn(`  ${COLORS.yellow}Warning: Unknown sweep "${sweepName}" - skipping${COLORS.reset}`);
      }
    } else {
      // Use built-in sweeps filtered by dialect
      applicableSweeps = SWEEP_DEFINITIONS.filter(s => {
        if (s.applicability.type === 'all') return true;
        return s.applicability.dialects.includes(access.dialect);
      });
    }

    // Further filter by --sweep-filter CLI arg
    if (options.sweepFilter) {
      const allowed = options.sweepFilter.split(',').map(x => x.trim());
      applicableSweeps = applicableSweeps.filter(s => allowed.includes(s.name));
    }

    if (applicableSweeps.length === 0) {
      console.log(`  ${COLORS.yellow}No applicable sweeps for dialect: ${access.dialect}${COLORS.reset}`);
      continue;
    }
    console.log(`  Applicable sweeps: ${applicableSweeps.map(s => COLORS.magenta + s.name + COLORS.reset).join(', ')}`);

    // Build effective model filter string for JSON output
    const effectiveFilters: string[] = [];
    if (vendorModelFilter) {
      const prefixes = Array.isArray(vendorModelFilter) ? vendorModelFilter : [vendorModelFilter];
      effectiveFilters.push(...prefixes);
    }
    if (options.modelFilter)
      effectiveFilters.push(options.modelFilter);

    const vendorResult: VendorSweepResult = {
      vendorName,
      dialect: access.dialect,
      modelsAvailable: models.length,
      modelsTested: models.length,
      models: [],
      modelFilter: effectiveFilters.length > 0 ? effectiveFilters.join(', ') : undefined,
    };

    // 5. For each model
    const totalModels = models.length;
    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
      const modelDesc = models[modelIndex];
      // Derive API routing overrides from the model's interfaces and ID
      const interfaceOverrides = modelOverridesFromInterfaces(modelDesc.interfaces);
      const idOverrides = modelOverridesFromId(modelDesc.id, access.dialect);
      const mergedOverrides: Partial<AixAPI_Model> = { ...interfaceOverrides, ...idOverrides, ...vendorConfig.baseModelOverrides };

      const apiTag = interfaceOverrides.vndOaiResponsesAPI ? 'OAI-Responses' : `${access.dialect}-chat`;
      const tempTag = interfaceOverrides.temperature === null ? ', no-temp' : '';
      const progressTag = `${modelIndex + 1}/${totalModels}`;
      console.log(`\n  ${COLORS.dim}[${progressTag}]${COLORS.reset} ${COLORS.bright}${COLORS.yellow}Model: ${modelDesc.id}${COLORS.reset} ${COLORS.dim}(${modelDesc.label}) [${apiTag}${tempTag}]${COLORS.reset}`);

      const modelResult: ModelSweepResult = {
        modelId: modelDesc.id,
        modelLabel: modelDesc.label,
        results: [],
      };

      // 6. For each applicable sweep
      for (const sweep of applicableSweeps) {
        process.stdout.write(`    ${sweep.name.padEnd(26)} `);

        const sweepResults: TestResult[] = [];

        if (sweep.mode === 'bisect') {
          // Binary search mode
          if (options.dryRun) {
            process.stdout.write(`${COLORS.dim}[bisect ${sweep.values[0]}..${sweep.values[1]}]${COLORS.reset}`);
          } else {
            const bisectResults = await executeBisectSweep(
              access, modelDesc.id, sweep, maxTokens, mergedOverrides,
              globalDelay,
            );
            sweepResults.push(...bisectResults);
          }
        } else {
          // 7. Enumerate mode: test each value in the sweep
          if (options.dryRun) {
            for (const value of sweep.values)
              process.stdout.write(`${COLORS.dim}[${String(value)}]${COLORS.reset} `);
          } else if (options.sequential) {
            // Sequential: test one value at a time with delay between values
            for (const value of sweep.values) {
              const result = await testParameterValue(access, modelDesc.id, sweep, value, maxTokens, mergedOverrides);
              sweepResults.push(result);
              printProbeResultInline(result);
              if (globalDelay > 0)
                await sleep(globalDelay);
            }
          } else {
            // Parallel (default): fire all requests at once, print results in order
            const sweepStartTime = Date.now();
            const results = await Promise.all(
              sweep.values.map(value =>
                testParameterValue(access, modelDesc.id, sweep, value, maxTokens, mergedOverrides),
              ),
            );
            const sweepElapsed = Date.now() - sweepStartTime;
            for (const result of results) {
              sweepResults.push(result);
              printProbeResultInline(result);
            }
            // Delay between sweeps only if elapsed < 2x delay (skip if requests already took long enough)
            if (globalDelay > 0 && sweepElapsed < globalDelay * 2) {
              const remainingDelay = Math.max(0, globalDelay - sweepElapsed);
              if (remainingDelay > 0)
                await sleep(remainingDelay);
            }
          }
        }

        modelResult.results.push(...sweepResults);
        console.log(''); // newline after sweep line

        // Debug/Verbose: print request bodies and log messages (responses/errors)
        if (options.debug || options.verbose)
          for (const r of sweepResults) {
            const printRequest = options.debug && r.debugRequestBody;
            const printLogs = options.verbose && r.verboseLogs.length > 0;
            const mayDim = r.outcome === 'pass' ? COLORS.dim : '';
            if (!printRequest && !printLogs)
              continue;
            process.stdout.write(`      ${mayDim}(${String(r.paramValue)})`);
            // NOTE: uncomment this to see the AixAPI_Model object being passed to the dispatcher
            // if (printRequest && r.debugRequestAixModel)
            //   process.stdout.write(` -> ${r.debugRequestAixModel}${COLORS.reset}\n      ${mayDim}    `);
            if (printRequest || (r.outcome !== 'pass' && r.debugRequestBody))
              process.stdout.write(` -> ${r.debugRequestBody}${COLORS.reset}\n      ${mayDim}    `);
            process.stdout.write(`${COLORS.cyan}${r.verboseLogs.join(' · ').trim()/*.replaceAll('\n',' · ')*/}${COLORS.reset}\n`);
          }

      }

      vendorResult.models.push(modelResult);
    }

    allResults.push(vendorResult);
  }

  return allResults;
}


// ============================================================================
// Entry Point
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  // Load vendor config
  let sweepConfig: SweepConfigFile;
  if (options.config) {
    sweepConfig = loadSweepConfig(options.config);
  } else {
    sweepConfig = createSingleVendorConfig(options.dialect!, options.key!, options.host);
  }

  // Header
  const execMode = options.sequential ? 'sequential' : 'parallel';
  const delayDesc = options.sequential ? 'delay between values' : 'delay between sweeps';
  console.log(`${COLORS.bright}LLM Parameter Sweep Tool${COLORS.reset}`);
  console.log(`${COLORS.dim}Vendors: ${Object.keys(sweepConfig.vendors).join(', ')}${COLORS.reset}`);
  console.log(`${COLORS.dim}Mode: ${execMode} | ${delayDesc}: ${sweepConfig.delayMs ?? options.delay}ms | Max models/vendor: ${options.maxModels}${COLORS.reset}`);
  if (options.modelFilter) console.log(`${COLORS.dim}Model filter: ${options.modelFilter}${COLORS.reset}`);
  if (options.sweepFilter) console.log(`${COLORS.dim}Sweep filter: ${options.sweepFilter}${COLORS.reset}`);
  if (options.mergeModels) console.log(`${COLORS.dim}Merge mode: new models will be merged into existing JSON files${COLORS.reset}`);
  if (options.dryRun) console.log(`${COLORS.yellow}DRY RUN - no requests will be sent${COLORS.reset}`);

  // Run sweeps
  const results = await runSweep(sweepConfig, options);

  // Filter out models where all sweeps failed (no passing values)
  const excludedModels: string[] = [];
  for (const vendor of results) {
    vendor.models = vendor.models.filter(model => {
      const hasAnyPass = model.results.some(r => r.outcome === 'pass');
      if (!hasAnyPass) excludedModels.push(model.modelId);
      return hasAnyPass;
    });
  }
  if (excludedModels.length > 0) {
    console.log(`\n${COLORS.yellow}Excluded ${excludedModels.length} model(s) with no passing values:${COLORS.reset}`);
    console.log(`  ${COLORS.dim}${excludedModels.join(', ')}${COLORS.reset}`);
  }

  // Summary and save results
  if (!options.dryRun && results.some(v => v.models.length > 0)) {
    printSweepSummary(results);
    saveAllResults(results, options.mergeModels);
  }

  console.log(`${COLORS.dim}Done.${COLORS.reset}`);
}

main().catch((error) => {
  console.error(`${COLORS.red}Fatal error: ${error.message}${COLORS.reset}`);
  if (error.stack) console.error(`${COLORS.dim}${error.stack}${COLORS.reset}`);
  process.exit(1);
});
