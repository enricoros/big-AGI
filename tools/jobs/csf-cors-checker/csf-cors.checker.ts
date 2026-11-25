/// <reference types="node" />

/**
 * csf-cors-checker: Direct Connection (CSF) against the vendors' cross-origin rules, for every subsystem that can go
 * browser-direct.
 *
 * A job (tools/jobs/jobs.sh has the rules): it calls live vendors with real keys, under a cent and a few seconds,
 * and no test runner finds it on its own. To run it, once a week or after a vendor incident (Node 22.15 or newer):
 *   sh tools/jobs/jobs.sh csf-cors-checker
 *
 * What it assumes is in ASSUMPTIONS, printed first on every run. How to read it: each row sets what the code does
 * against what the vendor allows from a browser. The run fails only where the code goes direct and the vendor blocks
 * it. Every other difference is printed as a direction (could be offered, could become the default), not a failure.
 */

import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { registerHooks } from 'node:module';
import { before, describe, test } from 'node:test';

import type { AixAPI_Access, AixAPI_Model, AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DModelParameterSpecAny, DModelParameterValues } from '~/common/stores/llms/llms.parameters';
import type { ModelDescriptionSchema } from '~/modules/llms/server/llm.server.types';

import { failOn, jobKey, printTable } from '../jobs.shared';


// the page origin the requests claim: one the vendors do not know, as a self-hosted install would be
const ORIGIN = process.env.CSF_CORS_CHECKER_ORIGIN || 'http://localhost:3000';

const ASSUMPTIONS = `
1. Direct Connection works when the browser's cross-origin rules let a request through. Node has none, so this
   file enforces them on fetch: the preflight, allow-origin on the response, and which response headers a page
   may read. Its verdicts match what Chrome 158 and Firefox 160 showed on 2026-11-19 for the keyless calls tried
   there. Not covered: a real page's surroundings (extensions, proxies, private-network prompts), and Safari.
2. The code under test is the browser build: \`window\` exists, and env.server and posthog.server are replaced by
   their client mocks, the two swaps next.config.ts makes for the client bundle. Requests are built and sent by
   the functions a browser runs; the chat model is the app's own pick for short calls at that vendor.
3. What the code does today is read where the code declares it. LLM vendors: \`csfAvailable\`, and the transport
   of a newly created service. The other subsystems declare nothing, so their transport is the AS_CODED table
   in this file: keep it in step with the code.
4. Keys come from the environment or .env.api-keys, else from the registry scanner's key file
   (tools/jobs/llm-registry-sync/llm-services.json). A target without a key is probed with a made-up one, which shows the
   preflight and the error path, never a success. One vendor (Perplexity, 2026-11-18) answers errors
   readably and successes not: an error path alone proves little.`;

const CALL_TIMEOUT_MS = 60_000;
const NO_KEY = 'csf-cors-checker-no-key';


// --- LLM vendors: [vendor id, env var of the key, setup field that holds it, row label, more setup fields: the env var of each] ---

const LLM_VENDORS: readonly (readonly [vendorId: string, keyVar: string, keyField: string, label?: string, more?: Record<string, string>])[] = [
  ['alibaba', 'ALIBABA_API_KEY', 'alibabaOaiKey'],
  ['anthropic', 'ANTHROPIC_API_KEY', 'anthropicKey'],
  ['bedrock', 'BEDROCK_BEARER_TOKEN', 'bedrockBearerToken', 'bedrock (API key)', { bedrockRegion: 'BEDROCK_REGION' }],
  ['bedrock', 'BEDROCK_SECRET_ACCESS_KEY', 'bedrockSecretAccessKey', 'bedrock (IAM keys)', { bedrockAccessKeyId: 'BEDROCK_ACCESS_KEY_ID', bedrockSessionToken: 'BEDROCK_SESSION_TOKEN', bedrockRegion: 'BEDROCK_REGION' }], // signed in the browser
  ['cerebras', 'CEREBRAS_API_KEY', 'cerebrasKey'],
  ['cohere', 'COHERE_API_KEY', 'cohereKey'],
  ['deepseek', 'DEEPSEEK_API_KEY', 'deepseekKey'],
  ['googleai', 'GEMINI_API_KEY', 'geminiKey', 'gemini'],
  ['groq', 'GROQ_API_KEY', 'groqKey'],
  ['metaai', 'METAAI_API_KEY', 'metaaiKey'],
  ['mistral', 'MISTRAL_API_KEY', 'oaiKey'],
  ['modular', 'MODULAR_API_KEY', 'modularKey'],
  ['moonshot', 'MOONSHOT_API_KEY', 'moonshotKey'],
  ['moonshot', 'KIMICODE_API_KEY', 'moonshotKey', 'moonshot (Kimi Code key)'], // another host: api.kimi.com
  ['nvidianim', 'NVIDIANIM_API_KEY', 'nvidiaKey'],
  ['openai', 'OPENAI_API_KEY', 'oaiKey'],
  ['openrouter', 'OPENROUTER_API_KEY', 'oaiKey'],
  ['perplexity', 'PERPLEXITY_API_KEY', 'perplexityKey'],
  ['sakanaai', 'SAKANAAI_API_KEY', 'sakanaKey'],
  ['togetherai', 'TOGETHERAI_API_KEY', 'togetherKey'],
  ['xai', 'XAI_API_KEY', 'xaiKey'],
  ['zai', 'ZAI_API_KEY', 'zaiKey'],
];

// vendors whose endpoint is the user's own host: nothing to probe from here
const OWN_HOST_VENDORS = ['azure', 'lmstudio', 'localai', 'ollama'];


// --- The browser: cross-origin rules on fetch (Fetch standard, CORS protocol, no credentials) ---

/** One request as the page would see it: where it went, then a status, why the browser blocked it, or that the network failed (no verdict). */
type Hop = { at: string; status?: number; blocked?: string; failed?: string; notes: string[] };

const thisCall = new AsyncLocalStorage<{ hops: Hop[]; madeUpKeys: Set<string> }>(); // what one measured call did
const networkFetch = globalThis.fetch;
const preflights = new Map<string, Promise<{ blocked?: string; failed?: string; notes: string[] }>>(); // the browser's preflight cache, for the run

const SAFE_CONTENT_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
const SAFE_RESPONSE_HEADERS = ['cache-control', 'content-language', 'content-length', 'content-type', 'expires', 'last-modified', 'pragma'];
const FORBIDDEN_REQUEST_HEADERS = /^(accept-charset|accept-encoding|access-control-request-.*|connection|content-length|cookie2?|date|dnt|expect|host|keep-alive|origin|referer|set-cookie|te|trailer|transfer-encoding|upgrade|via|proxy-.*|sec-.*)$/;

const NOTE_WILDCARD = 'allow-headers is "*", which the Fetch standard does not extend to Authorization: Chrome and Firefox accept it, Safari is unchecked';
const NOTE_NO_MAX_AGE = 'no preflight max-age: one more round trip on almost every request';

const _list = (value: string | null) => (value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
const _allowsOrigin = (headers: Headers) => ['*', ORIGIN].includes(headers.get('access-control-allow-origin') ?? '');

async function _preflight(url: URL, method: string, unsafeHeaders: string[], signal?: AbortSignal | null): Promise<{ blocked?: string; failed?: string; notes: string[] }> {
  let response: Response;
  try {
    response = await networkFetch(url, {
      method: 'OPTIONS',
      headers: { 'Origin': ORIGIN, 'Access-Control-Request-Method': method, ...(unsafeHeaders.length && { 'Access-Control-Request-Headers': unsafeHeaders.join(',') }) },
      signal,
    });
    await response.body?.cancel();
  } catch (error: any) {
    return { failed: `the preflight got no response (${error?.cause?.code || error?.name || 'error'})`, notes: [] };
  }
  if (!response.ok) return { blocked: `the preflight answered HTTP ${response.status}`, notes: [] };
  if (!_allowsOrigin(response.headers)) return { blocked: 'the preflight carries no allow-origin', notes: [] };
  const allowMethods = _list(response.headers.get('access-control-allow-methods'));
  if (!['GET', 'HEAD', 'POST'].includes(method) && !allowMethods.includes(method.toLowerCase()) && !allowMethods.includes('*'))
    return { blocked: `the preflight does not allow ${method}`, notes: [] };
  const allowHeaders = _list(response.headers.get('access-control-allow-headers'));
  const refused = allowHeaders.includes('*') ? [] : unsafeHeaders.filter(name => !allowHeaders.includes(name));
  if (refused.length) return { blocked: `the preflight does not allow the header ${refused.join(', ')}`, notes: [] };
  return {
    notes: [
      ...(unsafeHeaders.includes('authorization') && !allowHeaders.includes('authorization') ? [NOTE_WILDCARD] : []),
      ...(response.headers.get('access-control-max-age') ? [] : [NOTE_NO_MAX_AGE]),
    ],
  };
}

/** fetch as a page on ORIGIN: throws Chrome's TypeError where the browser would block, and hides the response headers a page cannot read. */
async function browserFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input);
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const hop: Hop = { at: `${method} ${url.host}${url.pathname}`, notes: [] }; // no query: Gemini carries the key there
  thisCall.getStore()?.hops.push(hop);
  const block = (reason: string) => {
    hop.blocked = reason;
    return new TypeError('Failed to fetch');
  };

  // a page cannot set the forbidden names; the others need the server's permission unless safelisted
  const unsafeHeaders: string[] = [];
  for (const [name, value] of [...headers]) {
    if (FORBIDDEN_REQUEST_HEADERS.test(name)) headers.delete(name);
    else if (['accept', 'accept-language', 'content-language'].includes(name)) continue;
    else if (name === 'content-type' && SAFE_CONTENT_TYPES.includes(value.split(';')[0].trim().toLowerCase())) continue;
    else unsafeHeaders.push(name);
  }
  unsafeHeaders.sort();

  if (unsafeHeaders.length || !['GET', 'HEAD', 'POST'].includes(method)) {
    const cacheKey = `${method} ${url.origin}${url.pathname} ${unsafeHeaders.join(',')}`;
    if (!preflights.has(cacheKey)) preflights.set(cacheKey, _preflight(url, method, unsafeHeaders, init?.signal));
    const preflight = await preflights.get(cacheKey)!;
    hop.notes.push(...preflight.notes);
    if (preflight.blocked) throw block(preflight.blocked);
    if (preflight.failed) throw new Error(hop.failed = preflight.failed);
  }

  headers.set('Origin', ORIGIN);
  let response: Response;
  try {
    response = await networkFetch(input instanceof Request ? input : url, { ...init, headers });
  } catch (error: any) {
    if (error?.name !== 'AbortError' && error?.name !== 'TimeoutError') hop.failed = `no response (${error?.cause?.code || error?.name || 'error'})`;
    throw error;
  }
  hop.status = response.status;
  if (!_allowsOrigin(response.headers)) {
    await response.body?.cancel();
    throw block(`the HTTP ${response.status} response carries no allow-origin, so the page cannot read it`);
  }
  const exposed = _list(response.headers.get('access-control-expose-headers'));
  const readable = new Headers();
  response.headers.forEach((value, name) => (SAFE_RESPONSE_HEADERS.includes(name) || exposed.includes('*') || exposed.includes(name)) && readable.append(name, value));
  return new Response([101, 204, 205, 304].includes(response.status) ? null : response.body, { status: response.status, statusText: response.statusText, headers: readable });
}


// --- Measuring: one call of the app's own code, seen through the browser's rules ---

/** works: the app got its result. readable: the vendor answered with an error the page can read. blocked: the browser stopped it. */
type Cell = { state: 'works' | 'readable' | 'blocked' | 'unmeasured'; text: string; notes: string[] };

const UNMEASURED = (text: string): Cell => ({ state: 'unmeasured', text, notes: [] });

const knownKeys = new Set<string>();
const _key = (envVar: string) => {
  const key = jobKey(envVar)?.value;
  if (key) knownKeys.add(key);
  return key;
};
/** The key for a measured call, or a made-up one: that call then shows the preflight and the error path only, and says so. */
const _keyOrMadeUp = (envVar: string) => {
  const key = _key(envVar);
  if (!key) thisCall.getStore()?.madeUpKeys.add(envVar);
  return key ?? NO_KEY;
};
const _wrongKey = (key: string) => key.slice(0, -6) + (key.endsWith('zzzzzz') ? 'yyyyyy' : 'zzzzzz'); // well-formed and unknown to the vendor: what a revoked key looks like
const _printable = (text: string) => {
  const clean = [...knownKeys].reduce((out, key) => out.replaceAll(key, '(key)'), text).replace(/\*\*/g, '').replace(/\s+/g, ' ');
  return clean.length > 160 ? `${clean.slice(0, 160)}...` : clean;
};

async function measure(run: (signal: AbortSignal) => Promise<string>): Promise<Cell> {
  const hops: Hop[] = [], madeUpKeys = new Set<string>();
  const signal = AbortSignal.timeout(CALL_TIMEOUT_MS);
  const notes = () => [...new Set(hops.flatMap(hop => hop.notes))];
  try {
    return { state: 'works', text: await thisCall.run({ hops, madeUpKeys }, () => run(signal)), notes: notes() };
  } catch (error: any) {
    const blocked = hops.find(hop => hop.blocked);
    if (blocked) return { state: 'blocked', text: `${blocked.at}: ${blocked.blocked}`, notes: notes() };
    if (signal.aborted) return UNMEASURED(`no answer in ${CALL_TIMEOUT_MS / 1000} s`);
    const failed = hops.find(hop => hop.failed);
    if (failed) return UNMEASURED(`${failed.at}: ${failed.failed}`);
    const statuses = [...new Set(hops.map(hop => hop.status).filter(Boolean))];
    if (!statuses.length) return UNMEASURED(_printable(error?.message ?? String(error)));
    const why = madeUpKeys.size ? `to a made-up key (no ${[...madeUpKeys].join(', ')})` : _printable(error?.message ?? String(error));
    return { state: 'readable', text: `HTTP ${statuses.join(', ')}: ${why}`, notes: notes() };
  }
}


/** The browser build of the app's code: ASSUMPTIONS 2. The imports are dynamic because the swaps must be in place first. */
async function bootBrowserBuild() {
  if (typeof registerHooks !== 'function') throw new Error(`needs Node 22.15 or newer (module.registerHooks), this is ${process.version}`);
  Object.assign(globalThis, { window: globalThis, location: new URL(ORIGIN) });
  globalThis.fetch = browserFetch as typeof fetch;
  registerHooks({
    resolve: (specifier, context, nextResolve) =>
      nextResolve(specifier.replace(/\/env\.server$/, '/env.client-mock').replace(/\/posthog\.server$/, '/posthog.client-mock'), context),
  });
  const [registry, editorial, parameters, aixClient, listing, chat, speex, asrx, openai, anthropic, gemini, geminiFiles, geminiWire] = await Promise.all([
    import('~/modules/llms/vendors/vendors.registry'),
    import('~/common/stores/llms/model.domains.editorial'),
    import('~/common/stores/llms/llms.parameters'),
    import('~/modules/aix/client/aix.client'),
    import('~/modules/llms/llm.client.direct-listModels'),
    import('~/modules/aix/client/aix.client.direct-chatGenerate'),
    import('~/modules/speex/protocols/rpc/synthesize.core'),
    import('~/modules/asrx/protocols/batch/transcribe.core'),
    import('~/modules/llms/server/openai/openai.access'),
    import('~/modules/llms/server/anthropic/anthropic.access'),
    import('~/modules/llms/server/gemini/gemini.access'),
    import('~/modules/llms/vendors/gemini/geminiFiles.client'),
    import('~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes'),
  ]);
  return { ...registry, ...editorial, ...parameters, ...aixClient, ...listing, ...chat, ...speex, ...asrx, ...openai, ...anthropic, ...gemini, ...geminiFiles, ...geminiWire };
}

type App = Awaited<ReturnType<typeof bootBrowserBuild>>;


// --- LLMs and AIX: per vendor, the listing and one short chat through the direct entry points ---

const CHAT: AixAPIChatGenerate_Request = { systemMessage: null, chatSequence: [{ role: 'user', parts: [{ pt: 'text', text: 'Reply with the word: ok' }] }] };

/**
 * The next model to try for a short call at this vendor, with the request options the app would send: the app's
 * editorial pick for utility calls among the models not tried yet, else the cheapest paid chat model (free tiers
 * are the ones that rate-limit a probe), built with the listing's parameter defaults. No listing: an unknown
 * model, which still shows the preflight and the error path.
 */
function nextChatModel(app: App, vendorId: string, models: ModelDescriptionSchema[], tried: ReadonlySet<string>): AixAPI_Model | undefined {
  if (!models.length) return tried.size ? undefined : { id: 'csf-cors-checker-probe', acceptsOutputs: ['text'], temperature: null };
  const untried = models.filter(model => !tried.has(model.id));
  const universe = untried.map(model => ({ id: model.id, vId: vendorId, initialParameters: { llmRef: model.id }, hidden: !!model.hidden }) as Pick<DLLM, 'id' | 'vId' | 'initialParameters' | 'hidden' | 'userHidden'>);
  const price = ({ chatPrice }: ModelDescriptionSchema) => {
    const output = Array.isArray(chatPrice?.output) ? chatPrice.output[0]?.price : chatPrice?.output;
    return typeof output === 'number' && output > 0 ? output : output === undefined ? 1e6 : 1e9;
  };
  const editorialId = app.llmsEditorial_ModelIdForDomain_SLOW(['fastUtil', 'primaryChat'], universe);
  const picked = untried.find(model => model.id === editorialId) ?? untried
    .filter(model => !model.hidden && model.interfaces.includes('oai-chat') && !['gem-interactions', 'outputs-image', 'outputs-audio'].some(other => model.interfaces.includes(other)))
    .sort((a, b) => price(a) - price(b) || a.id.localeCompare(b.id))[0];
  if (!picked) return undefined;

  const options: DModelParameterValues = { llmRef: picked.id, llmTemperature: null, ...(picked.maxCompletionTokens && { llmResponseTokens: picked.maxCompletionTokens }) };
  app.applyModelParameterSpecsInitialValues(options, (picked.parameterSpecs ?? []) as DModelParameterSpecAny[], false);
  return app.aixCreateModelFromLLMParameters(options, picked.interfaces as DLLM['interfaces'], picked.id);
}

async function chatOnce(app: App, access: AixAPI_Access, model: AixAPI_Model, signal: AbortSignal): Promise<string> {
  let issue = '';
  for await (const particle of app.clientSideChatGenerate(access, model, CHAT, { method: 'chat-generate', name: 'conversation', ref: 'csf-cors-checker' }, true, {}, signal))
    if ('cg' in particle && particle.cg === 'issue') issue = particle.issueText;
  signal.throwIfAborted(); // the direct generator ends quietly on abort
  if (issue) throw new Error(`${model.id}: ${issue}`);
  return model.id;
}

type LlmRow = { label: string; offered: boolean; defaultOn: boolean; list: Cell; chat: Cell; revoked: Cell };

async function measureLlmVendor(app: App, [vendorId, keyVar, keyField, label = vendorId, more = {}]: typeof LLM_VENDORS[number]): Promise<LlmRow> {
  const vendor = app.findModelVendor<Record<string, unknown>>(vendorId as Parameters<App['findModelVendor']>[0])!;
  const key = _key(keyVar);
  const moreSetup = Object.fromEntries(Object.entries(more).map(([field, envVar]) => [field, _key(envVar)]).filter(([, value]) => value));
  const setup = { ...vendor.initializeSetup?.(), ...moreSetup, [keyField]: key ?? NO_KEY };
  // forced on, whatever csfAvailable says: this is the request the browser sends once the flag is set
  const accessWith = (theKey: string) => ({ ...vendor.getTransportAccess({ ...setup, [keyField]: theKey, csf: true }), clientSideFetch: true }) as AixAPI_Access;

  let models: ModelDescriptionSchema[] = [];
  const list = !key ? UNMEASURED(`no ${keyVar}`) : await measure(async signal => {
    models = (await app.clientSideListModels(accessWith(key), signal)).models;
    return `${models.length} models`;
  });
  // the app's pick first; a readable refusal (an account without that model) moves on to the next one, a few times
  const tried = new Set<string>();
  let model!: AixAPI_Model, chat!: Cell;
  for (let next = nextChatModel(app, vendorId, models, tried); next && tried.size < 4; next = nextChatModel(app, vendorId, models, tried)) {
    tried.add((model = next).id);
    chat = await measure(signal => chatOnce(app, accessWith(_keyOrMadeUp(keyVar)), next, signal));
    if (chat.state !== 'readable') break;
  }
  const revoked = !key || chat.state === 'blocked' ? UNMEASURED('-') : await measure(signal => chatOnce(app, accessWith(_wrongKey(key)), model, signal));

  return {
    label,
    offered: !!vendor.csfAvailable?.(setup), // with a key in place: can this service be switched to direct
    defaultOn: !!vendor.getTransportAccess(setup).clientSideFetch, // a newly created service, key entered, nothing toggled
    list, chat, revoked,
  };
}


// --- The other subsystems: their transport as coded today (ASSUMPTIONS 3), and one call each ---

type AsCodedRow = {
  subsystem: 'speex' | 'asrx' | 't2i' | 'files';
  label: string;
  coded: 'direct' | 'server'; // direct: the browser calls the vendor today, always or when the linked LLM service is direct
  when: string;
  run: (app: App, signal: AbortSignal) => Promise<string>;
};

/** One second of silence, 16 kHz mono 16-bit: a valid input for the transcription endpoints. */
function silentWav(): Uint8Array {
  const samples = 16_000, bytes = new Uint8Array(44 + samples * 2), view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => [...text].forEach((char, i) => bytes[offset + i] = char.charCodeAt(0));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); ascii(8, 'WAVEfmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16_000, true); view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, samples * 2, true);
  return bytes;
}

/**
 * For what the app has no direct path for: a request built by the app's access code, sent as a page would, naming
 * nothing real so it costs nothing. The vendor refuses it; what counts is whether the page can read the refusal.
 */
async function sendAsPage(request: { url: string; headers: HeadersInit }, method: 'GET' | 'POST', body?: object): Promise<string> {
  const response = await fetch(request.url, { method, headers: request.headers, ...(body && { body: JSON.stringify(body) }) });
  await response.body?.cancel();
  if (!response.ok) throw new Error('the probe request, which names nothing real, was refused');
  return `HTTP ${response.status}`;
}

async function speak(app: App, input: Parameters<App['speexRpcCoreSynthesize']>[0], signal: AbortSignal): Promise<string> {
  let gotAudio = false;
  for await (const particle of app.speexRpcCoreSynthesize(input, signal)) {
    if (particle.t === 'error') throw new Error(particle.e);
    if (particle.t === 'audio') gotAudio = true;
  }
  if (!gotAudio) throw new Error('no audio came back');
  return 'audio';
}

const _openai = (app: App, dialect: 'openai' | 'openrouter', keyVar: string, path: string) =>
  app.openAIAccess({ dialect, clientSideFetch: true, oaiKey: _keyOrMadeUp(keyVar), oaiOrg: '', oaiHost: '' }, null, path);
const _geminiAccess = () =>
  ({ dialect: 'gemini', clientSideFetch: true, geminiKey: _keyOrMadeUp('GEMINI_API_KEY'), geminiHost: '', minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED' }) as const;

const AS_CODED: AsCodedRow[] = [

  // Speex (speech): rpc.client.ts, _shouldUseCSF
  {
    subsystem: 'speex', label: 'openai', coded: 'direct', when: 'when the linked OpenAI service is',
    run: (app, signal) => speak(app, { access: { dialect: 'openai', apiKey: _keyOrMadeUp('OPENAI_API_KEY') }, text: 'ok', voice: { dialect: 'openai' }, streaming: false }, signal),
  },
  {
    subsystem: 'speex', label: 'gemini', coded: 'direct', when: 'when the linked Gemini service is',
    run: (app, signal) => speak(app, { access: { dialect: 'gemini', apiKey: _keyOrMadeUp('GEMINI_API_KEY'), clientSideFetch: true }, text: 'ok', voice: { dialect: 'gemini' }, streaming: false }, signal),
  },
  {
    subsystem: 'speex', label: 'elevenlabs', coded: 'server', when: 'always',
    run: async (app) => `${(await app.speexRpcCoreListVoices({ dialect: 'elevenlabs', apiKey: _keyOrMadeUp('ELEVENLABS_API_KEY') })).voices.length} voices`,
  },
  {
    subsystem: 'speex', label: 'inworld', coded: 'server', when: 'always, "blocked CORS policy"',
    run: async (app) => `${(await app.speexRpcCoreListVoices({ dialect: 'inworld', apiKey: _keyOrMadeUp('INWORLD_API_KEY') })).voices.length} voices`,
  },

  // ASRx (transcription): batch.client.ts, there is no server route
  ...(['openai', 'gemini', 'deepgram'] as const).map((dialect): AsCodedRow => ({
    subsystem: 'asrx', label: dialect, coded: 'direct', when: 'always, no server route',
    run: async (app, signal) => {
      const apiKey = _keyOrMadeUp(`${dialect.toUpperCase()}_API_KEY`);
      return (await app.asrxBatchCoreTranscribe({ access: { dialect, apiKey }, profile: { dialect }, audio: silentWav(), mimeType: 'audio/wav', signal })).model;
    },
  })),
  // AssemblyAI: one row per API, each on its own host (Auto is Sync)
  ...([undefined, 'dictation', 'prerecorded'] as const).map((api): AsCodedRow => ({
    subsystem: 'asrx', label: `assemblyai ${api ?? 'sync'}`, coded: 'direct', when: 'always, no server route',
    run: async (app, signal) => {
      const access = { dialect: 'assemblyai', apiKey: _keyOrMadeUp('ASSEMBLYAI_API_KEY') } as const;
      return (await app.asrxBatchCoreTranscribe({ access, profile: { dialect: 'assemblyai', ...(api && { api }) }, audio: silentWav(), mimeType: 'audio/wav', signal })).model;
    },
  })),

  // T2I (images): the tRPC createImages procedures, there is no direct path
  {
    subsystem: 't2i', label: 'openai', coded: 'server', when: 'always',
    run: (app) => sendAsPage(_openai(app, 'openai', 'OPENAI_API_KEY', app.OPENAI_API_PATHS.images), 'POST', { model: 'csf-cors-checker-probe', prompt: 'x' }),
  },
  {
    subsystem: 't2i', label: 'gemini', coded: 'server', when: 'always',
    run: (app) => sendAsPage(app.geminiAccess(_geminiAccess(), 'models/csf-cors-checker-probe', app.GeminiWire_API_Generate_Content.postPath, false), 'POST', { contents: [{ role: 'user', parts: [{ text: 'x' }] }] }),
  },
  {
    subsystem: 't2i', label: 'openrouter', coded: 'server', when: 'always',
    run: (app) => sendAsPage(_openai(app, 'openrouter', 'OPENROUTER_API_KEY', app.OPENROUTER_API_PATHS.images), 'POST', { model: 'csf-cors-checker-probe', prompt: 'x' }),
  },

  // Files and containers that a chat touches
  {
    subsystem: 'files', label: 'anthropic files', coded: 'server', when: 'always, the inline-file companion is csfUnsafe',
    run: (app) => sendAsPage(app.anthropicAccess({ dialect: 'anthropic', clientSideFetch: true, anthropicKey: _keyOrMadeUp('ANTHROPIC_API_KEY'), anthropicHost: null }, `${app.ANTHROPIC_API_PATHS.files}/csf-cors-checker-probe/content`), 'GET'),
  },
  {
    subsystem: 'files', label: 'gemini files', coded: 'direct', when: 'when the Gemini service is',
    run: async (app) => (await app.geminiFileGetMetadata(_geminiAccess(), 'files/csf-cors-checker-probe')).name,
  },
  {
    subsystem: 'files', label: 'openai containers', coded: 'direct', when: 'when the OpenAI service is, by the keep-alive companion',
    run: (app) => sendAsPage(_openai(app, 'openai', 'OPENAI_API_KEY', `${app.OPENAI_API_PATHS.containers}/csf-cors-checker-probe`), 'GET'),
  },
];


// --- The verdict: what the code does against what was measured ---

type Verdict = {
  kind:
    | 'broken'        // direct in the code, blocked at the vendor: the only failure
    | 'could-offer'   // not direct in the code, open at the vendor
    | 'default-ready' // offered, off by default, nothing measured stands in the way of a default
    | 'default-caveat'// offered, off by default, works, with something to settle first
    | 'unmeasured'
    | 'same';
  text: string;
};

function llmVerdict({ offered, defaultOn, list, chat, revoked }: LlmRow): Verdict {
  const blocked = [chat, list].find(cell => cell.state === 'blocked');
  const direct = offered || defaultOn;
  if (blocked) return direct
    ? { kind: 'broken', text: `${defaultOn ? 'direct by default' : 'offered'}, but ${blocked === chat ? 'chat' : 'listing'} is blocked. ${blocked.text}` }
    : { kind: 'same', text: 'server only, as coded' };
  if (chat.state === 'unmeasured') return { kind: 'unmeasured', text: chat.text };
  if (!direct) return { kind: 'could-offer', text: chat.state === 'works' ? 'listing and chat work' : 'preflight and error path pass, no success measured' };
  if (defaultOn) return { kind: 'same', text: 'direct by default, works' };
  const caveats = [
    ...(chat.state !== 'works' ? [`no completed chat in this run (${chat.text})`] : []),
    ...(revoked.state === 'blocked' ? ['a revoked key is unreadable, it shows as "could not connect"'] : []),
    ...([list, chat].some(cell => cell.notes.includes(NOTE_WILDCARD)) ? ['needs a check in Safari (allow-headers "*" with Authorization)'] : []),
  ];
  return caveats.length ? { kind: 'default-caveat', text: caveats.join('; ') } : { kind: 'default-ready', text: 'listing, chat and a revoked key all pass' };
}

function asCodedVerdict({ coded, cell }: AsCodedRow & { cell: Cell }): Verdict {
  if (cell.state === 'blocked') return coded === 'direct' ? { kind: 'broken', text: `direct in the code, but blocked. ${cell.text}` } : { kind: 'same', text: 'server only, as coded' };
  if (cell.state === 'unmeasured') return { kind: 'unmeasured', text: cell.text };
  const proof = cell.state === 'works' ? 'works' : 'preflight and error path pass, no success measured';
  return coded === 'direct' ? { kind: 'same', text: `direct, ${proof}` } : { kind: 'could-offer', text: proof };
}


// --- The run ---

const CELL_WORDS = { works: 'works', readable: 'readable error', blocked: 'BLOCKED', unmeasured: '-' } as const;
const VERDICT_WORDS: Record<Verdict['kind'], string> = {
  'broken': 'BROKEN', 'could-offer': 'could be offered', 'default-ready': 'ready for a default', 'default-caveat': 'caveat before a default', 'unmeasured': 'not measured', 'same': 'as coded',
};

describe('csf-cors-checker: Direct Connection against the vendors\' cross-origin rules', () => {

  let app: App;
  let llmRows: LlmRow[];
  let otherRows: (AsCodedRow & { cell: Cell })[];

  before(async () => {
    // the app logs every refused request and retry: silence it while measuring, the tables carry the outcome
    const { log, warn, error } = console;
    console.log = console.warn = console.error = () => {};
    try {
      app = await bootBrowserBuild();
      [llmRows, otherRows] = await Promise.all([
        Promise.all(LLM_VENDORS.map(vendorRow => measureLlmVendor(app, vendorRow))),
        Promise.all(AS_CODED.map(async row => ({ ...row, cell: await measure(signal => row.run(app, signal)) }))),
      ]);
    } finally {
      Object.assign(console, { log, warn, error });
    }
  }, { timeout: 10 * CALL_TIMEOUT_MS });

  test('assumptions, and every vendor has a row', () => {
    console.log(`csf-cors-checker, ${new Date().toLocaleDateString('en-CA')}, as a page on ${ORIGIN}, node ${process.version}\n\nASSUMES${ASSUMPTIONS}`);
    const listed = new Set<string>([...LLM_VENDORS.map(([vendorId]) => vendorId), ...OWN_HOST_VENDORS]);
    assert.deepEqual(app.findAllModelVendors().map(vendor => vendor.id).filter(id => !listed.has(id)), [], 'vendors in the registry without a row in LLM_VENDORS');
  });

  test('llms + aix: no vendor that is offered direct is blocked', () => {
    const cell = (c: Cell) => c.state === 'works' ? `works (${c.text})` : CELL_WORDS[c.state];
    printTable('LLMS + AIX   csfAvailable and the new-service transport are read from the vendor registry; list and chat run the direct entry points',
      ['vendor', 'csfAvailable', 'new service', 'list models', 'chat', 'revoked key', 'verdict'],
      llmRows.map(row => [row.label, row.offered ? 'yes' : 'no', row.defaultOn ? 'direct' : 'via server', cell(row.list), cell(row.chat),
        { works: 'accepted', readable: 'readable', blocked: 'UNREADABLE', unmeasured: '-' }[row.revoked.state], VERDICT_WORDS[llmVerdict(row).kind]]),
      llmRows.flatMap(row => (['list', 'chat'] as const).filter(step => !['works', 'blocked'].includes(row[step].state) && row[step].text !== '-').map(step => `${row.label}, ${step}: ${row[step].text}`)));
    failOn(llmRows.map(row => [row.label, llmVerdict(row)] as const).filter(([, verdict]) => verdict.kind === 'broken').map(([label, verdict]) => `${label}: ${verdict.text}`));
  });

  for (const subsystem of ['speex', 'asrx', 't2i', 'files'] as const)
    test(`${subsystem}: nothing that goes direct is blocked`, () => {
      const rows = otherRows.filter(row => row.subsystem === subsystem);
      printTable(`${subsystem.toUpperCase()}   transport as coded: the AS_CODED table in this file`,
        ['target', 'as coded', 'measured', 'verdict'],
        rows.map(row => [row.label, `${row.coded}, ${row.when}`, row.cell.state === 'works' ? `works (${row.cell.text})` : CELL_WORDS[row.cell.state], VERDICT_WORDS[asCodedVerdict(row).kind]]),
        rows.filter(row => row.cell.state === 'readable' || row.cell.state === 'unmeasured').map(row => `${row.label}: ${row.cell.text}`));
      failOn(rows.filter(row => asCodedVerdict(row).kind === 'broken').map(row => `${row.label}: ${asCodedVerdict(row).text}`));
    });

  test('diff against the code', () => {
    const all = [
      ...llmRows.map(row => ({ name: row.label, verdict: llmVerdict(row), notes: [...row.list.notes, ...row.chat.notes] })),
      ...otherRows.map(row => ({ name: `${row.subsystem} ${row.label}`, verdict: asCodedVerdict(row), notes: row.cell.notes })),
    ];
    const section = (kind: Verdict['kind'], title: string, oneLine: boolean) => {
      const rows = all.filter(row => row.verdict.kind === kind);
      if (!rows.length) return '';
      // rows that share a reason are listed together
      const byText = Map.groupBy(rows, row => row.verdict.text);
      return `\n${title}\n${[...byText].map(([text, group]) => oneLine ? `  ${group.map(row => row.name).join(', ')}: ${text}` : group.map(row => `  ${row.name}: ${text}`).join('\n')).join('\n')}\n`;
    };
    const counts = (Object.keys(VERDICT_WORDS) as Verdict['kind'][]).map(kind => `${all.filter(row => row.verdict.kind === kind).length} ${VERDICT_WORDS[kind].toLowerCase()}`).filter(count => !count.startsWith('0 '));
    const noMaxAge = all.filter(row => row.notes.includes(NOTE_NO_MAX_AGE)).map(row => row.name);
    console.log(`\nDIFF AGAINST THE CODE   ${all.length} rows: ${counts.join(', ')}\n`
      + section('broken', 'BROKEN: direct in the code, blocked at the vendor. Stop offering it, or get the vendor to fix it:', false)
      + section('could-offer', 'COULD BE OFFERED: not direct in the code, open at the vendor:', true)
      + section('default-ready', 'READY FOR A DEFAULT: offered, off for a new service, and nothing measured stands in the way:', true)
      + section('default-caveat', 'WORKS, WITH A CAVEAT BEFORE A DEFAULT: offered, off for a new service:', true)
      + section('unmeasured', 'NOT MEASURED:', true)
      + (noMaxAge.length ? `\nNOTE: ${NOTE_NO_MAX_AGE}: ${noMaxAge.join(', ')}\n` : ''));
  });

});
