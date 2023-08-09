import { TRPCError } from '@trpc/server';


// JSON fetcher
export const fetchJsonOrTRPCError: <TOut = unknown, TPostBody = undefined>(
  url: string,
  method: 'GET' | 'POST',
  headers: HeadersInit,
  body: TPostBody | undefined,
  moduleName: string,
) => Promise<TOut> = createFetcherFromTRPC(async (response) => await response.json(), 'json');

// Text fetcher
export const fetchTextOrTRPCError: <TPostBody = undefined>(
  url: string,
  method: 'GET' | 'POST',
  headers: HeadersInit,
  body: TPostBody | undefined,
  moduleName: string,
) => Promise<string> = createFetcherFromTRPC(async (response) => await response.text(), 'text');


// [internal safe fetch implementation]
function createFetcherFromTRPC<TPostBody, TOut>(parser: (response: Response) => Promise<TOut>, parserName: string): (url: string, method: 'GET' | 'POST', headers: HeadersInit, body: TPostBody | undefined, moduleName: string) => Promise<TOut> {
  return async (url, method, headers, body, moduleName) => {
    let response: Response;
    try {
      response = await fetch(url, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch (error: any) {
      console.error(`[${moduleName} Fetch Error]:`, error);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `[${moduleName} Issue] ${error?.message || error?.toString() || 'Unknown fetch error'} - ${error?.cause}`,
      });
    }
    if (!response.ok) {
      const error: any | null = await response.json().catch(() => null);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error
          ? `[${moduleName} Issue] ${error?.error?.message || error?.error || error?.toString() || 'Unknown http error'}`
          : `[Issue] ${response.statusText} (${response.status})` + (response.status === 403 ? ` - is ${url} accessible by the server?` : ''),
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

