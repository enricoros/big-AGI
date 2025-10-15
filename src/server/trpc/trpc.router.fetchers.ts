import { TRPCError } from '@trpc/server';

import { debugGenerateCurlCommand, safeErrorString, SERVER_DEBUG_WIRE } from '~/server/wire';


//
// NOTE: This file is used in the server-side code, and not in the client-side code.
//
// It is used to fetch data from external APIs, and throw TRPC errors on failure.
//
// It handles connection errors, HTTP errors, and parsing errors.
//

// JSON fetcher
export async function fetchJsonOrTRPCThrow<TOut extends object = object, TBody extends object | undefined | FormData = undefined>(config: RequestConfig<TBody>): Promise<TOut> {
  return _fetchFromTRPC<TBody, TOut>(config, _jsonRequestParserOrThrow, 'json');
}

async function _jsonRequestParserOrThrow(response: Response) {
  let text = '';
  try {
    text = await response.text();
    return JSON.parse(text) as any;
  } catch (error) {

    // Errors: Cannot Parse
    if (error instanceof SyntaxError) {

      const contentType = response.headers?.get('content-type')?.toLowerCase() || '';
      const contentTypeInfo = contentType && !contentType.includes('application/json') ? ` (Content-Type: ${contentType})` : '';

      // Improve messaging of Empty or Incomplete JSON
      if (error.message === 'Unexpected end of JSON input')
        throw new TRPCError({
          code: 'PARSE_ERROR',
          message: (!text?.length ? 'Empty response while expecting JSON' : 'Incomplete JSON response') + contentTypeInfo,
          cause: error,
        });

      // Improve messaging of a real parsing error where we expected JSON and got something else
      if (error.message.startsWith('Unexpected token')) {
        const lcText = text.trim().toLowerCase();
        let inferredType = 'unknown';

        if (['<html', '<!doctype'].some(tag => lcText.startsWith(tag)))
          inferredType = 'HTML';
        else if (['<?xml', '<rss', '<feed', '<xml'].some(tag => lcText.startsWith(tag)))
          inferredType = 'XML';
        else if (['<div', '<span', '<p', '<script', '<br', '<body', '<head', '<title'].some(tag => lcText.startsWith(tag)))
          inferredType = 'HTML-like';
        else if (lcText.startsWith('{') || lcText.startsWith('['))
          inferredType = 'malformed JSON';

        throw new TRPCError({
          code: 'PARSE_ERROR',
          message: `Expected JSON data but received ${inferredType ? inferredType + ', likely an error page' : 'NON-JSON content'}${contentTypeInfo}: \n\n"${text.length > 200 ? text.slice(0, 200) + '...' : text}"`,
          cause: error,
        });
      }

      throw new TRPCError({
        code: 'PARSE_ERROR',
        message: `Error parsing JSON data${contentTypeInfo}: ${safeErrorString(error) || 'unknown error'}`,
      });

    }

    // Other errors: AbortError (request aborted), TypeError (body locked, decoding error for instance due to Content-Encoding mismatch), etc..
    throw new TRPCError({
      code: 'PARSE_ERROR',
      message: `Error reading JSON data: ${safeErrorString(error) || 'unknown error'}`,
    });
  }
  // unreachable
}


// Text fetcher
export async function fetchTextOrTRPCThrow<TBody extends object | undefined = undefined>(config: RequestConfig<TBody>): Promise<string> {
  return _fetchFromTRPC<TBody, string>(config, async (response) => await response.text(), 'text');
}

// Response fetcher
export async function fetchResponseOrTRPCThrow<TBody extends object | undefined = undefined>(config: RequestConfig<TBody>): Promise<Response> {
  return _fetchFromTRPC<TBody, Response>(config, async (response) => response, 'response');
}


type RequestConfig<TBody extends object | undefined | FormData> = {
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


/**
 * Internal fetcher
 * - Parses errors on connection, http responses, and parsing
 * - Throws TRPCErrors (as this is used within tRPC procedures)
 */
async function _fetchFromTRPC<TBody extends object | undefined | FormData, TOut>(
  config: RequestConfig<TBody>,
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
    response = await fetch(url, request);

  } catch (error: any) {

    // NOTE: if signal?.aborted is true, we also come here, likely with a error?.name = ResponseAborted (Next.js) or AbortError (standard from signal)
    // since we don't handle this case specially, the same TRPCError will be thrown as for other connection errors.
    if (error?.name === 'AbortError')
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: (!throwWithoutName ? `[${moduleName} cancelled]: ` : '') + (error?.message || 'This operation was aborted.'),
        cause: error,
      });

    // [logging - Connection error] candidate for the logging system
    const errorCause: any | undefined = error ? error?.cause ?? undefined : undefined;

    // NOTE: This may log too much - for instance a 404 not found, etc.. - so we're putting it under the flag
    //       Consider we're also throwing the same, so there will likely be further logging.
    if (SERVER_DEBUG_WIRE)
      console.warn(`[${method}] ${moduleName} error (network issue):`, errorCause || error /* circular struct, don't use JSON.stringify.. */);

    // Show server-access warning for common connection issues
    const showAccessWarning = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'DNS_ERROR',
      'ECONNRESET',
      'ENETUNREACH', // example an IP is unreachable
      'Connect Timeout Error', // example using some random ip
    ].includes(errorCause?.code);

    // Handle (NON) CONNECTION errors -> HTTP 400
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: (!throwWithoutName ? `[${moduleName} network issue]: ` : '')
        + `Upstream unreachable: ${(safeErrorString(error) || 'unknown fetch error')}`
        + (errorCause ? ` \nTechnical Details: ${safeErrorString(errorCause)}` : '')
        + (showAccessWarning ? ` \n\nPlease make sure the Server can access -> ${debugCleanUrl}` : ''),
      cause: errorCause,
    });
  }

  // 2. Check for non-200s
  // These are the MOST FREQUENT errors, application level response. Such as:
  //  - 400 when requesting an invalid size to Dall-E-3, etc..
  //  - 403 when requesting a localhost URL from a public server, etc..
  if (!response.ok) {

    // try to parse a json or text payload, which frequently contains the error, if present
    let payload: any | null = await response.text().catch(() => null);
    try {
      if (payload)
        payload = JSON.parse(payload) as string;
    } catch {
      // ...ignore
    }

    // [logging - HTTP error] candidate for the logging system
    const status = response.status;
    let payloadString = safeErrorString(payload);
    if (payloadString) {
      if (payloadString.length > 200)
        payloadString = payloadString.slice(0, 200) + '...';
      const lcPayload = payloadString.trim().toLowerCase();
      if (['<!doctype', '<html', '<head', '<body', '<script', '<title'].some(tag => lcPayload.startsWith(tag)))
        payloadString = 'The data looks like HTML, likely an error page: \n\n"' + payloadString + '"';
    }

    // Handle HTTP Response errors -> HTTP 400
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: (throwWithoutName ? '' : `[${moduleName} issue]: `)
        + `Upstream responded with HTTP ${status} ${response.statusText}`
        + (payloadString ? ` - \n${payloadString}` : '')
        + (payload?.error?.failed_generation && url.includes('api.groq.com') // [Groq]
          ? ` \n\nGroq: failed_generation: ${payload.error.failed_generation}` : '')
        + (status === 403 && moduleName === 'Gemini' && payloadString?.includes('Requests from referer')
          ? ' \n\nGemini: Check API key restrictions in Google Cloud Console' : '')
        + ((status === 404 || status === 403 || status === 502) && !url.includes('app.openpipe.ai') // [OpenPipe] 403 when the model is associated to the project, 404 when not found
          ? ` \n\nPlease make sure the Server can access -> ${debugCleanUrl}` : ''),
    });
  }

  // 3. Safe Parse
  let value: TOut;
  try {
    value = await responseParser(response);
  } catch (error: any) {

    // [logging - Parsing error] candidate for the logging system
    console.warn(`[${method}] ${moduleName} error (parse, ${parserName}):`, error);

    // Forward already processed Parsing error -> 422
    if (error instanceof TRPCError)
      throw new TRPCError({
        code: 'UNPROCESSABLE_CONTENT',
        message: (!throwWithoutName ? `[${moduleName}]: ` : '')
          + error.message
          + ` \n\nPlease make sure the Server can access -> ${debugCleanUrl}`,
        cause: error.cause,
      });

    // Handle PARSING Errors -> HTTP 422
    throw new TRPCError({
      code: 'UNPROCESSABLE_CONTENT',
      message: (throwWithoutName ? `cannot parse ${parserName}: ` : `[${moduleName} parsing issue]: `)
        + (safeErrorString(error) || 'unknown error'),
    });
  }

  return value;
}
