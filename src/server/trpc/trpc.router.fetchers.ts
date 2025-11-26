import { TRPCError } from '@trpc/server';

import { debugGenerateCurlCommand, safeErrorString, SERVER_DEBUG_WIRE } from '~/server/wire';


// configuration
const SERVER_LOG_FETCHERS_ERRORS = true; // log all fetcher errors to the console


//
// NOTE: This file is used in the server-side code, and not in the client-side code.
//
// It is used to fetch data from external APIs, and throw TRPC errors on failure.
//
// It handles connection errors, HTTP errors, and parsing errors.
//

// JSON fetcher
export async function fetchJsonOrTRPCThrow<TOut extends object = object, TBody extends object | undefined | FormData = undefined>(config: _RequestConfig<TBody>): Promise<TOut> {
  return _fetchFromTRPC<TBody, TOut>(config, _jsonResponseParserOrThrow, 'json');
}

// Text fetcher
export async function fetchTextOrTRPCThrow<TBody extends object | undefined = undefined>(config: _RequestConfig<TBody>): Promise<string> {
  return _fetchFromTRPC<TBody, string>(config, async (response) => await response.text(), 'text');
}

// Response fetcher
export async function fetchResponseOrTRPCThrow<TBody extends object | undefined = undefined>(config: _RequestConfig<TBody>): Promise<Response> {
  return _fetchFromTRPC<TBody, Response>(config, async (response) => response, 'response');
}


type _RequestConfig<TBody extends object | undefined | FormData> = {
  url: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
  name: string;
  throwWithoutName?: boolean; // when throwing, do not add the module name (the caller will improve the output)
} & (
  | { method?: 'GET' /* in case of GET, the method is optional, and no body */ }
  | { method: 'POST'; body: TBody }
  | { method: 'PUT'; body: TBody }      // [fred-sync] added PUT
  | { method: 'DELETE'; body?: TBody }  // [Ollama] Violates the spec and has a body on DELETE requests
  );


//
// TRPCFetcherError - unified error for all fetch failures
//

/**
 * Error class for all _fetchFromTRPC failures, easy to pattern-match and retry.
 *
 * Is-a TRPCError: { code: 'BAD_REQUEST' | 'UNPROCESSABLE_CONTENT' | 'CLIENT_CLOSED_REQUEST'; message?: string; cause?: unknown; }
 *
 * This error gets thrown from all fetcher functions in this file (fetchJsonOrTRPCThrow, fetchTextOrTRPCThrow, fetchResponseOrTRPCThrow).
 *
 * TWO PATHS:
 * 1. UNHANDLED: If not caught, tRPC router automatically serializes and sends to client
 *    - see trpc.server.ts for error transformation, which adds the 3 extra fields below to the client
 * 2. HANDLED: If caught in server code (e.g., aix.router.ts), the structured fields can be used for decision-making:
 *    - category: 'abort' | 'connection' | 'http' | 'parse'
 *    - connErrorName: System error code (ECONNREFUSED, ETIMEDOUT, ENOTFOUND) for connection errors
 *    - httpStatus: HTTP status code (503, 429, 502, etc.) for upstream HTTP errors
 *
 * RETRY PATTERN MATCHING:
 * - HTTP 503/429/502 (category='http', httpStatus present) → Retry with server profile (1-30s)
 * - Connection errors (category='connection', connErrorName present) → Retry with network profile (0.5-8s)
 * - Abort/Parse (category='abort'/'parse') → Don't retry
 *
 * SECURITY NOTE:
 * - No `cause` field: Prevents leaking sensitive Error objects (stack traces, internal state) to client
 * - Error messages are sanitized via safeErrorString() before inclusion
 */
export class TRPCFetcherError extends TRPCError {
  public override readonly name = 'TRPCFetcherError';

  readonly category: TRPCFetcherErrorCategory;
  readonly connErrorName?: string; // [category='connection'] System error code (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, etc.)
  readonly httpStatus?: number;    // [category='http'] HTTP status code (503, 429, 502, etc.)

  constructor(opts: {
    category: TRPCFetcherErrorCategory,
    connErrorName?: string,
    httpStatus?: number,
    // -> TRPCError fields (code, cause)
    // code?: TRPCError['code'], // removed because we decide it based on category
    // cause?: unknown, // removed for security / anti-leakage reasons
    // -> Error fields (message)
    message: string,
  }) {
    const code = // opts.code ? opts.code
      opts.category === 'parse' ? 'UNPROCESSABLE_CONTENT'
        : opts.category === 'abort' ? 'CLIENT_CLOSED_REQUEST'
          : 'BAD_REQUEST';
    super({ code, message: opts.message });

    this.category = opts.category;
    this.connErrorName = opts.connErrorName;
    this.httpStatus = opts.httpStatus;

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, TRPCFetcherError.prototype);
  }
}

/**
 * @abort: aborted by client/signal
 * @connection: network/TCP errors before HTTP response
 * @http: upstream returned HTTP error (4xx, 5xx)
 * @parse: response parsing failed (malformed JSON, encoding issues)
 */
type TRPCFetcherErrorCategory =
  | 'abort'
  | 'connection'
  | 'http'
  | 'parse';


/**
 * Internal fetcher
 * - Parses errors on connection, http responses, and parsing
 * - Throws TRPCErrors (as this is used within tRPC procedures)
 */
async function _fetchFromTRPC<TBody extends object | undefined | FormData, TOut>(
  config: _RequestConfig<TBody>,
  responseParser: (response: Response) => Promise<TOut>,
  parserName: 'json' | 'text' | 'response',
): Promise<TOut> {

  const { url, method = 'GET', headers: configHeaders, name: moduleName, signal, throwWithoutName = false } = config;
  const body = 'body' in config ? config.body : undefined;

  // Cleaner url without query
  let debugCleanUrl;
  try {
    const { origin, pathname } = new URL(url);
    debugCleanUrl = decodeURIComponent(origin + pathname);
  } catch {
    // ...ignore
  }


  // 1. Fetch a Response object
  let response: Response;
  try {

    // handle FormData automatically
    const isFormData = method === 'POST' && body instanceof FormData;

    // prepare headers, DO NOT set Content-Type for FormData, let the browser do it
    const headers: HeadersInit | undefined = !configHeaders ? undefined : { ...configHeaders };
    if (isFormData && headers) {
      delete (headers as any)['Content-Type'];
      delete (headers as any)['content-type']; // case-insensitive check
    }
    // else if (body !== undefined && !isFormData && !(headers as any)['Content-Type'])
    //   (headers as any)['Content-Type'] = 'application/json';

    if (SERVER_DEBUG_WIRE)
      console.log('-> fetch:', debugGenerateCurlCommand(method, url, headers, body));

    // upstream request
    const request: RequestInit = {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal,
    };

    // upstream FETCH
    // @throws DOMException.name=AbortError when the request is aborted by the user
    // @throws Error.name=ResponseAborted (Next.js) when the request is aborted (e.g. HMR)
    // @throws TypeError: network error occurred (URL invalid, invalid RequestInit, network error such as DNS failure or no connectivity or IP, etc.)
    response = await fetch(url, request);

  } catch (error: any) {

    const errorName: string = error?.name || 'UnknownError';
    const errorString = safeErrorString(error) || 'unknown fetch error';

    // 1. [shall be handled before] AbortError - user cancelled the request, signal?.aborted shall be true, or ResponseAborted in Next.js (when HMR or similar)
    if (['AbortError', 'ResponseAborted'].includes(errorName) /*|| (signal && signal.aborted)*/)
      throw new TRPCFetcherError({
        category: 'abort',
        message: (!throwWithoutName ? `[${moduleName} cancelled]: ` : '')
          + (errorString || 'This operation was aborted.'),
        // cause: error,
      });

    // 2. TypeError - network/connection error

    // Resolve Technical details about the Cause - Heuristic
    const _cause = !error || !(error instanceof Error) || !('cause' in error) ? null : error.cause ?? null;
    const causeName = !_cause || !(_cause instanceof Error) ? null : _cause.name ?? null;
    const causeCode = !_cause || !(_cause instanceof Error || typeof _cause === 'object') ? null : (_cause as any).code ?? null;
    const causeMessage = safeErrorString(_cause);
    // const causeMessage = !_cause ? null : causeName === 'AggregateError' ? safeErrorString(_cause) : _cause?.toString() || safeErrorString(_cause) || null;
    const connErrorName = causeCode || causeName || errorName;

    // decide whether to show the URL
    const prettyShowUrl = [
      'ConnectTimeoutError',      // timeout connecting to server - cause Name
      'UND_ERR_CONNECT_TIMEOUT',  // timeout connecting to server - cause Code
      'ENOTFOUND',                // DNS failure
      'ECONNREFUSED',             // connection refused (e.g. connecting to localhost from a public server) - often an AggregateError
      'EHOSTUNREACH',             // when I unplug the network cable
      // not verified, but likely:
      'ETIMEDOUT',                // connection timed out
      'ECONNRESET',               // connection reset by peer
    ].includes(connErrorName) || [
      // Vercel: _cause is always null, need to match the message text
      'network connection lost.',
      'connect timeout error',
      'internal error',           // very obscure and generic Vercel edge Error.message
    ].includes(errorString.toLowerCase());

    // NOTE: This may log too much - for instance a 404 not found, etc.. - so we're putting it under the flag
    //       Consider we're also throwing the same, so there will likely be further logging.
    if (SERVER_DEBUG_WIRE || SERVER_LOG_FETCHERS_ERRORS)
      console.log(`[${method}] [${moduleName} network issue]: "${errorString}"`, { error, _cause, debugCleanUrl, urlShown: prettyShowUrl });

    // -> throw Connection error: will be a 400 (BAD_REQUEST), with preserved cause
    throw new TRPCFetcherError({
      category: 'connection',
      connErrorName: connErrorName,
      message: (!throwWithoutName ? `[${moduleName} network issue]: ` : '')
        + `Could not connect: ${_period(errorString)}`
        + (causeMessage ? ` \nTechnical cause: ${_period(causeMessage)}` : '')
        + (prettyShowUrl ? ` \n\nPlease make sure the Server can access -> ${debugCleanUrl}` : ''),
      // cause: _cause,
    });
  }


  // 2. Check for non-200s
  // These are the MOST FREQUENT errors, application level response. Such as:
  //  - 400 when requesting an invalid size to Dall-E-3, etc..
  //  - 403 when requesting a localhost URL from a public server, etc..
  if (!response.ok) {

    // parse status and potential payload (frequently contain error details)
    let notOkayPayload: any | null = await response.text().catch(() => null);
    try {
      if (notOkayPayload)
        notOkayPayload = JSON.parse(notOkayPayload) as string;
    } catch {
      // ...ignore
    }

    // [logging - HTTP error] candidate for the logging system
    const s: number = response.status;
    let payloadString = safeErrorString(notOkayPayload);
    if (payloadString) {
      // truncate
      if (payloadString.length > 240)
        payloadString = payloadString.slice(0, 240) + '...';
      // frame
      const inferredType = _inferTextPayloadType(payloadString);
      if (inferredType)
        payloadString = `The data looks like ${inferredType}: \n\n"${payloadString}"`;
    }

    if (SERVER_DEBUG_WIRE || SERVER_LOG_FETCHERS_ERRORS)
      console.log(`[${method}] [${moduleName} issue] (http ${s}, ${response.statusText}):`, { parserName, payloadMessage: payloadString });

    // -> throw HTTP error: will be a 400 (BAD_REQUEST), with preserved status
    throw new TRPCFetcherError({
      category: 'http',
      httpStatus: s,
      message: (throwWithoutName ? '' : `[${moduleName} issue]: `)
        + `Upstream responded with HTTP ${s} ${response.statusText}`
        + (payloadString ? ` - \n${payloadString}` : '')
        // Custom hints for common issues from select providers
        + (s === 403 && moduleName === 'Gemini' && payloadString?.includes('Requests from referer') ? ' \n\nGemini: Check API key restrictions in Google Cloud Console' : '')
        + ((s === 404 || s === 403 || s === 502) && !url.includes('app.openpipe.ai') ? ` \n\nPlease make sure the Server can access -> ${debugCleanUrl}` : ''), // [OpenPipe] 403 when the model is associated to the project, 404 when not found
      // cause: payload, // NOT an Error - do not use even to preserve original error payload as cause
    });
  }


  // 3. Safe Parse
  let value: TOut;
  try {
    value = await responseParser(response);
  } catch (error: any) {

    // [logging - Parsing error] candidate for the logging system
    if (SERVER_DEBUG_WIRE || SERVER_LOG_FETCHERS_ERRORS) {
      // WARN because we want to understand if something is wrong with the upstream APIs, otherwise HTTP errors are expected and simply logged
      console.warn(`[${method}] [${moduleName}]: (${parserName} parsing error): ${error?.name}`, { error, url });
    }

    // Forward already processed Parsing error, adding the module name if required
    if (error instanceof TRPCFetcherError)
      throw throwWithoutName ? error : new TRPCFetcherError({
        category: error.category,
        connErrorName: error.connErrorName,
        httpStatus: error.httpStatus,
        message: `[${moduleName} parsing issue]: ${error.message}`
          + ` \n\nPlease make sure the Server can access -> ${debugCleanUrl}`,
        // cause: error.cause, // REMOVE the cause
      });

    // -> wrap other PARSING ERRORS / ABORTS
    throw new TRPCFetcherError({
      category: !!error && (error as any)?.name === 'AbortError' ? 'abort' : 'parse',
      message: (throwWithoutName ? '' : `[${moduleName} parsing issue]: `)
        + `Error reading ${parserName} data: ${safeErrorString(error) || 'unknown error'}`,
      // cause: error,
    });
  }

  return value;
}


// --- Utilities ---

/**
 * JSON Response parser with improved error messages due to fragile responses
 */
async function _jsonResponseParserOrThrow(response: Response) {
  let text = '';
  try {
    // @throws: AbortError (a DOMException.name, request aborted)
    // @throws: TypeError (operation could not be performed: body locked, decoding error for instance due to Content-Encoding mismatch)
    text = await response.text();

    // @throws: SyntaxError (malformed JSON)
    return JSON.parse(text) as any;
  } catch (error) {

    // 2. JSON.parse errors
    if (error instanceof SyntaxError) {

      // specialize by error message
      const { message: errorMessage } = error;
      const contentType = response.headers?.get('content-type')?.toLowerCase() || '';
      const contentTypeInfo = contentType && !contentType.includes('application/json') ? ` (Content-Type: ${contentType})` : '';

      // 2.A JSON incomplete / empty
      if (errorMessage === 'Unexpected end of JSON input')
        throw new TRPCFetcherError({
          category: 'parse',
          message: (text?.length ? 'Incomplete JSON response' : 'Empty response while expecting JSON') + contentTypeInfo,
          // cause: error,
        });

      // 2.B NOT JSON
      if (errorMessage.startsWith('Unexpected token')) {
        const inferredType = _inferTextPayloadType(text);
        throw new TRPCFetcherError({
          category: 'parse',
          message: `Expected JSON data but received ${inferredType ? inferredType + ', likely an error page' : 'NON-JSON content'}${contentTypeInfo}:`
            + ` \n\n"${text.length > 200 ? text.slice(0, 200) + '...' : text}"`,
          // cause: error,
        });
      }

      // 2.C Other SyntaxError
      throw new TRPCFetcherError({
        category: 'parse',
        message: `Error parsing JSON data${contentTypeInfo}: ${safeErrorString(error) || 'unknown error'}`,
        // cause: error,
      });

    }

    // 1. response.text(): AbortError (shall have been dealt with already) or TypeError
    throw new TRPCFetcherError({
      category: !!error && (error as any)?.name === 'AbortError' ? 'abort' : 'parse', // note: the second may as well be 'connection' but let's make it 'parse' for safety, so it's not retried
      message: `Error reading JSON data: ${safeErrorString(error) || 'unknown error'}`,
      // cause: error,
    });

  }
  // unreachable
}

function _period(s: string) {
  return s?.trimEnd().endsWith?.('.') ? s : s + '.';
}

function _inferTextPayloadType(payload?: string) {
  if (!payload || typeof (payload as unknown) !== 'string')
    return;

  const lcText = payload.trim().toLowerCase();
  if (['<html', '<!doctype'].some(tag => lcText.startsWith(tag)))
    return 'HTML';
  else if (['<?xml', '<rss', '<feed', '<xml'].some(tag => lcText.startsWith(tag)))
    return 'XML';
  else if (['<div', '<span', '<p', '<script', '<br', '<body', '<head', '<title'].some(tag => lcText.startsWith(tag)))
    return 'HTML-like';
  else if (lcText.startsWith('{') || lcText.startsWith('['))
    return 'malformed JSON';
}
