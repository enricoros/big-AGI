/// set this to true to see the tRPC and fetch requests made by the server
export const SERVER_DEBUG_WIRE = false;

/**
 * Weak (meaning the string could be encoded poorly) function that returns a string that can be used to debug a TRPC request.
 */
export function debugGenerateCurlCommand(method: 'GET' | 'POST', url: string, headers: HeadersInit, body: object | undefined): string {
  let curl = `curl -X ${method} '${url}' `;

  const headersRecord = headers as Record<string, string>;

  for (let header in headersRecord)
    curl += `-H '${header}: ${headersRecord[header]}' `;

  if (method === 'POST' && body)
    curl += `-d '${JSON.stringify(body)}'`;

  return curl;
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