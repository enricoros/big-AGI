import { TRPCError } from '@trpc/server';

import { debugGenerateCurlCommand, safeErrorString, SERVER_DEBUG_WIRE } from '~/server/wire';


// JSON fetcher
export const fetchJsonOrTRPCError: <TOut extends object, TPostBody extends object | undefined = undefined /* undefined for GET requests */>(
  url: string,
  method: 'GET' | 'POST',
  headers: HeadersInit,
  body: TPostBody,
  moduleName: string,
) => Promise<TOut> = createFetcherFromTRPC(async (response) => await response.json(), 'json');

// Text fetcher
export const fetchTextOrTRPCError: <TPostBody extends object | undefined>(
  url: string,
  method: 'GET' | 'POST' | 'DELETE',
  headers: HeadersInit,
  body: TPostBody,
  moduleName: string,
) => Promise<string> = createFetcherFromTRPC(async (response) => await response.text(), 'text');


// internal safe fetch implementation
function createFetcherFromTRPC<TPostBody, TOut>(parser: (response: Response) => Promise<TOut>, parserName: string): (url: string, method: 'GET' | 'POST' | 'DELETE', headers: HeadersInit, body: TPostBody | undefined, moduleName: string) => Promise<TOut> {
  return async (url, method, headers, body, moduleName) => {
    // Fetch
    let response: Response;
    try {
      if (SERVER_DEBUG_WIRE)
        console.log('-> tRPC', debugGenerateCurlCommand(method, url, headers, body as any));

      response = await fetch(url, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch (error: any) {
      const errorCause: object | undefined = error ? error?.cause ?? undefined : undefined;
      console.error(`[${method}] ${moduleName} error (fetch):`, errorCause || error /* circular struct, don't use JSON.stringify.. */);
      // HTTP 400
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `[Issue] ${moduleName}: (network): ${safeErrorString(error) || 'unknown fetch error'}`
          + (errorCause ? ` - ${errorCause?.toString()}` : '')
          + ((errorCause && (errorCause as any)?.code === 'ECONNREFUSED') ? ` - is "${url}" accessible by the server?` : ''),
        cause: errorCause,
      });
    }

    /* Check for non-200s
     * These are the MOST FREQUENT errors, application level response. Such as:
     * - 400 when requesting an invalid size to Dall-E3, etc..
     */
    if (!response.ok) {
      let payload: any | null = await response.json().catch(() => null);
      if (payload === null)
        payload = await response.text().catch(() => null);
      console.error(`[${method}] ${moduleName} error (upstream):`, response.status, response.statusText, payload);
      // HTTP 400
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `[Issue] ${moduleName}: ${response.statusText}` // (${response.status})`
          + (payload ? ` - ${safeErrorString(payload)}` : '')
          + (response.status === 403 ? ` - is "${url}" accessible by the server?` : '')
          + (response.status === 404 ? ` - "${url}" cannot be found by the server` : '')
          + (response.status === 502 ? ` - is "${url}" not available?` : ''),
      });
    }

    // Safe Parse
    try {
      return await parser(response);
    } catch (error: any) {
      console.error(`[${method}] ${moduleName} error (parse):`, error);
      // HTTP 422
      throw new TRPCError({
        code: 'UNPROCESSABLE_CONTENT',
        message: `[Issue] ${moduleName}: (parsing): ${safeErrorString(error) || `Unknown ${parserName} parsing error`}`,
      });
    }
  };
}
