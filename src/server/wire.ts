
export const DEBUG_WIRE = true;

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