/// <reference types="node" />

/**
 * llm-listing-checker: the model listing of every vendor, against the model definitions the code carries.
 *
 * A job (tools/jobs/jobs.sh has the rules): it lists models at the live vendors with real keys, which is free, and
 * no test runner finds it on its own. To run it, every hour or when a vendor ships models:
 *   sh tools/jobs/jobs.sh llm-listing-checker
 *
 * What it assumes is in ASSUMPTIONS, printed first on every run. How to read it: a row fails when the listing does
 * not come back, when a definition in the code is stale or unknown to the vendor, or when a fact the listing code
 * relies on no longer holds. A model the vendor lists and the definitions do not know yet is printed as a direction
 * (run the vendor's llms:update-models skill), not a failure.
 *
 * Two kinds of failure (jobs.shared.ts): a listing that does not work, or a fact that no longer holds, is breakage, and
 * is posted where the launcher posts. A stale or unknown definition is drift: it fails the run and is not posted.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { before, describe, test } from 'node:test';

import type { AixAPI_Access } from '~/modules/aix/server/api/aix.wiretypes';
import type { ListModelsResponse, ModelDescriptionSchema } from '~/modules/llms/server/llm.server.types';

import { lookupKey } from '../../develop/aix-protocol-lab/access';

import { failOn, printTable, SCANNER_KEY_FILE_NAME, scannerAccess } from '../jobs.shared';


const ASSUMPTIONS = `
1. A vendor's listing is the truth about what it serves today. The definitions in the code (labels, context
   windows, prices, parameters) are curated by hand and drift when a vendor adds, renames or retires a model.
2. The code detects that drift itself, in development only: with NODE_ENV=development, which this file sets before
   the code loads, its validators log a [DEV] line for every stale or unknown definition. Each line is a failure
   here. A listed model without a definition is labeled "[?]" by the code and counted as not yet curated.
3. Listings run through the server-side dispatch, as the app's server runs them. The browser-direct path is the
   business of csf-cors-checker.
4. Keys come from the environment or .env.api-keys, else from the registry scanner's key file
   (tools/data/llms/llm-services.json), so the machine that runs the scanner needs no second key file. A vendor
   with a key in neither is printed as not measured. The local vendors are measured when their host is given
   (BIGAGI_TEST_OLLAMA_HOST, _LMSTUDIO_HOST, _LOCALAI_HOST) or the scanner's file has them.`;

const CALL_TIMEOUT_MS = 30_000;

// a listing that fails is asked again before it counts as down: one refused request is not an outage
const LISTING_RETRIES = 2;
const LISTING_RETRY_PAUSE_MS = 15_000;

const _key = (envVar: string) => lookupKey(envVar)?.value?.trim() ?? '';
const _openai = (dialect: string, oaiKey: string, oaiHost = '') => ({ dialect, oaiKey, oaiOrg: '', oaiHost }) as AixAPI_Access;


// --- The listings: one row per vendor, or per host of a vendor ---

type Listing = {
  label: string;
  dialect: string;
  host?: string; // a vendor's dialect served from another host: the row is about that host
  needs: string[]; // env vars: any one of them makes the row measurable
  keyless?: true; // the code carries this list itself: the row runs without a key too
  access: () => AixAPI_Access; // built from the environment or .env.api-keys
  minModels: number;
  /** what the listing code relies on at this vendor, beyond a list that parses: returns the facts that no longer hold */
  facts?: (models: ModelDescriptionSchema[], isUncurated: (label: string) => boolean) => string[];
};

const _holds = (checks: [holds: boolean, fact: string][]) => checks.filter(([holds]) => !holds).map(([, fact]) => fact);

const LISTINGS: Listing[] = [
  { label: 'anthropic', dialect: 'anthropic', needs: ['ANTHROPIC_API_KEY'], minModels: 1, access: () => ({ dialect: 'anthropic', anthropicKey: _key('ANTHROPIC_API_KEY'), anthropicHost: null }) as AixAPI_Access },
  {
    label: 'bedrock', dialect: 'bedrock', needs: ['BEDROCK_BEARER_TOKEN', 'BEDROCK_ACCESS_KEY_ID'], minModels: 1,
    access: () => ({
      dialect: 'bedrock', clientSideFetch: false,
      bedrockBearerToken: _key('BEDROCK_BEARER_TOKEN'),
      bedrockAccessKeyId: _key('BEDROCK_ACCESS_KEY_ID'), bedrockSecretAccessKey: _key('BEDROCK_SECRET_ACCESS_KEY'), bedrockSessionToken: _key('BEDROCK_SESSION_TOKEN') || null,
      bedrockRegion: _key('BEDROCK_REGION') || 'us-east-1',
    }) as AixAPI_Access,
  },
  { label: 'gemini', dialect: 'gemini', needs: ['GEMINI_API_KEY'], minModels: 1, access: () => ({ dialect: 'gemini', geminiKey: _key('GEMINI_API_KEY'), geminiHost: '', minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED' }) as AixAPI_Access },
  { label: 'ollama', dialect: 'ollama', needs: ['BIGAGI_TEST_OLLAMA_HOST'], minModels: 0, access: () => ({ dialect: 'ollama', ollamaHost: _key('BIGAGI_TEST_OLLAMA_HOST') }) as AixAPI_Access },
  { label: 'alibaba', dialect: 'alibaba', needs: ['ALIBABA_API_KEY'], minModels: 1, access: () => _openai('alibaba', _key('ALIBABA_API_KEY')) },
  { label: 'cerebras', dialect: 'cerebras', needs: ['CEREBRAS_API_KEY'], minModels: 1, access: () => _openai('cerebras', _key('CEREBRAS_API_KEY')) },
  {
    // the compatibility list mixes chat with embed, rerank, transcribe and parse endpoints: those must be filtered out
    label: 'cohere', dialect: 'cohere', needs: ['COHERE_API_KEY'], minModels: 1, access: () => _openai('cohere', _key('COHERE_API_KEY')),
    facts: (models, isUncurated) => _holds([
      [!models.some(m => /^(embed-|rerank-|cohere-transcribe|parse-)/.test(m.id)), 'non-chat endpoints are dropped'],
      [models.some(m => m.id.startsWith('command-a-')), 'the Command A family is listed'],
      [models.filter(m => !isUncurated(m.label)).every(m => m.contextWindow !== null), 'every curated model carries a context window'],
    ]),
  },
  { label: 'deepseek', dialect: 'deepseek', needs: ['DEEPSEEK_API_KEY'], minModels: 1, access: () => _openai('deepseek', _key('DEEPSEEK_API_KEY')) },
  { label: 'groq', dialect: 'groq', needs: ['GROQ_API_KEY'], minModels: 1, access: () => _openai('groq', _key('GROQ_API_KEY')) },
  { label: 'lmstudio', dialect: 'lmstudio', needs: ['BIGAGI_TEST_LMSTUDIO_HOST'], minModels: 0, access: () => _openai('lmstudio', '', _key('BIGAGI_TEST_LMSTUDIO_HOST')) },
  { label: 'localai', dialect: 'localai', needs: ['BIGAGI_TEST_LOCALAI_HOST'], minModels: 0, access: () => _openai('localai', '', _key('BIGAGI_TEST_LOCALAI_HOST')) },
  {
    // the catalog mixes families and the list has no type field: the transcription id must be filtered out, the image model curated
    label: 'metaai', dialect: 'metaai', needs: ['METAAI_API_KEY'], minModels: 1, access: () => _openai('metaai', _key('METAAI_API_KEY')),
    facts: (models, isUncurated) => _holds([
      [!models.some(m => m.id.startsWith('muse-voice-')), 'the transcription model is dropped'],
      [models.some(m => m.id.startsWith('muse-spark-')), 'the Muse Spark family is listed'],
      [models.filter(m => m.id.startsWith('muse-image-')).every(m => m.interfaces.includes('outputs-image')), 'Muse Image is an image-output model'],
      [models.filter(m => !isUncurated(m.label) && !m.interfaces.includes('outputs-image')).every(m => m.contextWindow !== null), 'every curated chat model carries a context window'],
    ]),
  },
  { label: 'mistral', dialect: 'mistral', needs: ['MISTRAL_API_KEY'], minModels: 1, access: () => _openai('mistral', _key('MISTRAL_API_KEY')) },
  { label: 'modular', dialect: 'modular', needs: ['MODULAR_API_KEY'], minModels: 1, access: () => _openai('modular', _key('MODULAR_API_KEY')) },
  { label: 'moonshot', dialect: 'moonshot', needs: ['MOONSHOT_API_KEY'], minModels: 1, access: () => _openai('moonshot', _key('MOONSHOT_API_KEY')) },
  {
    // the curated table drops unknown and retired ids: catalog churn that retires a curated model shows as a [DEV] line
    label: 'nvidianim', dialect: 'nvidianim', needs: ['NVIDIANIM_API_KEY'], minModels: 10, access: () => _openai('nvidianim', _key('NVIDIANIM_API_KEY')),
    facts: (models, isUncurated) => _holds([
      [models.some(m => m.id.startsWith('nvidia/nemotron-3-')), 'the Nemotron 3 family is listed'],
      [models.filter(m => !isUncurated(m.label)).every(m => m.contextWindow !== null), 'every curated model carries a context window'],
    ]),
  },
  { label: 'openai', dialect: 'openai', needs: ['OPENAI_API_KEY'], minModels: 1, access: () => _openai('openai', _key('OPENAI_API_KEY')) },
  {
    label: 'openai, fireworks host', dialect: 'openai', host: 'api.fireworks.ai', needs: ['FIREWORKSAI_API_KEY'], minModels: 1,
    access: () => _openai('openai', _key('FIREWORKSAI_API_KEY'), 'https://api.fireworks.ai/inference'),
  },
  {
    // curated first: with no key of ours the live list is refused and the curated table alone comes back. The OpenAI
    // server key is never forwarded to this host, so the row runs on a made-up key when there is none
    label: 'openai, minimax.io host', dialect: 'openai', host: 'api.minimax.io', needs: ['MINIMAX_API_KEY'], keyless: true, minModels: 1,
    access: () => _openai('openai', _key('MINIMAX_API_KEY') || 'dummy', 'https://api.minimax.io'),
    facts: (models) => _holds([[models.some(m => /minimax/i.test(m.id)), 'the MiniMax models are listed']]),
  },
  {
    // the host ends in its API version, so the list is at /v2/models; per Sarvam's reasoning table, sarvam-105b thinks by default and takes effort 'none'
    label: 'openai, sarvam /v2 host', dialect: 'openai', host: 'api.sarvam.ai', needs: ['SARVAM_API_KEY'], minModels: 2,
    access: () => _openai('openai', _key('SARVAM_API_KEY'), 'https://api.sarvam.ai/v2'),
    facts: (models, isUncurated) => _holds([
      [!models.some(m => isUncurated(m.label)), 'every label comes from the listing'],
      [!!models.find(m => m.id === 'sarvam-105b')?.parameterSpecs?.find(spec => spec.paramId === 'llmVndOaiEffort')?.enumValues?.includes('none'), 'sarvam-105b: thinking can be turned off'],
    ]),
  },
  {
    label: 'openrouter', dialect: 'openrouter', needs: ['OPENROUTER_API_KEY'], minModels: 50, access: () => _openai('openrouter', _key('OPENROUTER_API_KEY')),
    facts: (models) => _holds([[models.some(m => m.id.includes('/')), 'ids use the vendor/model form']]),
  },
  {
    // no listing API: the list is the code's own, and needs no key
    label: 'perplexity', dialect: 'perplexity', needs: ['PERPLEXITY_API_KEY'], keyless: true, minModels: 1, access: () => _openai('perplexity', _key('PERPLEXITY_API_KEY')),
    facts: (models) => _holds([[models.some(m => /sonar/i.test(m.id)), 'the sonar family is listed']]),
  },
  { label: 'sakanaai', dialect: 'sakanaai', needs: ['SAKANAAI_API_KEY'], minModels: 1, access: () => _openai('sakanaai', _key('SAKANAAI_API_KEY')) },
  { label: 'togetherai', dialect: 'togetherai', needs: ['TOGETHERAI_API_KEY'], minModels: 1, access: () => _openai('togetherai', _key('TOGETHERAI_API_KEY')) },
  { label: 'xai', dialect: 'xai', needs: ['XAI_API_KEY'], minModels: 1, access: () => _openai('xai', _key('XAI_API_KEY')) },
  // curated first: without a key the vendor is never asked and the curated list comes back; with one, the live discovery is merged in
  { label: 'zai', dialect: 'zai', needs: ['ZAI_API_KEY'], keyless: true, minModels: 1, access: () => _openai('zai', _key('ZAI_API_KEY')) },
];


// --- Keys: the registry scanner's key file, where the environment has none ---

/**
 * The access of a listing, and where its key came from: its own when the environment or .env.api-keys has the key,
 * else the scanner's entry for the same vendor and host, else no key where the row runs without one.
 */
function accessFor(listing: Listing): { access: AixAPI_Access; keyFrom: string } | null {
  const own = listing.needs.map(envVar => lookupKey(envVar)).find(found => found?.value?.trim());
  if (own) return { access: listing.access(), keyFrom: own.source };
  const scanned = scannerAccess(listing.dialect, listing.host);
  if (scanned) return { access: scanned, keyFrom: SCANNER_KEY_FILE_NAME };
  return listing.keyless ? { access: listing.access(), keyFrom: 'no key' } : null;
}


// --- Measuring ---

type ListModels = (access: AixAPI_Access, signal?: AbortSignal) => Promise<ListModelsResponse>;

type Row = {
  label: string;
  keyFrom: string;
  unmeasured?: string;
  failed?: string;       // the listing did not come back, or does not have the common shape
  models: number;
  uncurated: string[];   // listed by the vendor, unknown to the definitions
  devLines: string[];    // the code's own validators: stale or unknown definitions
  facts: string[];       // vendor facts that no longer hold
};

const devLinesOfThisCall = new AsyncLocalStorage<string[]>();

async function measureListing(listing: Listing, listModels: ListModels, isUncurated: (label: string) => boolean): Promise<Row> {
  const row: Row = { label: listing.label, keyFrom: '-', models: 0, uncurated: [], devLines: [], facts: [] };
  const found = accessFor(listing);
  if (!found) return { ...row, unmeasured: `no ${listing.needs.join(' or ')}, and no entry in the scanner's key file` };
  row.keyFrom = found.keyFrom;
  for (let attempt = 1; ; attempt++) {
    row.devLines.length = 0;
    try {
      const { models } = await devLinesOfThisCall.run(row.devLines, () => listModels(found.access, AbortSignal.timeout(CALL_TIMEOUT_MS)));
      row.failed = undefined;
      row.models = models.length;
      if (models.length < listing.minModels) row.failed = `${models.length} models, at least ${listing.minModels} expected`;
      else if (!models.every(m => typeof m.id === 'string' && m.id && Array.isArray(m.interfaces))) row.failed = 'a model without an id or without interfaces';
      row.uncurated = models.filter(m => isUncurated(m.label)).map(m => m.id);
      row.facts = listing.facts?.(models, isUncurated) ?? [];
      return row;
    } catch (error: any) {
      row.failed = `${String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 200)} (${attempt} attempts)`;
      if (attempt > LISTING_RETRIES) return row;
      await new Promise(resolve => setTimeout(resolve, LISTING_RETRY_PAUSE_MS));
    }
  }
}


// --- OpenRouter: what a key may list. We hold no key that cannot pay, so the live answers of /v1/key and /v1/credits ---
// --- pass through with the fields under test replaced; the list and everything else stay live. Run one at a time.   ---

async function openRouterFacts(listModels: ListModels): Promise<string[]> {
  const ownKey = (accessFor(LISTINGS.find(listing => listing.label === 'openrouter')!)?.access as { oaiKey?: string } | undefined)?.oaiKey;
  if (!ownKey) return [];
  const access = (key: string) => _openai('openrouter', key);
  const failures: string[] = [];
  const expect = (holds: boolean, fact: string) => holds || failures.push(fact);

  // the public list loads for an unknown key too: the 401 of /v1/key is what fails the listing, at setup instead of at the first chat
  const rejection: any = await listModels(access('sk-or-v1-' + '0'.repeat(64)), AbortSignal.timeout(CALL_TIMEOUT_MS)).then(() => null, error => error);
  expect(rejection?.httpStatus === 401, 'a key OpenRouter does not know fails the listing with the upstream 401');

  const liveFetch = globalThis.fetch;
  const listAs = async (keyData: object, credits: object): Promise<ListModelsResponse> => {
    globalThis.fetch = async (input, init) => {
      const response = await liveFetch(input, init);
      const replaced = String(input).endsWith('/v1/key') ? keyData : String(input).endsWith('/v1/credits') ? credits : null;
      if (!replaced) return response;
      const answer = await response.json();
      return Response.json({ ...answer, data: { ...answer.data, ...replaced } }, { status: response.status });
    };
    try {
      return await listModels(access(ownKey), AbortSignal.timeout(CALL_TIMEOUT_MS));
    } finally {
      globalThis.fetch = liveFetch;
    }
  };
  const isFree = (m: ModelDescriptionSchema) => m.chatPrice?.input === 'free' && m.chatPrice.output === 'free';
  const neverBought = { is_free_tier: true, limit: null, byok_usage: 0 }, noCredits = { total_credits: 0, total_usage: 0 };

  // a key that cannot pay lists the priced models hidden, the free ones as usual
  for (const [why, keyData, credits, freeModelsOnly] of [
    ['never bought credits', neverBought, noCredits, 'free-tier'],
    ['a key limit of zero, on an account with credits', { is_free_tier: false, limit: 0, byok_usage: 0 }, { total_credits: 50, total_usage: 0 }, 'key-limit-zero'],
  ] as const) {
    const { models, accessStatus } = await listAs({ ...keyData, free_model_daily_requests: { limit: 50 } }, credits);
    expect(accessStatus?.freeModelsOnly === freeModelsOnly && accessStatus.freeRequestsPerDay === 50, `${why}: the access status says why, and what the free models allow`);
    expect(models.some(m => !isFree(m)), `${why}: the priced models are still listed`);
    expect(models.every(m => isFree(m) || m.hidden), `${why}: every priced model is hidden`);
    expect(models.some(m => m.id === 'openrouter/free' && !m.hidden), `${why}: the free router is listed, visible`);
  }

  // a key that never bought credits but shows access lists as usual
  for (const [why, keyData, credits] of [
    ['a granted balance', neverBought, { total_credits: 5, total_usage: 1 }],
    ['usage through its own provider keys', { ...neverBought, byok_usage: 0.5 }, noCredits],
    ['a limit that is used up, on an account with credits', { is_free_tier: false, limit: 5, limit_remaining: 0, byok_usage: 0 }, noCredits],
    ['a key answer of another shape', { is_free_tier: 'yes', limit: 'none', byok_usage: null }, noCredits],
  ] as const) {
    const { models, accessStatus } = await listAs(keyData, credits);
    expect(models.some(m => !isFree(m) && !m.hidden), `${why}: priced models are visible`);
    expect(!accessStatus, `${why}: no access status`);
  }
  return failures;
}


// --- The run ---

describe('llm-listing-checker: the vendors\' model listings against the model definitions', () => {

  let rows: Row[];
  let openRouter: string[];

  before(async () => {
    // the validators only speak in development, and read the mode when the code loads: set it, then load the code
    Object.assign(process.env, { NODE_ENV: 'development' });
    const [{ listModelsRunDispatch }, { llmsIsLabelUncurated }] = await Promise.all([
      import('~/modules/llms/server/listModels.dispatch'),
      import('~/modules/llms/server/models.mappings'),
    ]);

    // the code narrates on the console: keep the [DEV] lines of each listing, drop the rest
    const { log, warn, error } = console;
    const capture = (...args: unknown[]) => {
      const line = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
      if (line.includes('[DEV]')) devLinesOfThisCall.getStore()?.push(line.replace(/\s+/g, ' '));
    };
    console.log = console.warn = console.error = capture;
    try {
      rows = await Promise.all(LISTINGS.map(listing => measureListing(listing, listModelsRunDispatch, llmsIsLabelUncurated)));
      // a network failure in these extra calls is not a finding: the openrouter row says whether its listing is up
      openRouter = await openRouterFacts(listModelsRunDispatch).catch(() => []);
    } finally {
      Object.assign(console, { log, warn, error });
    }
  }, { timeout: 10 * CALL_TIMEOUT_MS });

  test('assumptions', () => {
    console.log(`llm-listing-checker, ${new Date().toLocaleDateString('en-CA')}, node ${process.version}\n\nASSUMES${ASSUMPTIONS}`);
  });

  test('every listing comes back and parses', () => {
    printTable('LISTINGS   through the server-side dispatch, with the development validators on',
      ['vendor', 'key from', 'models', 'not yet curated', 'validator lines', 'verdict'],
      rows.map(row => [row.label, row.keyFrom, row.unmeasured ? '-' : String(row.models), row.unmeasured ? '-' : String(row.uncurated.length), row.unmeasured ? '-' : String(row.devLines.length),
        row.unmeasured ? 'not measured' : row.failed ? 'FAILED' : row.devLines.length || row.facts.length ? 'DRIFT' : row.uncurated.length ? 'new models' : 'as defined']),
      rows.filter(row => row.unmeasured).map(row => `${row.label}: ${row.unmeasured}`));
    failOn(rows.filter(row => row.failed).map(row => `${row.label}: ${row.failed}`));
  });

  test('no model definition is stale or unknown to its vendor', () => {
    failOn(rows.flatMap(row => row.devLines.map(line => `${row.label}: ${line.slice(0, 300)}`)), 'drift');
  });

  test('the facts the listing code relies on still hold', () => {
    failOn(rows.flatMap(row => row.facts.map(fact => `${row.label}: ${fact}`)));
  });

  test('openrouter: a key that cannot pay lists the priced models hidden, any other key lists as usual', () => {
    failOn(openRouter.map(fact => `openrouter, ${fact}`));
  });

  test('diff against the definitions', () => {
    const section = (title: string, lines: string[]) => lines.length ? `\n${title}\n${lines.map(line => `  ${line}`).join('\n')}\n` : '';
    const count = (pick: (row: Row) => unknown) => rows.filter(pick).length;
    console.log(`\nDIFF AGAINST THE DEFINITIONS   ${rows.length} listings: ${count(row => row.failed)} failed, ${count(row => row.devLines.length || row.facts.length)} with drift, ${count(row => row.uncurated.length)} with new models, ${count(row => row.unmeasured)} not measured\n`
      + section('FAILED: the listing did not come back as expected:', rows.filter(row => row.failed).map(row => `${row.label}: ${row.failed}`))
      + section('STALE OR UNKNOWN DEFINITIONS: fix with the vendor\'s llms:update-models skill:', rows.flatMap(row => row.devLines.map(line => `${row.label}: ${line.slice(0, 300)}`)))
      + section('FACTS THAT NO LONGER HOLD: the listing code relies on them:', [...rows.flatMap(row => row.facts.map(fact => `${row.label}: ${fact}`)), ...openRouter.map(fact => `openrouter, ${fact}`)])
      + section('NEW MODELS, NOT YET CURATED: listed with a "[?]" label until a definition is written:', rows.filter(row => row.uncurated.length).map(row => `${row.label} (${row.uncurated.length}): ${row.uncurated.slice(0, 12).join(', ')}${row.uncurated.length > 12 ? ', ...' : ''}`)));
  });

});
