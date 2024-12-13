/// set this to true to see the tRPC and fetch requests made by the server
export const SERVER_DEBUG_WIRE = false; //


export class ServerFetchError extends Error {
  public statusCode: number;

  constructor({ statusCode, message }: { statusCode: number, message: string }) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ServerFetchError';
  }
}


/**
 * Fetches a URL, but throws an Error if the response is not ok.
 */
export async function nonTrpcServerFetchOrThrow(url: string, method: 'GET' | 'POST', headers: HeadersInit, body: object | undefined, signal?: AbortSignal): Promise<Response> {
  // create the upstream request object
  const response = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal !== undefined ? { signal } : {}),
  });

  // Throws an error if the response is not ok
  // Use in server-side code, and not tRPC code (which has utility functions in trpc.serverutils.ts)
  if (!response.ok) {
    let payload: any | null = await response.json().catch(() => null);
    if (payload === null)
      payload = await response.text().catch(() => null);
    const errorPayloadString = payload ? ': ' + JSON.stringify(payload, null, 2).slice(1, -1) : '';
    throw new ServerFetchError({
      message: `${response.statusText} (${response.status})${errorPayloadString}`,
      statusCode: response.status,
    });
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

  // handle AggregateError
  if (error instanceof AggregateError) {
    const errors = error.errors.map(e => safeErrorString(e)).filter(Boolean);
    return `AggregateError: ${errors.join('; ')}`;
  }

  // descend into an 'error' object
  if (error.error)
    return safeErrorString(error.error);

  // choose the 'message' property if available
  if (error.message) {
    if (error.message === 'AggregateError' && error.stack)
      return `AggregateError: ${safeErrorString(error.stack)}`;
    return safeErrorString(error.message);
  }
  if (typeof error === 'string')
    return error;
  if (typeof error === 'object') {
    try {
      return JSON.stringify(error, null, 2).slice(1, -1);
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
export function debugGenerateCurlCommand(method: 'GET' | 'POST' | 'DELETE' | 'PUT', url: string, headers?: HeadersInit, body?: object): string {
  let curl = `curl -X ${method} '${url}' `;

  const headersRecord = (headers || {}) as Record<string, string>;

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


/**
 * Small debugging utility to log train of events, used on the server-side
 * for incoming packets (e.g. SSE).
 */
export class ServerDebugWireEvents {
  private sequenceNumber: number = 0;
  private lastMs: number | null = null;

  onMessage(message: any) {
    this.sequenceNumber++;
    if (SERVER_DEBUG_WIRE) {
      const nowMs = Date.now();
      const elapsedMs = this.lastMs ? nowMs - this.lastMs : 0;
      this.lastMs = nowMs;
      console.log(`<- SSE (${this.sequenceNumber}, ${elapsedMs} ms):`, message);
    }
  }
}

export const createServerDebugWireEvents = () => SERVER_DEBUG_WIRE ? new ServerDebugWireEvents() : null;


/** Utility to escape XML, for example to avoid XSS attacks. */
export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return match;
    }
  });
}