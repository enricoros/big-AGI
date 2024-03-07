/// set this to true to see the tRPC and fetch requests made by the server
export const SERVER_DEBUG_WIRE = false;


/**
 * Fetches a URL, but throws an Error if the response is not ok.
 */
export async function nonTrpcServerFetchOrThrow(url: string, method: 'GET' | 'POST', headers: HeadersInit, body: object | undefined): Promise<Response> {
  const response = await fetch(url, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

  // Throws an error if the response is not ok
  // Use in server-side code, and not tRPC code (which has utility functions in trpc.serverutils.ts)
  if (!response.ok) {
    const errorPayload: object | null = await response.json().catch(() => null);
    throw new Error(`${response.statusText} (${response.status})${errorPayload ? ' · ' + JSON.stringify(errorPayload) : ''}`);
  }

  return response;
}


/**
 * Safely convert a typical exception/error to a string.
 */
export function safeErrorString(error: any): string | null {
  // skip nulls
  if (!error)
    return null;

  // descend into an 'error' object
  if (error.error)
    return safeErrorString(error.error);

  // choose the 'message' property if available
  if (error.message)
    return safeErrorString(error.message);
  if (typeof error === 'string')
    return error;
  if (typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch (error) {
      // ignore
    }
  }

  // unlikely fallback
  return error.toString();
}

export function serverCapitalizeFirstLetter(string: string) {
  return string?.length ? (string.charAt(0).toUpperCase() + string.slice(1)) : string;
}


/**
 * Weak (meaning the string could be encoded poorly) function that returns a string that can be used to debug a request
 */
export function debugGenerateCurlCommand(method: 'GET' | 'POST' | 'DELETE', url: string, headers: HeadersInit, body: object | undefined): string {
  let curl = `curl -X ${method} '${url}' `;

  const headersRecord = headers as Record<string, string>;

  for (const header in headersRecord)
    curl += `-H '${header}: ${headersRecord[header]}' `;

  if (method === 'POST' && body)
    curl += `-d '${JSON.stringify(body)}'`;

  return curl;
}

export function createEmptyReadableStream<T = Uint8Array>(): ReadableStream<T> {
  return new ReadableStream({
    start: (controller) => controller.close(),
  });
}