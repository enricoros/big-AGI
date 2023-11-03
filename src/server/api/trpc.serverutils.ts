import { TRPCError } from '@trpc/server';

import { SERVER_DEBUG_WIRE, debugGenerateCurlCommand } from '~/server/wire';


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
  method: 'GET' | 'POST',
  headers: HeadersInit,
  body: TPostBody,
  moduleName: string,
) => Promise<string> = createFetcherFromTRPC(async (response) => await response.text(), 'text');


// [internal safe fetch implementation]
function createFetcherFromTRPC<TPostBody, TOut>(parser: (response: Response) => Promise<TOut>, parserName: string): (url: string, method: 'GET' | 'POST', headers: HeadersInit, body: TPostBody | undefined, moduleName: string) => Promise<TOut> {
  return async (url, method, headers, body, moduleName) => {
    let response: Response;
    try {
      if (SERVER_DEBUG_WIRE)
        console.log('-> tRPC', debugGenerateCurlCommand(method, url, headers, body as any));
      response = await fetch(url, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch (error: any) {
      console.error(`[${moduleName} Fetch Error]:`, error);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `[${moduleName} Issue] (network) ${error?.message || error?.toString() || 'Unknown fetch error'} - ${error?.cause}`,
      });
    }
    if (!response.ok) {
      let error: any | null = await response.json().catch(() => null);
      if (error === null)
        error = await response.text().catch(() => null);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error
          ? `[${moduleName} Issue] ${error?.error?.message || error?.error || error?.toString() || 'Unknown http error'}`
          : `[Issue] ${moduleName}: ${response.statusText} (${response.status})`
          + (response.status === 403 ? ` - is ${url} accessible by the server?` : '')
          + (response.status === 502 ? ` - is ${url} down?` : ''),
      });
    }
    try {
      return await parser(response);
    } catch (error: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `[${moduleName} Issue] ${error?.message || error?.toString() || `Unknown ${parserName} parsing error`}`,
      });
    }
  };
}

