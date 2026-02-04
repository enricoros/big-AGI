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
import type { IParticleTransmitter, ParticleServerLogLevel } from '~/modules/aix/server/dispatch/chatGenerate/parsers/IParticleTransmitter';
import type { ModelDescriptionSchema } from '~/modules/llms/server/llm.server.types';
import { listModelsRunDispatch } from '~/modules/llms/server/listModels.dispatch';
import { createChatGenerateDispatch } from '~/modules/aix/server/dispatch/chatGenerate/chatGenerate.dispatch';
import { fetchResponseOrTRPCThrow, TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';


// ============================================================================
// Terminal Colors
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


// ============================================================================
// Types
// ============================================================================

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
}

type SweepValue = string | number | boolean | null;

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
}

function defineSweep<const TValue>(definition: SweepDefinition<TValue>) {
  return definition;
}

// Config-file based sweep definition (JSON-friendly, no functions)
type ConfigSweepDefinition =
  | { type: 'enum'; param: string; values: unknown[] }
  | { type: 'range'; param: string; min: number; max: number; step: number }
  | { type: 'bisect'; param: string; low: number; high: number; precision: number };

interface VendorSweepConfig {
  access: AixAPI_Access;
  sweeps?: ConfigSweepDefinition[];
  modelFilter?: string | string[];  // prefix(es) to match model IDs
  baseModelOverrides?: Partial<AixAPI_Model>;
}

interface SweepConfig {
  delayMs?: number;
  maxTokens?: number;
  vendors: Record<string, VendorSweepConfig>;
}

type ErrorCategory =
  | 'exception' // exception testing the parameter
  | 'dialect'   // parsing fails
  | 'abort' | 'connection' | 'http' | 'parse'; // tRPC errors

type TestOutcome = 'pass' | 'fail' | 'truncated' | 'error';

interface TestResult {
  sweepName: string;
  paramValue: SweepValue;
  outcome: TestOutcome;
  errorMessage: string | null; // source of truth for non-pass outcomes (always set when outcome !== 'pass')
  errorCategory?: ErrorCategory; // secondary, used for symbol display
  httpStatus?: number;
  responseText?: string;
  verboseLogs: string[];       // --verbose: response/error details
  debugRequestBody?: string;   // --debug: request body JSON
  durationMs: number;
}

interface ModelSweepResult {
  modelId: string;
  modelLabel: string;
  results: TestResult[];
}

interface VendorSweepResult {
  vendorName: string;
  dialect: AixAPI_Access['dialect'];
  modelsAvailable: number;
  modelsTested: number;
  models: ModelSweepResult[];
}


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
  setEnded(reason: 'done-dialect' | 'issue-dialect'): void {
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
  setUpstreamHandle(_handle: string, _type: 'oai-responses'): void { /* no-op */ }
  setTokenStopReason(reason: AixWire_Particles.GCTokenStopReason): void { this.tokenStopReason = reason; }
  updateMetrics(_update: Partial<AixWire_Particles.CGSelectMetrics>): void { /* no-op */ }
}


// ============================================================================
// Built-in Sweep Definitions
// ============================================================================

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
    applyToModel: (value) => ({ vndOaiReasoningEffort: value }),
    values: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] satisfies AixAPI_Model['vndOaiReasoningEffort'][],
    mode: 'enumerate',
  }),

  // OpenAI: verbosity (Responses API)
  defineSweep({
    name: 'oai-verbosity',
    description: 'OpenAI text.verbosity values (Responses API)',
    applicability: { type: 'dialects', dialects: ['openai', 'openrouter'] },
    applyToModel: (value) => ({
      vndOaiVerbosity: value,
      vndOaiResponsesAPI: true,
    }),
    values: ['low', 'medium', 'high'] satisfies AixAPI_Model['vndOaiVerbosity'][],
    mode: 'enumerate',
  }),

  // OpenAI: reasoning summary (Responses API)
  defineSweep({
    name: 'oai-reasoning-summary',
    description: 'OpenAI reasoning.summary values (Responses API)',
    applicability: { type: 'dialects', dialects: ['openai'] },
    applyToModel: (value) => ({
      vndOaiReasoningSummary: value,
      vndOaiResponsesAPI: true,
    }),
    values: ['none', 'detailed'] satisfies AixAPI_Model['vndOaiReasoningSummary'][],
    mode: 'enumerate',
  }),

  // Anthropic: effort
  defineSweep({
    name: 'ant-effort',
    description: 'Anthropic output_config.effort values',
    applicability: { type: 'dialects', dialects: ['anthropic'] },
    applyToModel: (value) => ({ vndAntEffort: value}),
    values: ['low', 'medium', 'high'] satisfies AixAPI_Model['vndAntEffort'][],
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
    values: [0, 1024, 4096, 8192, 16000],
    mode: 'enumerate',
  }),

  // Gemini: thinking level (Gemini 3.x)
  defineSweep({
    name: 'gemini-thinking-level',
    description: 'Gemini thinkingConfig.thinkingLevel values',
    applicability: { type: 'dialects', dialects: ['gemini'] },
    applyToModel: (value) => ({
      vndGeminiThinkingLevel: value,
      vndGeminiShowThoughts: true,
    }),
    values: ['minimal', 'low', 'medium', 'high'] satisfies AixAPI_Model['vndGeminiThinkingLevel'][],
    mode: 'enumerate',
  }),

  // Gemini: thinking budget (Gemini 2.x)
  defineSweep({
    name: 'gemini-thinking-budget',
    description: 'Gemini thinkingConfig.thinkingBudget boundaries',
    applicability: { type: 'dialects', dialects: ['gemini'] },
    applyToModel: (value) => ({
      vndGeminiThinkingBudget: value,
    }),
    values: [0, 1024, 4096, 8192, 16384],
    mode: 'enumerate',
  }),

  // xAI: reasoning effort (Responses API)
  defineSweep({
    name: 'xai-reasoning-effort',
    description: 'xAI reasoning.effort values',
    applicability: { type: 'dialects', dialects: ['xai'] },
    applyToModel: (value) => ({ vndOaiReasoningEffort: value }),
    values: ['low', 'medium', 'high'] satisfies AixAPI_Model['vndOaiReasoningEffort'][],
    mode: 'enumerate',
  }),

] as const satisfies SweepDefinition<any>[];


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

/** Derive AixAPI_Model overrides from the model's interfaces array */
function modelOverridesFromInterfaces(interfaces: string[]): Partial<AixAPI_Model> {
  const overrides: Partial<AixAPI_Model> = {};
  if (interfaces.includes('oai-responses'))
    overrides.vndOaiResponsesAPI = true;
  if (interfaces.includes('hotfix-no-temperature'))
    overrides.temperature = null;
  return overrides;
}


// ============================================================================
// Config Sweep -> Runtime Sweep Conversion
// ============================================================================

function configSweepToDefinition(configSweep: ConfigSweepDefinition): SweepDefinition<SweepValue> {
  const param = configSweep.param;

  switch (configSweep.type) {
    case 'enum':
      return defineSweep({
        name: param,
        description: `Config sweep: ${param} enum`,
        applicability: { type: 'all' },
        applyToModel: (value) => ({ [param]: value }) as Partial<AixAPI_Model>,
        values: configSweep.values as SweepValue[],
        mode: 'enumerate',
      });

    case 'range': {
      const values: SweepValue[] = [];
      for (let v = configSweep.min; v <= configSweep.max + configSweep.step / 2; v += configSweep.step)
        values.push(Math.round(v * 1e6) / 1e6); // avoid float drift
      return defineSweep({
        name: param,
        description: `Config sweep: ${param} range [${configSweep.min}..${configSweep.max}]`,
        applicability: { type: 'all' },
        applyToModel: (value) => ({ [param]: value }) as Partial<AixAPI_Model>,
        values,
        mode: 'enumerate',
      });
    }

    case 'bisect':
      return defineSweep({
        name: param,
        description: `Config sweep: ${param} bisect [${configSweep.low}..${configSweep.high}]`,
        applicability: { type: 'all' },
        applyToModel: (value) => ({ [param]: value }) as Partial<AixAPI_Model>,
        values: [configSweep.low, configSweep.high] as SweepValue[], // initial endpoints; binary search fills in
        mode: 'bisect',
        bisectPrecision: configSweep.precision,
      });
  }
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
  debug: boolean = false,
): Promise<TestResult> {
  const startTime = Date.now();
  const baseModel = createBaseModel(modelId, maxTokens);
  const modelOverrides = sweepDef.applyToModel(value);
  const model: AixAPI_Model = { ...baseModel, ...baseModelOverrides, ...modelOverrides };
  const chatGenerate = createMinimalChatRequest();

  // Build vendor-specific HTTP request via the AIX dispatch system
  const dispatch = createChatGenerateDispatch(
    access,
    model,
    chatGenerate,
    false, // streaming = false
    false, // enableResumability = false
  );

  // Capture request body for --debug output
  const debugRequestBody = 'body' in dispatch.request
    ? JSON.stringify(dispatch.request.body) //, null, 2)
    : undefined;

  // Helper to build result with common fields
  const makeResult = (fields: Omit<TestResult, 'sweepName' | 'paramValue' | 'debugRequestBody'>): TestResult => ({
    sweepName: sweepDef.name,
    paramValue: value,
    debugRequestBody,
    ...fields,
  });

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
      return makeResult({
        outcome: 'fail',
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
  // ✅ pass, ❌ fail (http/rejected), ✂️ truncated (out-of-tokens), ⚠️ error (exception)
  const symbol =
    result.outcome === 'pass' ? COLORS.green + '✅ ' :
      result.outcome === 'fail' ? COLORS.red + '❌ ' :
        result.outcome === 'truncated' ? COLORS.magenta + '✂️ ' :
          COLORS.yellow + '⚠️ ';
  const statusSuffix = result.httpStatus ? `:${result.httpStatus}` : '';
  process.stdout.write(`${symbol}(${String(result.paramValue)}${statusSuffix})${COLORS.reset} `);
}

function printSweepSummary(results: VendorSweepResult[]): void {
  console.log(`\n${COLORS.bright}${COLORS.cyan}=== SWEEP SUMMARY ===${COLORS.reset}\n`);

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
        const passed = sweepResults.filter(r => r.outcome === 'pass').map(r => String(r.paramValue));
        const failed = sweepResults.filter(r => r.outcome === 'fail').map(r => String(r.paramValue));
        const truncated = sweepResults.filter(r => r.outcome === 'truncated').map(r => String(r.paramValue));
        const errored = sweepResults.filter(r => r.outcome === 'error').map(r => String(r.paramValue));

        const parts: string[] = [];
        if (passed.length) parts.push(`${COLORS.green}✅ [${passed.join(', ')}]${COLORS.reset}`);
        if (truncated.length) parts.push(`${COLORS.magenta}✂️ [${truncated.join(', ')}]${COLORS.reset}`);
        if (failed.length) parts.push(`${COLORS.red}❌ [${failed.join(', ')}]${COLORS.reset}`);
        if (errored.length) parts.push(`${COLORS.yellow}⚠️ [${errored.join(', ')}]${COLORS.reset}`);

        console.log(`    ${sweepName.padEnd(26)} ${parts.join(' | ')}`);
      }
    }
    console.log('');
  }
}


// ============================================================================
// Config Loading
// ============================================================================

function loadSweepConfig(configPath: string): SweepConfig {
  const fullPath = path.resolve(configPath);
  if (!fs.existsSync(fullPath))
    throw new Error(`Configuration file not found: ${fullPath}`);

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Support both old format (flat Record<string, AixAPI_Access>) and new format (SweepConfig)
    if (parsed.vendors) {
      return parsed as SweepConfig;
    }

    // Legacy: flat Record<string, AixAPI_Access>
    const vendors: Record<string, VendorSweepConfig> = {};
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

function createSingleVendorConfig(dialect: string, key: string, host?: string): SweepConfig {
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
        minSafetyLevel: 'BLOCK_NONE',
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
  --delay <ms>          Delay between requests (default: 1000)
  --max-models <n>      Max models to test per vendor (default: 100)
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
        "sweeps": [
          { "type": "enum", "param": "vndOaiReasoningEffort", "values": ["low","medium","high"] },
          { "type": "range", "param": "temperature", "min": 0, "max": 2, "step": 0.5 },
          { "type": "bisect", "param": "temperature", "low": 0, "high": 10, "precision": 0.1 }
        ],
        "modelFilter": "gpt-4o",
        "baseModelOverrides": {}
      }
    }
  }

${COLORS.bright}Available built-in sweeps:${COLORS.reset}
${SWEEP_DEFINITIONS.map(s => {
    const dialects = s.applicability.type === 'all' ? 'all' : s.applicability.dialects.join(', ');
    return `  ${COLORS.cyan}${s.name.padEnd(26)}${COLORS.reset} ${s.description} ${COLORS.dim}[${dialects}]${COLORS.reset}`;
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
  sweepConfig: SweepConfig,
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

    // 5. Determine applicable sweeps
    let applicableSweeps: SweepDefinition<any>[];
    if (vendorConfig.sweeps && vendorConfig.sweeps.length > 0) {
      // Use config-defined sweeps
      applicableSweeps = vendorConfig.sweeps.map(configSweepToDefinition);
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

    const vendorResult: VendorSweepResult = {
      vendorName,
      dialect: access.dialect,
      modelsAvailable: models.length,
      modelsTested: models.length,
      models: [],
    };

    // 5. For each model
    for (const modelDesc of models) {
      // Derive API routing overrides from the model's interfaces (e.g. oai-responses, hotfix-no-temperature)
      const interfaceOverrides = modelOverridesFromInterfaces(modelDesc.interfaces);
      const mergedOverrides: Partial<AixAPI_Model> = { ...interfaceOverrides, ...vendorConfig.baseModelOverrides };

      const apiTag = interfaceOverrides.vndOaiResponsesAPI ? 'responses' : `${access.dialect}-chat`;
      const tempTag = interfaceOverrides.temperature === null ? ', no-temp' : '';
      console.log(`\n  ${COLORS.bright}Model: ${modelDesc.id}${COLORS.reset} ${COLORS.dim}(${modelDesc.label}) [${apiTag}${tempTag}]${COLORS.reset}`);

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
          // 7. Enumerate mode: for each value in the sweep
          for (const value of sweep.values) {
            if (options.dryRun) {
              process.stdout.write(`${COLORS.dim}[${String(value)}]${COLORS.reset} `);
              continue;
            }

            const result = await testParameterValue(access, modelDesc.id, sweep, value, maxTokens, mergedOverrides);
            sweepResults.push(result);
            printProbeResultInline(result);

            // Delay between requests
            if (globalDelay > 0)
              await sleep(globalDelay);
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
            if (printRequest)
              process.stdout.write(` -> ${r.debugRequestBody}${COLORS.reset}\n      ${mayDim}    `);
            process.stdout.write(`${COLORS.cyan}${r.verboseLogs.join(' · ')}${COLORS.reset}\n`);
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
  let sweepConfig: SweepConfig;
  if (options.config) {
    sweepConfig = loadSweepConfig(options.config);
  } else {
    sweepConfig = createSingleVendorConfig(options.dialect!, options.key!, options.host);
  }

  // Header
  console.log(`${COLORS.bright}LLM Parameter Sweep Tool${COLORS.reset}`);
  console.log(`${COLORS.dim}Vendors: ${Object.keys(sweepConfig.vendors).join(', ')}${COLORS.reset}`);
  console.log(`${COLORS.dim}Delay: ${sweepConfig.delayMs ?? options.delay}ms | Max models/vendor: ${options.maxModels}${COLORS.reset}`);
  if (options.modelFilter) console.log(`${COLORS.dim}Model filter: ${options.modelFilter}${COLORS.reset}`);
  if (options.sweepFilter) console.log(`${COLORS.dim}Sweep filter: ${options.sweepFilter}${COLORS.reset}`);
  if (options.dryRun) console.log(`${COLORS.yellow}DRY RUN - no requests will be sent${COLORS.reset}`);

  // Run sweeps
  const results = await runSweep(sweepConfig, options);

  // Summary
  if (!options.dryRun && results.some(v => v.models.length > 0))
    printSweepSummary(results);

  console.log(`${COLORS.dim}Done.${COLORS.reset}`);
}

main().catch((error) => {
  console.error(`${COLORS.red}Fatal error: ${error.message}${COLORS.reset}`);
  if (error.stack) console.error(`${COLORS.dim}${error.stack}${COLORS.reset}`);
  process.exit(1);
});
