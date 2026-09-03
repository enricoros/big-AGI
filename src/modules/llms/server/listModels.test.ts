/// <reference types="node" />

// Smoke tests for the server-side LLM model enumeration. Exercises the real
// `listModelsRunDispatch` for every supported dialect from Node.
//
// Philosophy: a test must either (a) assert real behavior, or (b) report as
// SKIPPED with a visible reason. We never let a missing-key path silently pass
// with a "error message matches /Missing X/" check - that's testing a string
// literal in the access builder, not the listing pipeline. Every network test
// is key-gated: without keys (e.g. CI) only the offline lane (hardcoded/curated
// lists + import smoke) is asserted; the rest is reported as skipped.
//
// Run:
// - `npm test` (skips key-less vendors; export vendor keys to widen coverage)
// - `NODE_ENV=development npx tsx --test src/modules/llms/server/listModels.test.ts`
//
// -----------------------------------------------------------------------------
// Credential env vars per protocol/dialect
// -----------------------------------------------------------------------------
// Each dialect has its OWN key. We never reuse one vendor's key for another.
// In particular, OPENAI_API_KEY is consumed ONLY when dialect='openai' AND the
// request is targeting the default api.openai.com host (no access.oaiHost). It
// is NEVER forwarded to third-party OpenAI-compatible hosts (Chutes, Fireworks,
// MiniMax, Novita, Arcee, LLM API, FastChat, TLUS, etc.): those require their
// own upstream key passed via access.oaiKey from the UI/Models Setup.
//
//   Protocol            Dialect         Env var                 Endpoint
//   -----------------   -------------   ---------------------   ---------------------------------
//   anthropic           anthropic       ANTHROPIC_API_KEY       api.anthropic.com
//   bedrock             bedrock         AWS_ACCESS_KEY_ID +     bedrock-runtime.<region>.amazonaws.com
//                                       AWS_SECRET_ACCESS_KEY
//                                       (or AWS_BEARER_TOKEN_BEDROCK)
//   gemini              gemini          GEMINI_API_KEY          generativelanguage.googleapis.com
//   ollama              ollama          (opt-in via             localhost:11434
//                                        BIGAGI_TEST_OLLAMA_HOST)
//   openai-compatible   alibaba         ALIBABA_API_KEY         dashscope-intl.aliyuncs.com
//   openai-compatible   deepseek        DEEPSEEK_API_KEY        api.deepseek.com
//   openai-compatible   groq            GROQ_API_KEY            api.groq.com
//   openai-compatible   lmstudio        (opt-in via             localhost:1234
//                                        BIGAGI_TEST_LMSTUDIO_HOST)
//   openai-compatible   localai         (opt-in via             localhost:8080
//                                        BIGAGI_TEST_LOCALAI_HOST)
//   openai-compatible   metaai          METAAI_API_KEY          api.meta.ai
//   openai-compatible   mistral         MISTRAL_API_KEY         api.mistral.ai
//   openai-compatible   moonshot        MOONSHOT_API_KEY        api.moonshot.ai
//   openai-compatible   nvidianim       NVIDIANIM_API_KEY       integrate.api.nvidia.com (listing is PUBLIC)
//   openai-compatible   openai          OPENAI_API_KEY *        api.openai.com
//                                       (* default-host ONLY; not forwarded to custom hosts)
//   openai-compatible   openai (host)   (no env fallback)       custom host (Chutes, Fireworks, MiniMax, ...)
//   openai-compatible   openrouter      OPENROUTER_API_KEY      openrouter.ai  (listing is PUBLIC)
//   openai-compatible   perplexity      PERPLEXITY_API_KEY      api.perplexity.ai (no listing API; hardcoded)
//   openai-compatible   togetherai      TOGETHERAI_API_KEY      api.together.xyz
//   openai-compatible   xai             XAI_API_KEY             api.x.ai
//   openai-compatible   zai             ZAI_API_KEY (test-only; api.z.ai (curated list; API optional)
//                                        no server env fallback)
// -----------------------------------------------------------------------------

import { describe, test } from 'node:test';

import type { AixAPI_Access } from '../../aix/server/api/aix.wiretypes';
import type { ModelDescriptionSchema } from './llm.server.types';

import { listModelsRunDispatch } from './listModels.dispatch';
import { llmsIsLabelUncurated } from './models.mappings';

// DEV-gated validators and flags (llmDevValidateParameterSpecs_DEV,
// Release.IsNodeDevBuild, DEV_DEBUG_OPENROUTER_MODELS, ...) capture NODE_ENV at
// module-init time, so it must be set BEFORE this file is imported. ESM
// hoisting makes it impossible to set it from inside the file after the static
// imports above. If it's not set, fail loudly with the exact fix.
if (process.env.NODE_ENV !== 'development')
  throw new Error(
    'listModels.test.ts requires NODE_ENV=development (DEV validators are gated on it). '
    + 'Run: NODE_ENV=development npx tsx --test src/modules/llms/server/listModels.test.ts. '
    + 'IntelliJ: add NODE_ENV=development to the run configuration\'s Environment Variables.',
  );


// ---- runtime config ----

const REQUEST_TIMEOUT_MS = 8000;

const E = process.env;
const hasKey = (...vars: string[]): boolean => vars.some(v => !!E[v]?.trim());

// Gate label for conditionally-run tests: returns a skip reason string (or false to run).
const skipIfMissing = (envVar: string | string[]): string | false => {
  const vars = Array.isArray(envVar) ? envVar : [envVar];
  return hasKey(...vars) ? false : `needs ${vars.join(' or ')}`;
};


// ---- assertion helpers (no node:assert dep) ----

const MAX_IDS_REPORTED = 50;

const ok = (cond: unknown, label: string): void => {
  if (!cond) throw new Error(`assert: ${label}`);
};

// Stdout report for the parent test's right-hand panel. Must be emitted from
// inside the test body (before the test returns) so it's captured as that
// test's own output. No dynamic subtests - the test tree stays static.
function _reportModels(label: string, models: ModelDescriptionSchema[]): void {
  const ids = models.map(m => m.id);
  const shown = ids.slice(0, MAX_IDS_REPORTED);
  const rest = ids.length > MAX_IDS_REPORTED ? `\n  ... +${ids.length - MAX_IDS_REPORTED} more` : '';
  console.log(`[${label}] ${models.length} model${models.length === 1 ? '' : 's'}:\n  ${shown.join('\n  ')}${rest}`);
}

// Capture `[DEV]` emissions from vendor validators (llmDevValidateParameterSpecs_DEV,
// llmsAntValidateModelDefs_DEV, openaiValidateModelDefs_DEV, geminiValidate*,
// groqValidateModelDefs_DEV, openRouter parse warnings, etc.) so stale or
// unknown model definitions become loud test failures instead of silent warnings.
async function _runCapturingDevWarnings<T>(fn: () => Promise<T>): Promise<{ result: T; devMessages: string[] }> {
  const devMessages: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const capture = (orig: typeof console.log) => (...args: any[]): void => {
    const rendered = args.map(a => typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(' ');
    if (rendered.includes('[DEV]')) devMessages.push(rendered);
    orig.apply(console, args);
  };
  console.log = capture(origLog);
  console.warn = capture(origWarn);
  try {
    const result = await fn();
    return { result, devMessages };
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
}

async function expectOk(access: AixAPI_Access, minModels: number, label: string): Promise<ModelDescriptionSchema[]> {
  const { result: models, devMessages } = await _runCapturingDevWarnings(() =>
    listModelsRunDispatch(access, AbortSignal.timeout(REQUEST_TIMEOUT_MS)),
  );
  ok(Array.isArray(models), `${label}: models is array`);
  ok(models.length >= minModels, `${label}: expected >=${minModels} models, got ${models.length}`);
  for (const m of models) {
    ok(typeof m.id === 'string' && m.id.length > 0, `${label}: model has string id`);
    ok(Array.isArray(m.interfaces), `${label}: ${m.id} has interfaces array`);
  }
  _reportModels(label, models);

  // Fail on any [DEV] validator output: stale/unknown model defs, invalid
  // parameterSpecs, parser failures, etc. The remediation is usually one of
  // the `llms:update-models-<vendor>` skills.
  if (devMessages.length) {
    const shown = devMessages.slice(0, 20).join('\n  ');
    const rest = devMessages.length > 20 ? `\n  ... +${devMessages.length - 20} more` : '';
    throw new Error(`${label}: ${devMessages.length} [DEV] validator warning(s) (run the vendor's llms:update-models-* skill to refresh):\n  ${shown}${rest}`);
  }
  return models;
}


// ---- per-dialect access shape (openai-compatible only) ----

const openAIShape = (extra: Partial<Record<string, any>> = {}): any => ({
  oaiKey: '', oaiOrg: '', oaiHost: '', ...extra,
});


// ---- tests ----

describe('listModels enumeration', () => {

  // ================== Anthropic protocol ==================

  test('anthropic: live listing', { skip: skipIfMissing('ANTHROPIC_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'anthropic', anthropicKey: E.ANTHROPIC_API_KEY || '', anthropicHost: null } as AixAPI_Access,
      1, 'anthropic/live',
    );
  });


  // ================== Bedrock protocol ==================

  test('bedrock: live listing', { skip: skipIfMissing(['AWS_ACCESS_KEY_ID', 'AWS_BEARER_TOKEN_BEDROCK']) }, async () => {
    await expectOk(
      {
        dialect: 'bedrock',
        bedrockBearerToken: E.AWS_BEARER_TOKEN_BEDROCK || '',
        bedrockAccessKeyId: E.AWS_ACCESS_KEY_ID || '',
        bedrockSecretAccessKey: E.AWS_SECRET_ACCESS_KEY || '',
        bedrockSessionToken: E.AWS_SESSION_TOKEN || null,
        bedrockRegion: E.AWS_REGION || 'us-east-1',
        clientSideFetch: false,
      } as AixAPI_Access,
      1, 'bedrock/live',
    );
  });


  // ================== Gemini protocol ==================

  test('gemini: live listing', { skip: skipIfMissing('GEMINI_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'gemini', geminiKey: E.GEMINI_API_KEY || '', geminiHost: '', minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED' } as AixAPI_Access,
      1, 'gemini/live',
    );
  });


  // ================== Ollama protocol ==================

  test('ollama: live listing', { skip: skipIfMissing('BIGAGI_TEST_OLLAMA_HOST') }, async () => {
    await expectOk(
      { dialect: 'ollama', ollamaHost: E.BIGAGI_TEST_OLLAMA_HOST || '' } as AixAPI_Access,
      0, 'ollama/live',
    );
  });


  // ================== OpenAI-compatible protocol ==================

  test('openai-compat/alibaba: live listing', { skip: skipIfMissing('ALIBABA_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'alibaba', ...openAIShape({ oaiKey: E.ALIBABA_API_KEY || '' }) } as AixAPI_Access,
      1, 'alibaba/live',
    );
  });

  test('openai-compat/cerebras: live listing', { skip: skipIfMissing('CEREBRAS_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'cerebras', ...openAIShape({ oaiKey: E.CEREBRAS_API_KEY || '' }) } as AixAPI_Access,
      1, 'cerebras/live',
    );
  });

  test('openai-compat/deepseek: live listing', { skip: skipIfMissing('DEEPSEEK_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'deepseek', ...openAIShape({ oaiKey: E.DEEPSEEK_API_KEY || '' }) } as AixAPI_Access,
      1, 'deepseek/live',
    );
  });

  test('openai-compat/groq: live listing', { skip: skipIfMissing('GROQ_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'groq', ...openAIShape({ oaiKey: E.GROQ_API_KEY || '' }) } as AixAPI_Access,
      1, 'groq/live',
    );
  });

  test('openai-compat/lmstudio: live listing', { skip: skipIfMissing('BIGAGI_TEST_LMSTUDIO_HOST') }, async () => {
    await expectOk(
      { dialect: 'lmstudio', ...openAIShape({ oaiHost: E.BIGAGI_TEST_LMSTUDIO_HOST || '' }) } as AixAPI_Access,
      0, 'lmstudio/live',
    );
  });

  test('openai-compat/localai: live listing', { skip: skipIfMissing('BIGAGI_TEST_LOCALAI_HOST') }, async () => {
    await expectOk(
      { dialect: 'localai', ...openAIShape({ oaiHost: E.BIGAGI_TEST_LOCALAI_HOST || '' }) } as AixAPI_Access,
      0, 'localai/live',
    );
  });

  test('openai-compat/metaai: live listing', { skip: skipIfMissing('METAAI_API_KEY') }, async () => {
    const models = await expectOk(
      { dialect: 'metaai', ...openAIShape({ oaiKey: E.METAAI_API_KEY || '' }) } as AixAPI_Access,
      1, 'metaai/live',
    );
    // the catalog mixes families and the list API has no type field: the image and transcription ids must be filtered out
    ok(!models.some(m => m.id.startsWith('muse-image-') || m.id.startsWith('muse-voice-')), 'metaai: non-chat models are dropped');
    ok(models.some(m => m.id.startsWith('muse-spark-')), 'metaai: Muse Spark family present');
    // curated entries always carry a measured context; 0-day '[?]' arrivals legitimately have null
    ok(models.filter(m => !llmsIsLabelUncurated(m.label)).every(m => m.contextWindow !== null), 'metaai: all curated models carry a context window');
  });

  test('openai-compat/mistral: live listing', { skip: skipIfMissing('MISTRAL_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'mistral', ...openAIShape({ oaiKey: E.MISTRAL_API_KEY || '' }) } as AixAPI_Access,
      1, 'mistral/live',
    );
  });

  test('openai-compat/modular: live listing', { skip: skipIfMissing('MODULAR_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'modular', ...openAIShape({ oaiKey: E.MODULAR_API_KEY || '' }) } as AixAPI_Access,
      1, 'modular/live',
    );
  });

  test('openai-compat/moonshot: live listing', { skip: skipIfMissing('MOONSHOT_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'moonshot', ...openAIShape({ oaiKey: E.MOONSHOT_API_KEY || '' }) } as AixAPI_Access,
      1, 'moonshot/live',
    );
  });

  test('openai-compat/nvidianim: live listing (endpoint is PUBLIC; key-gated to stay offline)', { skip: skipIfMissing('NVIDIANIM_API_KEY') }, async () => {
    // NVIDIA's /v1/models returns 200 without any key, so this COULD run keyless - key-gated
    // for offline determinism (same rationale as openrouter below). The curated table drops
    // unknown/retired ids; catalog churn that retires a curated model shows as a [DEV] stale
    // warning, which expectOk turns into a failure - that is the drift alarm working.
    const models = await expectOk(
      { dialect: 'nvidianim', ...openAIShape({ oaiKey: E.NVIDIANIM_API_KEY || '' }) } as AixAPI_Access,
      10, 'nvidianim/live',
    );
    ok(models.some(m => m.id.startsWith('nvidia/nemotron-3-')), 'nvidianim: Nemotron 3 family present');
    // curated entries always carry a measured context; 0-day '[?]' arrivals legitimately have null
    ok(models.filter(m => !llmsIsLabelUncurated(m.label)).every(m => m.contextWindow !== null), 'nvidianim: all curated models carry a context window');
  });

  test('openai-compat/openai via nvidia host: curated list via heuristic', { skip: skipIfMissing('NVIDIANIM_API_KEY') }, async () => {
    // Pre-existing custom-host services (dialect='openai' + integrate.api.nvidia.com) route to the
    // same curated parser via nvidiaNIMHeuristic - the raw 118-model stale superset must NOT leak through.
    const models = await expectOk(
      { dialect: 'openai', ...openAIShape({ oaiKey: E.NVIDIANIM_API_KEY || '', oaiHost: 'https://integrate.api.nvidia.com' }) } as AixAPI_Access,
      10, 'openai/nvidia-host',
    );
    ok(!models.some(m => m.id.startsWith('zyphra/')), 'nvidia-host: retired catalog ids are dropped');
  });

  test('openai-compat/openai: live listing', { skip: skipIfMissing('OPENAI_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'openai', ...openAIShape({ oaiKey: E.OPENAI_API_KEY || '' }) } as AixAPI_Access,
      1, 'openai/live',
    );
  });

  test('openai-compat/openai via minimax.io host: hardcoded list (no /v1/models API)', async () => {
    // Routed via dialect='openai' + minimax.io host heuristic; fetch is bypassed.
    // OPENAI_API_KEY is NOT forwarded to this custom host - dummy key required from the client.
    const models = await expectOk(
      { dialect: 'openai', ...openAIShape({ oaiKey: 'dummy', oaiHost: 'https://api.minimax.io' }) } as AixAPI_Access,
      1, 'openai/minimax',
    );
    ok(models.some(m => /minimax/i.test(m.id)), 'minimax: MiniMax-* present');
  });

  test('openai-compat/openrouter: live listing (endpoint is PUBLIC; any bearer accepted)', { skip: skipIfMissing('OPENROUTER_API_KEY') }, async () => {
    // OpenRouter's /api/v1/models accepts any bearer token, so this COULD run keyless -
    // but it's key-gated so a keyless `npm test` stays offline and deterministic (catalog
    // drift turns it red with zero code changes). Exercises a real fetch + OpenAI-compatible
    // parse + vendor mapping + variant injection pipeline.
    const key = E.OPENROUTER_API_KEY?.trim() || 'x';
    const models = await expectOk(
      { dialect: 'openrouter', ...openAIShape({ oaiKey: key }) } as AixAPI_Access,
      50, 'openrouter/live',
    );
    ok(models.some(m => m.id.includes('/')), 'openrouter: ids use vendor/model format');
  });

  test('openai-compat/perplexity: hardcoded list (no API, no credentials)', async () => {
    const models = await expectOk(
      { dialect: 'perplexity', ...openAIShape() } as AixAPI_Access,
      1, 'perplexity',
    );
    ok(models.some(m => /sonar/i.test(m.id)), 'perplexity: sonar family present');
  });

  test('openai-compat/togetherai: live listing', { skip: skipIfMissing('TOGETHERAI_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'togetherai', ...openAIShape({ oaiKey: E.TOGETHERAI_API_KEY || '' }) } as AixAPI_Access,
      1, 'togetherai/live',
    );
  });

  test('openai-compat/xai: live listing', { skip: skipIfMissing('XAI_API_KEY') }, async () => {
    await expectOk(
      { dialect: 'xai', ...openAIShape({ oaiKey: E.XAI_API_KEY || '' }) } as AixAPI_Access,
      1, 'xai/live',
    );
  });

  test('openai-compat/zai: curated list (API is optional + unreliable)', async () => {
    // Always runs: even if the upstream list API fails (or keyless: is never tried),
    // zaiCuratedModelDescriptions() is returned. With ZAI_API_KEY set, also exercises
    // the optimistic live-discovery merge path.
    const models = await expectOk(
      { dialect: 'zai', ...openAIShape({ oaiKey: E.ZAI_API_KEY || '' }) } as AixAPI_Access,
      1, 'zai',
    );
    ok(models.length > 0, 'zai: curated list non-empty');
  });

});
