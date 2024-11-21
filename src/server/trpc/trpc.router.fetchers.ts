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
export async function fetchJsonOrTRPCThrow<TOut extends object = object, TBody extends object | undefined = undefined>(config: RequestConfig<TBody>): Promise<TOut> {
  return _fetchFromTRPC<TBody, TOut>(config, async (response) => await response.json(), 'json');
}

// Text fetcher
export async function fetchTextOrTRPCThrow<TBody extends object | undefined = undefined>(config: RequestConfig<TBody>): Promise<string> {
  return _fetchFromTRPC<TBody, string>(config, async (response) => await response.text(), 'text');
}

// Response fetcher
export async function fetchResponseOrTRPCThrow<TBody extends object | undefined = undefined>(config: RequestConfig<TBody>): Promise<Response> {
  return _fetchFromTRPC<TBody, Response>(config, async (response) => response, 'response');
}


type RequestConfig<TJsonBody extends object | undefined> = {
  url: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
  name: string;
  throwWithoutName?: boolean; // when throwing, do not add the module name (the caller will improve the output)
} & (
  | { method?: 'GET' /* in case of GET, the method is optional, and no body */ }
  | { method: 'POST'; body: TJsonBody }
  | { method: 'PUT'; body: TJsonBody }      // [fred-sync] added PUT
  | { method: 'DELETE'; body?: TJsonBody }  // [Ollama] Violates the spec and has a body on DELETE requests
  );


/**
 * Internal fetcher
 * - Parses errors on connection, http responses, and parsing
 * - Throws TRPCErrors (as this is used within tRPC procedures)
 */
async function _fetchFromTRPC<TJsonBody extends object | undefined, TOut>(
  config: RequestConfig<TJsonBody>,
  responseParser: (response: Response) => Promise<TOut>,
  parserName: 'json' | 'text' | 'response',
): Promise<TOut> {

  const { url, method = 'GET', headers, name: moduleName, signal, throwWithoutName = false } = config;
  const body = 'body' in config ? config.body : undefined;

  // 1. Fetch a Response object
  let response: Response;
  try {

    if (SERVER_DEBUG_WIRE)
      console.log('-> fetch:', debugGenerateCurlCommand(method, url, headers, body as any));

    // upstream request
    const request: RequestInit = {
      method,
      headers: headers !== undefined ? headers : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal !== undefined ? signal : undefined,
    };

    // upstream fetch
    response = await fetch(url, request);

  } catch (error: any) {

    // [logging - Connection error] candidate for the logging system
    const errorCause: object | undefined = error ? error?.cause ?? undefined : undefined;

    // NOTE: This may log too much - for instance a 404 not found, etc.. - so we're putting it under the flag
    //       Consider we're also throwing the same, so there will likely be further logging.
    if (SERVER_DEBUG_WIRE)
      console.warn(`[${method}] ${moduleName} error (network):`, errorCause || error /* circular struct, don't use JSON.stringify.. */);

    // Handle Connection errors - HTTP 400
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: (throwWithoutName ? '' : `[${moduleName} network issue]: `)
        + (safeErrorString(error) || 'unknown fetch error')
        + (errorCause
          ? ` - ${safeErrorString(errorCause)}`
          : '')
        + ((errorCause && (errorCause as any)?.code === 'ECONNREFUSED')
          ? ` - is "${url}" accessible by the server?`
          : ''),
      cause: errorCause,
    });
  }

  // 2. Check for non-200s
  // These are the MOST FREQUENT errors, application level response. Such as:
  //  - 400 when requesting an invalid size to Dall-E3, etc..
  //  - 403 when requesting a localhost URL from a public server, etc..
  if (!response.ok) {
    // try to parse a json or text payload, which frequently contains the error, if present
    const responseCloneIfJsonFails = response.clone();
    let payload: any | null = await response.json().catch(() => null);
    if (payload === null)
      payload = await responseCloneIfJsonFails.text().catch(() => null);

    // [logging - HTTP error] candidate for the logging system
    console.error(`[${method}] ${moduleName} error (upstream): ${response.status} (${response.statusText}):`, safeErrorString(payload));

    // HTTP 400
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: (throwWithoutName ? '' : `[${moduleName} issue]: `)
        + (response.statusText || '')
        + (payload
          ? ` - ${safeErrorString(payload)}` : '')
        + (payload?.error?.failed_generation // [Groq]
          ? ` - failed_generation: ${payload.error.failed_generation}` : '')
        + (response.status === 403 && !url.includes('app.openpipe.ai' /* [OpenPipe] 403 when the model is associated to the project  */)
          ? ` - is "${url}" accessible by the server?` : '')
        + (response.status === 404 && !url.includes('app.openpipe.ai' /* [OpenPipe] 404 when the model is not found - don't add error details */)
          ? ` - "${url}" cannot be found by the server` : '')
        + (response.status === 502 ?
          ` - is "${url}" not available?` : ''),
    });
  }

  // 3. Safe Parse
  let value: TOut;
  try {
    value = await responseParser(response);
  } catch (error: any) {
    // [logging - Parsing error] candidate for the logging system
    console.error(`[${method}] ${moduleName} error (parse, ${parserName}):`, error);

    // HTTP 422
    throw new TRPCError({
      code: 'UNPROCESSABLE_CONTENT',
      message: (throwWithoutName ? `cannot parse ${parserName}: ` : `[${moduleName} parsing issue]: `)
        + (safeErrorString(error) || 'unknown error'),
    });
  }

  return value;
}
