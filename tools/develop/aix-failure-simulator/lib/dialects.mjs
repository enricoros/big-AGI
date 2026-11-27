// The wire grammars the service speaks. A dialect knows four things about its vendor: which requests are its
// generations, how a model list entry looks, what body comes with an HTTP status, and a few hand-built scenarios for
// answers no capture shows. Everything else (captures, defects, routing, arming) is the service's.
//
// A scenario is a function ({ model, streaming, hit, capture }) => plan, or null when it has no answer in that mode.
//   plan     { stream: boolean, chunks: string[], pace?: ms between chunks, slow?: true (the pace is the point: kept
//            when the service runs fast), hang?: true (the body never ends) }
//   hit      the count of requests for this model id, from 1: what a scenario that changes over attempts reads
//   capture  (file) => the text of a capture, or null: for a scenario derived from one
//
// To add a dialect: one object in DIALECTS. To add a scenario: one function in its `scenarios`.
import { sseEvents } from './captures.mjs';

const WORDS = 'The quick brown fox jumps over the lazy dog, twice, then rests under the old oak tree.'.split(' ');
const TEXT = WORDS.join(' ');
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const NOT_A_PNG = Buffer.from('These bytes are words, not an image: the client cannot decode them.').toString('base64');

const streamed = (chunks, extra = {}) => ({ stream: true, chunks, pace: 40, ...extra });
const whole = (body) => ({ stream: false, chunks: [typeof body === 'string' ? body : JSON.stringify(body)] });


// --- OpenAI Chat Completions ---

const CHAT_USAGE = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 };
const SERVER_ERROR = { message: 'The server had an error while processing your request. Sorry about that!', type: 'server_error', param: null, code: 'server_error' };
const chatChunk = (model, delta, finish = null, extra = {}) =>
  `data: ${JSON.stringify({ id: 'chatcmpl-sim', object: 'chat.completion.chunk', created: 1700000000, model, choices: [{ index: 0, delta, finish_reason: finish }], ...extra })}\n\n`;
const chatSay = (model, from = 0, to = WORDS.length) =>
  WORDS.slice(from, to).map((word, i) => chatChunk(model, from + i === 0 ? { role: 'assistant', content: word } : { content: ' ' + word }));
const chatFinish = (model, reason) => chatChunk(model, {}, reason, { usage: CHAT_USAGE });
const CHAT_DONE = 'data: [DONE]\n\n';
const CHAT_ERROR = `data: ${JSON.stringify({ error: SERVER_ERROR })}\n\n`;
const chatWhole = (model, finish_reason, message = {}) =>
  whole({ id: 'chatcmpl-sim', object: 'chat.completion', created: 1700000000, model, choices: [{ index: 0, message: { role: 'assistant', content: TEXT, ...message }, finish_reason }], usage: CHAT_USAGE });
const chatImage = (b64) => [{ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } }];

/** What OpenAI sends with a status; other statuses get a plain server error */
function openaiError(status, model = 'the model') {
  const bodies = {
    401: { message: 'Incorrect API key provided: sk-sim. You can find your API key at https://platform.example.com/account/api-keys.', type: 'invalid_request_error', param: null, code: 'invalid_api_key' },
    402: { message: 'Insufficient credits. Add more using https://example.com/settings/credits', code: 402 },
    403: { message: 'Country, region, or territory not supported', type: 'request_forbidden', code: 'unsupported_country_region_territory' },
    404: { message: `The model \`${model}\` does not exist or you do not have access to it.`, type: 'invalid_request_error', param: null, code: 'model_not_found' },
    429: { message: 'Rate limit reached for sim-model in organization org-sim on requests per min (RPM): Limit 3, Used 3, Requested 1. Please try again in 1s.', type: 'requests', param: null, code: 'rate_limit_exceeded' },
    500: { message: 'The server had an error while processing your request. Sorry about that!', type: 'server_error', param: null, code: null },
    503: { message: 'The engine is currently overloaded, please try again later', type: 'service_unavailable', code: 'overloaded' },
  };
  if (status === 413) return { body: 'Request Entity Too Large' };
  return { body: { error: bodies[status] ?? { message: `The service answered ${status}.`, type: 'server_error', param: null, code: null } }, ...(status === 429 && { headers: { 'retry-after': '1' } }) };
}
const openaiModel = (id) => ({ id, object: 'model', created: 1700000000, owned_by: 'aix-failure-simulator' });
const openaiLists = (req, url) => req.method === 'GET' && url.pathname.endsWith('/models') && !req.headers['anthropic-version'] && !/\/v1(beta|alpha)\//.test(url.pathname);
const openaiList = (models) => ({ object: 'list', data: models });

const openaiChat = {
  id: 'openai-chat',
  service: 'OpenAI', // the service to add in the app, API host = the simulator
  prefix: 'sim-',
  vendors: ['openrouter'], // the capture folders in this grammar
  own: 'openai', // the one whose captures this service lists in the app; the others are reached by id (the driver uses their own dialect)
  generation: (req, url, body) => req.method === 'POST' && url.pathname.endsWith('/chat/completions') ? { model: String(body.model ?? ''), streaming: body.stream === true } : null,
  lists: openaiLists, list: openaiList, model: openaiModel,
  error: openaiError,
  scenarios: {
    'ok': ({ model, streaming }) => streaming ? streamed([...chatSay(model), chatFinish(model, 'stop'), CHAT_DONE]) : chatWhole(model, 'stop'),
    'length': ({ model, streaming }) => streaming ? streamed([...chatSay(model, 0, 6), chatFinish(model, 'length'), CHAT_DONE]) : chatWhole(model, 'length'),
    'filter': ({ model, streaming }) => streaming ? streamed([...chatSay(model, 0, 4), chatFinish(model, 'content_filter'), CHAT_DONE]) : chatWhole(model, 'content_filter'),
    // text and `[DONE]` with no finish reason / `[DONE]` alone
    'no-finish': ({ model, streaming }) => streaming ? streamed([...chatSay(model, 0, 6), CHAT_DONE]) : null,
    'empty': ({ streaming }) => streaming ? streamed([CHAT_DONE]) : null,
    // an in-stream error after four words / as the first event (the operation retrier's case) / after the finish
    'stream-error': ({ model, streaming }) => streaming ? streamed([...chatSay(model, 0, 4), CHAT_ERROR, CHAT_DONE]) : null,
    'stream-error-first': ({ streaming }) => streaming ? streamed([CHAT_ERROR, CHAT_DONE]) : null,
    'late-error': ({ model, streaming }) => streaming ? streamed([...chatSay(model), chatFinish(model, 'stop'), CHAT_ERROR, CHAT_DONE]) : null,
    // valid JSON that fails the schema (the defect `garbage` sends what is not JSON at all)
    'bad-schema': ({ model, streaming }) => streaming ? streamed([...chatSay(model, 0, 4), 'data: {"id": "chatcmpl-sim", "choices": [{"index": 0, "delta": {"content": 42}}]}\n\n', CHAT_DONE]) : null,
    // one word a second for two minutes: for a Stop, or a hidden tab
    'slow': ({ model, streaming }) => streaming ? streamed([...Array.from({ length: 120 }, (_, i) => chatChunk(model, { content: (i ? ' ' : '') + 'tick' + i })), chatFinish(model, 'stop'), CHAT_DONE], { pace: 1000, slow: true }) : null,
    // an inline image among the text (OpenRouter's grammar), decodable or not; an audio stream whose data is not base64
    'image': ({ model, streaming }) => streaming ? streamed([...chatSay(model, 0, 6), chatChunk(model, { images: chatImage(PNG_1PX) }), ...chatSay(model, 6), chatFinish(model, 'stop'), CHAT_DONE]) : chatWhole(model, 'stop', { images: chatImage(PNG_1PX) }),
    'bad-image': ({ model, streaming }) => streaming ? streamed([...chatSay(model, 0, 6), chatChunk(model, { images: chatImage(NOT_A_PNG) }), ...chatSay(model, 6), chatFinish(model, 'stop'), CHAT_DONE]) : chatWhole(model, 'stop', { images: chatImage(NOT_A_PNG) }),
    'bad-audio': ({ model, streaming }) => streaming ? streamed([...chatSay(model, 0, 4), chatChunk(model, { audio: { id: 'audio_sim' } }), chatChunk(model, { audio: { data: '%%% not base64 %%%' } }), chatChunk(model, { audio: { transcript: 'hello', expires_at: 1700003600 } }), chatFinish(model, 'stop'), CHAT_DONE]) : null,
  },
};


// --- OpenAI Responses ---

// No capture is a plain clean answer, so `ok` is made from one that stopped at the output limit: the same events, completed
const RESPONSES_TEXT = 'openai/gpt-6-luna_incomplete-max-output-tokens-mid-text';
const completedItem = (item) => ({ ...item, status: 'completed' });
const completedResponse = (response) => ({ ...response, status: 'completed', incomplete_details: null, completed_at: response.created_at + 1, output: (response.output ?? []).map(completedItem) });

function responsesOk({ streaming, capture }) {
  const text = capture(RESPONSES_TEXT + (streaming ? '.sse' : '_nonstream.json'));
  if (!text) return null;
  if (!streaming) return whole(completedResponse(JSON.parse(text)));
  const chunks = sseEvents(text).map(event => {
    const data = /^data: (.*)$/m.exec(event);
    const json = data && JSON.parse(data[1]);
    if (json?.type === 'response.output_item.done') return `event: ${json.type}\ndata: ${JSON.stringify({ ...json, item: completedItem(json.item) })}\n\n`;
    if (json?.type === 'response.incomplete') return `event: response.completed\ndata: ${JSON.stringify({ ...json, type: 'response.completed', response: completedResponse(json.response) })}\n\n`;
    return event;
  });
  return streamed(chunks, { pace: 20 });
}

const openaiResponses = {
  id: 'openai-responses',
  service: 'OpenAI',
  prefix: 'gpt-5-sim-', // an id the app's OpenAI model list maps to the Responses API
  vendors: ['openai', 'xai', 'sakanaai'],
  own: 'openai',
  generation: (req, url, body) => req.method === 'POST' && url.pathname.endsWith('/responses') ? { model: String(body.model ?? ''), streaming: body.stream === true } : null,
  lists: openaiLists, list: openaiList, model: openaiModel,
  error: openaiError,
  scenarios: { 'ok': responsesOk },
};


// --- Anthropic Messages ---

const antEvent = (data) => `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;
const ANT_USAGE = { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 };
const antOpen = (model) => [
  antEvent({ type: 'message_start', message: { id: 'msg_sim', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: ANT_USAGE } }),
  antEvent({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
];
const antSay = (words) => words.map((word, i) => antEvent({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: (i ? ' ' : '') + word } }));
const antClose = (stop_reason) => [
  antEvent({ type: 'content_block_stop', index: 0 }),
  antEvent({ type: 'message_delta', delta: { stop_reason, stop_sequence: null }, usage: { ...ANT_USAGE, output_tokens: 20 } }),
  antEvent({ type: 'message_stop' }),
];
const antError = (type, message) => antEvent({ type: 'error', error: { type, message } });
const antWhole = (model, text, stop_reason) => whole({ id: 'msg_sim', type: 'message', role: 'assistant', model, content: [{ type: 'text', text }], stop_reason, stop_sequence: null, usage: { ...ANT_USAGE, output_tokens: 20 } });
const ANT_ERROR_TYPES = { 400: 'invalid_request_error', 401: 'authentication_error', 403: 'permission_error', 404: 'not_found_error', 413: 'request_too_large', 429: 'rate_limit_error', 500: 'api_error', 529: 'overloaded_error' };
const ANT_OVERLOADED = antError('overloaded_error', 'Overloaded');

const anthropic = {
  id: 'anthropic',
  service: 'Anthropic',
  prefix: 'claude-sim-',
  vendors: ['anthropic', 'deepseek'],
  own: 'anthropic',
  generation: (req, url, body) => req.method === 'POST' && url.pathname.endsWith('/messages') ? { model: String(body.model ?? ''), streaming: body.stream === true } : null,
  lists: (req, url) => req.method === 'GET' && url.pathname.endsWith('/models') && !!req.headers['anthropic-version'],
  list: (models) => ({ data: models, has_more: false, first_id: models[0]?.id ?? null, last_id: models.at(-1)?.id ?? null }),
  model: (id, title) => ({
    type: 'model', id, display_name: title, created_at: '2026-01-01T00:00:00Z', max_input_tokens: 200000, max_tokens: 8192,
    capabilities: { image_input: { supported: false }, pdf_input: { supported: false }, thinking: { supported: false }, effort: { supported: false }, server_tools: { supported: false } },
  }),
  error: (status) => ({ body: { type: 'error', error: { type: ANT_ERROR_TYPES[status] ?? 'api_error', message: `The service answered ${status}.` } } }),
  scenarios: {
    'ok': ({ model, streaming }) => streaming ? streamed([...antOpen(model), ...antSay(WORDS), ...antClose('end_turn')]) : antWhole(model, TEXT, 'end_turn'),
    // the turn never finishes: every answer is one more step and `pause_turn`, until the continuation limit
    'pause-forever': ({ model, streaming, hit }) => streaming ? streamed([...antOpen(model), ...antSay([`Step ${hit}.`]), ...antClose('pause_turn')], { pace: 0 }) : antWhole(model, `Step ${hit}. `, 'pause_turn'),
    // an in-stream `overloaded_error` after text: every time (retried, then given up) / twice, then a clean answer
    'overloaded-mid': ({ model, streaming }) => streaming ? streamed([...antOpen(model), ...antSay(WORDS.slice(0, 4)), ANT_OVERLOADED]) : null,
    'overloaded-then-ok': ({ model, streaming, hit }) => !streaming ? null
      : (hit - 1) % 3 < 2 ? streamed([...antOpen(model), ...antSay(WORDS.slice(0, 4)), ANT_OVERLOADED])
        : streamed([...antOpen(model), ...antSay(WORDS), ...antClose('end_turn')]),
    // an in-stream error of a class that is not retried: fails at once, the text before it stays
    'error-mid': ({ model, streaming }) => streaming ? streamed([...antOpen(model), ...antSay(WORDS.slice(0, 4)), antError('permission_error', 'Your API key does not have permission to use the specified resource.')]) : null,
  },
};


// --- Gemini generateContent ---

const GEM_USAGE = { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 };
const gemChunk = (parts, finishReason) => ({ candidates: [{ content: { parts, role: 'model' }, ...(finishReason && { finishReason }), index: 0 }], usageMetadata: GEM_USAGE, modelVersion: 'gemini-sim' });
const gemEvent = (object) => `data: ${JSON.stringify(object)}\n\n`;
const gemWords = (from, to) => WORDS.slice(from, to).map((word, i) => gemChunk([{ text: (from + i ? ' ' : '') + word }]));
const GEM_PROMPT_BLOCKED = { promptFeedback: { blockReason: 'SAFETY', safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'NEGLIGIBLE' }, { category: 'HARM_CATEGORY_HARASSMENT', probability: 'HIGH', blocked: true }] }, usageMetadata: { promptTokenCount: 10, totalTokenCount: 10 }, modelVersion: 'gemini-sim' };
const GEM_STATUS = { 400: 'INVALID_ARGUMENT', 401: 'UNAUTHENTICATED', 403: 'PERMISSION_DENIED', 404: 'NOT_FOUND', 429: 'RESOURCE_EXHAUSTED', 500: 'INTERNAL', 503: 'UNAVAILABLE', 504: 'DEADLINE_EXCEEDED' };
/** Text a word at a time, optionally with one media part in the middle */
const gemAnswer = (streaming, media) => streaming
  ? streamed([...gemWords(0, 6), ...(media ? [gemChunk([media])] : []), ...gemWords(6), gemChunk([{ text: '' }], 'STOP')].map(gemEvent))
  : whole(gemChunk(media ? [{ text: WORDS.slice(0, 6).join(' ') }, media, { text: ' ' + WORDS.slice(6).join(' ') }] : [{ text: TEXT }], 'STOP'));

const gemini = {
  id: 'gemini',
  service: 'Gemini',
  prefix: 'gemini-sim-',
  vendors: ['gemini'],
  own: 'gemini',
  generation: (req, url) => {
    const match = req.method === 'POST' && /\/models\/([^/:]+):(streamGenerateContent|generateContent)$/.exec(url.pathname);
    return match ? { model: decodeURIComponent(match[1]), streaming: match[2] === 'streamGenerateContent' } : null;
  },
  lists: (req, url) => req.method === 'GET' && /\/v1(beta|alpha)\/models$/.test(url.pathname),
  list: (models) => ({ models }),
  model: (id, title) => ({
    name: `models/${id}`, version: '001', displayName: title, description: 'AIX failure simulator', inputTokenLimit: 100000, outputTokenLimit: 8192,
    supportedGenerationMethods: ['generateContent', 'countTokens'], temperature: 1, topP: 0.95, topK: 64,
  }),
  error: (status) => ({ body: { error: { code: status, message: `The service answered ${status}.`, status: GEM_STATUS[status] ?? 'UNKNOWN' } } }),
  scenarios: {
    'ok': ({ streaming }) => gemAnswer(streaming),
    // the input is refused before any output
    'prompt-blocked': ({ streaming }) => streaming ? streamed([gemEvent(GEM_PROMPT_BLOCKED)]) : whole(GEM_PROMPT_BLOCKED),
    // an inline image among the text, decodable or not; audio in a codec the PCM-to-WAV converter rejects
    'image': ({ streaming }) => gemAnswer(streaming, { inlineData: { mimeType: 'image/png', data: PNG_1PX } }),
    'bad-image': ({ streaming }) => gemAnswer(streaming, { inlineData: { mimeType: 'image/png', data: NOT_A_PNG } }),
    'bad-audio': ({ streaming }) => gemAnswer(streaming, { inlineData: { mimeType: 'audio/L16;codec=opus;rate=24000', data: 'AAAA' } }),
  },
};


export const DIALECTS = [openaiChat, openaiResponses, anthropic, gemini];

/**
 * The transport failures offered as models of every dialect's `ok`, so the app can pick them; any other is armed or typed.
 * None that hangs: the app runs its background calls (a chat's title) on a listed model of its own choice, and a model
 * that never answers leaves one open connection per turn, until the browser has none left for the page.
 */
export const LISTED_DEFECTS = ['http401', 'http402', 'http403', 'http404', 'http413', 'http429', 'http429x2', 'http500', 'http503', 'http503x2', 'html', 'refuse', 'refusex2', 'cut4', 'reset4', 'garbage4'];
