/**
 * Present an error to the user in a human-readable format.
 * Be exhaustive and not repetitive. Ignore the stack trace.
 */
export function presentErrorToHumans(error: any, mdBold: boolean = false, devWarnError: boolean = false): string {
  if (devWarnError)
    console.error('presentErrorToDevelopers', { error });

  // Handle Error objects
  if (error instanceof Error) {
    let message = error.name ? `[${error.name}] ` : '';
    message += error.message;
    if (mdBold)
      message = `**${message}**`;

    if (error.cause) {
      // shallow print of the message only
      if (error.cause instanceof Error)
        message += ` · cause: ${error.cause.message}.`;
      // to print it fully (not recommended), use the following:
      // message += ` · cause: ${presentErrorToHumans(error.cause)}`;
    }

    return message;
  }

  // Handle DOMException
  if (error instanceof DOMException)
    return `[DOMException] ${error.name}: ${error.message}`;

  // Handle string errors
  if (typeof error === 'string')
    return error;

  // Handle objects
  if (typeof error === 'object' && error !== null)
    return safeObjectToString(error);

  // Handle other types
  return `Unknown Error: ${String(error)}`;
}

function safeObjectToString(obj: object): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    let valueStr: string;
    if (typeof value === 'object' && value !== null) {
      valueStr = '[Object]';
    } else if (typeof value === 'function') {
      valueStr = '[Function]';
    } else {
      valueStr = String(value);
    }
    pairs.push(`${key}: ${valueStr}`);
  }
  return `{ ${pairs.join(', ')} }`;
}
